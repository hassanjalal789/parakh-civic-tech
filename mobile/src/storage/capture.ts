/**
 * A capture becomes draft evidence (FR-PUB.5; DG-63).
 *
 * The camera and the recorder write their output to a file of their own, and
 * that file is the evidence. Ingestion hashes its exact bytes (the hash at
 * capture), records the row together with the file's current location, then
 * moves the file into the drafts folder and marks the row adopted. Because the
 * row exists before the move, a crash in between is finished on the next start
 * (recoverCaptures). Nothing is copied, re-encoded or encrypted by the app.
 */
import * as Crypto from "expo-crypto";
import { File } from "expo-file-system";

import { CAPTURE_SETTINGS } from "../domain/captureSettings";
import { type EvidenceKind, MIME_TYPES } from "../domain/evidenceRules";
import { summariseMedia } from "../domain/mp4";
import { RECORDING_SETTINGS } from "../domain/recordingSettings";
import {
  deleteEvidenceRow,
  type DraftRepository,
  EvidenceRefused,
  type EvidenceRow,
  markAdopted,
  unadoptedEvidence,
} from "./drafts";
import { adoptCaptureFile, draftMediaFile, mediaFileName, sha256Hex } from "./media";
import { withMediaLock } from "./mediaLock";
import type { SqlDb } from "./sql";

/** The server's item limits (docs/api/CITIZEN_REPORTING_CONTRACT.md); a larger item could never be sent. */
const MAX_BYTES: Partial<Record<EvidenceKind, number>> = {
  photo: CAPTURE_SETTINGS.photoMaxBytes,
  video: CAPTURE_SETTINGS.videoMaxBytes,
  voice_original: RECORDING_SETTINGS.maxBytes,
  location_voice: RECORDING_SETTINGS.maxBytes,
};

export type Capture = {
  uri: string;
  kind: EvidenceKind;
  mimeType: string;
  capturedAt: string;
  durationSeconds?: number | null;
};

/** Runs under the media lock, so the orphan sweep and the purge never see a capture half-way (R-006). */
export function ingestCapture(
  drafts: DraftRepository,
  draftId: string,
  capture: Capture,
): Promise<EvidenceRow> {
  return withMediaLock(() => ingest(drafts, draftId, capture));
}

async function ingest(drafts: DraftRepository, draftId: string, capture: Capture): Promise<EvidenceRow> {
  const source = new File(capture.uri);
  if (!MIME_TYPES[capture.kind]?.includes(capture.mimeType)) {
    if (source.exists) source.delete(); // a capture of the wrong type can never join a draft
    throw new EvidenceRefused("bad_type");
  }
  const bytes = await source.bytes();
  const refuse = (
    reason: "too_large" | "unreadable_video" | "video_without_sound" | "unreadable_recording",
  ): never => {
    if (source.exists) source.delete(); // the server would refuse it too, so it can never join a draft
    throw new EvidenceRefused(reason);
  };
  if (bytes.length > (MAX_BYTES[capture.kind] ?? Infinity)) refuse("too_large");
  let durationSeconds = capture.durationSeconds ?? null;
  if (capture.kind === "video") {
    // The container's own duration, read as the server reads it (DG-54); a video must hold a video track,
    // and a sound track: a video includes sound (DG-71, Hassan Jalal, 2026-10-11).
    try {
      const media = summariseMedia(bytes);
      if (!media.trackTypes.has("vide")) refuse("unreadable_video");
      if (!media.trackTypes.has("soun")) refuse("video_without_sound");
      durationSeconds = media.durationSeconds;
    } catch (error) {
      if (error instanceof EvidenceRefused) throw error;
      refuse("unreadable_video");
    }
  } else if (capture.kind === "voice_original" || capture.kind === "location_voice") {
    // A recording is sound only, read as the server reads it: a sound track, no video track (FR-PUB.10).
    try {
      const media = summariseMedia(bytes);
      if (!media.trackTypes.has("soun") || media.trackTypes.has("vide")) refuse("unreadable_recording");
      durationSeconds = media.durationSeconds;
    } catch (error) {
      if (error instanceof EvidenceRefused) throw error;
      refuse("unreadable_recording");
    }
  }
  const sha256 = await sha256Hex(bytes); // the hash at capture, of exactly these bytes
  const evidenceId = Crypto.randomUUID();
  const fileName = mediaFileName(evidenceId, capture.mimeType);
  let row: EvidenceRow;
  try {
    row = await drafts.registerEvidence(draftId, {
      evidenceId,
      kind: capture.kind,
      mimeType: capture.mimeType,
      byteSize: bytes.length,
      sha256,
      capturedAt: capture.capturedAt,
      durationSeconds,
      fileName,
      sourceUri: source.uri,
    });
  } catch (error) {
    // A refused item can never join this draft, so its file goes. After any other failure the
    // file is kept where the camera wrote it, so no captured evidence is lost (NFR-9).
    if (error instanceof EvidenceRefused && source.exists) source.delete();
    throw error;
  }
  try {
    await adoptCaptureFile(source, fileName);
  } catch (error) {
    await drafts.forgetUnadopted(evidenceId); // the draft never lists an item it does not hold
    throw error;
  }
  await drafts.markAdopted(evidenceId);
  return { ...row, source_uri: null };
}

/** `pending`: still unfinished, tried again on the next open. */
export type CaptureRecovery = { completed: number; lost: number; pending: number };

/**
 * Finishes captures that a crash interrupted between their row and their move: a file
 * already moved is marked adopted; a file still where the camera wrote it, with the
 * hash taken at capture, is moved now; a capture whose file is gone (the system may
 * clear its cache) loses its row, and is counted so it is never lost silently.
 */
export function recoverCaptures(db: SqlDb): Promise<CaptureRecovery> {
  return withMediaLock(async () => {
    const result: CaptureRecovery = { completed: 0, lost: 0, pending: 0 };
    for (const row of await unadoptedEvidence(db)) {
      try {
        if (!draftMediaFile(row.file_name).exists) {
          const source = row.source_uri ? new File(row.source_uri) : null;
          if (!source?.exists || (await sha256Hex(await source.bytes())) !== row.sha256) {
            await deleteEvidenceRow(db, row.evidence_id);
            result.lost++;
            continue;
          }
          await adoptCaptureFile(source, row.file_name);
        }
        await markAdopted(db, row.evidence_id);
        result.completed++;
      } catch {
        result.pending++; // the file stays where it is; nothing is deleted on an error
      }
    }
    return result;
  });
}
