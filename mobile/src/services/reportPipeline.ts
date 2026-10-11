/**
 * From a finished draft to a report (T-052; FR-PUB.14, FR-PUB.21, FR-PUB.27, FR-PUB.28; DG-55, DG-62, DG-65).
 *
 * - **Preparing for review** opens the draft on the server (API-130), sends its evidence
 *   (T-055) and completes the manifest, which starts the server's processing. What the
 *   server holds before Submit is temporary processing data, not a report (DG-55). Every
 *   step is safe to repeat: the next run continues where the last one stopped.
 * - **No text is made on the phone**: the transcription, the Urdu text and the English
 *   text come from the server only (FR-PUB.14), and offline the phone says so.
 * - **Confirming** sends the exact version the reporter checked (API-135) — only after
 *   the phone has hashed the three texts it showed and found the server's hash, so what
 *   is confirmed is exactly what was seen (FR-PUB.21).
 * - **Nothing is submitted until the reporter presses Submit** (DG-65); the submission
 *   queue then sends it, retrying for 48 hours with one key, never twice (T-052).
 * - The local draft stays editable until Submit: going back to change it is allowed, and
 *   the next preparation sends the change; a confirmation of an older version no longer
 *   counts on the server.
 */
import * as Crypto from "expo-crypto";

import { ApiError, OfflineError } from "../api/errors";
import {
  type Confirmation,
  confirmRendering,
  fetchRendering,
  openDraftOnServer,
  type Rendering,
} from "../api/reporting";
import { contentHashText, draftBody, type Missing, missingParts } from "../domain/report";
import { utf8 } from "../storage/bytes";
import type { DraftRepository } from "../storage/drafts";
import { sha256Hex } from "../storage/media";
import type { SubmissionQueue, SubmissionResult } from "./submissionQueue";
import {
  type UploadApi,
  uploadDraftEvidence,
  type UploadProgress,
  type UploadResult,
} from "./evidenceUpload";

export type PipelineApi = UploadApi & {
  openDraftOnServer: typeof openDraftOnServer;
  fetchRendering: typeof fetchRendering;
  confirmRendering: typeof confirmRendering;
};

export type Preparation =
  /** Something the reporter still has to add. */
  | { kind: "missing"; missing: Missing[] }
  /** "Waiting for connection": nothing is lost; the next try continues. */
  | { kind: "offline" }
  /** "Processing your recording": uploaded; the server is preparing the texts. */
  | { kind: "processing" }
  /** "Check the text — AI-generated": the texts to review. */
  | { kind: "review"; rendering: Rendering }
  /** "Something went wrong": processing failed; trying again asks the server for a new attempt. */
  | { kind: "failed"; rendering: Rendering }
  /** The evidence could not be sent as it is (a changed or missing file, damage, a refusal). */
  | { kind: "upload_problem"; upload: Exclude<UploadResult, { kind: "complete" | "offline" }> }
  /** The server refused the draft itself, or it can no longer change there. */
  | { kind: "refused"; code: string; field: string | null };

const fieldOf = (error: ApiError) => (typeof error.details.field === "string" ? error.details.field : null);

/** What the server says about the texts now. */
export async function checkRendering(
  id: string,
  api: Pick<PipelineApi, "fetchRendering">,
): Promise<Preparation> {
  try {
    const rendering = await api.fetchRendering(id);
    if (
      !rendering ||
      rendering.processing_status === "QUEUED" ||
      rendering.processing_status === "PROCESSING"
    ) {
      return { kind: "processing" };
    }
    if (rendering.processing_status === "FAILED") return { kind: "failed", rendering };
    return { kind: "review", rendering };
  } catch (error) {
    if (error instanceof OfflineError) return { kind: "offline" };
    if (error instanceof ApiError) return { kind: "refused", code: error.code, field: fieldOf(error) };
    throw error;
  }
}

export async function prepareForReview(
  drafts: DraftRepository,
  draftId: string,
  api: PipelineApi,
  onProgress?: (progress: UploadProgress) => void,
): Promise<Preparation> {
  const draft = await drafts.get(draftId);
  if (!draft) return { kind: "refused", code: "E_NOT_FOUND", field: null };
  const evidence = await drafts.evidence(draftId);
  const missing = missingParts(draft, evidence);
  if (missing.length > 0) return { kind: "missing", missing };
  try {
    await api.openDraftOnServer(draftBody(draft, evidence)); // API-130: open, or edit; a replay is harmless
  } catch (error) {
    if (error instanceof OfflineError) return { kind: "offline" };
    if (error instanceof ApiError) return { kind: "refused", code: error.code, field: fieldOf(error) };
    throw error;
  }
  const upload = await uploadDraftEvidence(drafts, draftId, { api, onProgress });
  if (upload.kind === "offline") return { kind: "offline" };
  if (upload.kind !== "complete") return { kind: "upload_problem", upload };
  return checkRendering(draftId, api);
}

export type ConfirmResult =
  | { kind: "confirmed" }
  /** The texts changed, or the version was superseded: fetch them again and review them again. */
  | { kind: "changed" }
  | { kind: "offline" }
  | { kind: "refused"; code: string };

/** The reporter checked these exact texts; the server records it (API-135). */
export async function confirmReviewed(
  drafts: DraftRepository,
  draftId: string,
  rendering: Rendering,
  key: string,
  api: Pick<PipelineApi, "confirmRendering">,
  clock: () => Date = () => new Date(),
): Promise<ConfirmResult> {
  const { transcription, urdu_civic_rendering: urdu, english_rendering: english } = rendering;
  if (transcription === null || urdu === null || english === null || !rendering.rendering_content_hash) {
    return { kind: "changed" };
  }
  // What was shown is what is confirmed: the phone's own hash of the three texts must be the server's.
  if (
    (await sha256Hex(utf8(contentHashText(transcription, urdu, english)))) !==
    rendering.rendering_content_hash
  ) {
    return { kind: "changed" };
  }
  const draft = await drafts.get(draftId);
  if (!draft) return { kind: "refused", code: "E_NOT_FOUND" };
  const confirmation: Confirmation = {
    voice_transcription_artifact_id: rendering.voice_transcription_artifact_id,
    client_submission_id: draftId,
    rendering_version: rendering.rendering_version,
    rendering_content_hash: rendering.rendering_content_hash,
    reporter_subject_type: "citizen",
    reporter_account_id: draft.owner_account_id,
    confirmed_at: clock().toISOString(),
    reviewed_texts: ["transcription", "ur", "en"],
  };
  try {
    await api.confirmRendering(draftId, confirmation, key);
  } catch (error) {
    if (error instanceof OfflineError) return { kind: "offline" };
    if (
      error instanceof ApiError &&
      ["E_RENDERING_SUPERSEDED", "E_RENDERING_HASH_MISMATCH", "E_RENDERING_INCOMPLETE"].includes(error.code)
    ) {
      return { kind: "changed" };
    }
    if (error instanceof ApiError) return { kind: "refused", code: error.code };
    throw error;
  }
  await drafts.update(draftId, {
    rendering_version: rendering.rendering_version,
    rendering_content_hash: rendering.rendering_content_hash,
  });
  return { kind: "confirmed" };
}

/** A new key for one confirmation; a retry of the same confirmation reuses it. */
export const newConfirmationKey = () => Crypto.randomUUID();

/**
 * The reporter pressed Submit after confirming (DG-65): the draft becomes ready to submit
 * and the submission queue sends it — now if it can, otherwise for up to 48 hours.
 */
export async function submitConfirmed(
  drafts: DraftRepository,
  draftId: string,
  queue: Pick<SubmissionQueue, "requestSubmission">,
): Promise<SubmissionResult> {
  const draft = await drafts.get(draftId);
  if (!draft) return { kind: "refused", reason: "unknown_draft" };
  // Only a draft whose texts were confirmed on this phone becomes ready; the server checks again (API-140).
  if (draft.pipeline_state === "LOCAL_DRAFT") {
    if (!draft.rendering_content_hash) return { kind: "refused", reason: "not_ready" };
    await drafts.update(draftId, { pipeline_state: "READY_TO_SUBMIT" });
  }
  return queue.requestSubmission(draftId);
}
