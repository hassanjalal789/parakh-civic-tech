/**
 * What a draft needs before it is sent for processing, and what is sent (T-052; API-130).
 *
 * - **Ready** means: a category (FR-PUB.2), 1–3 live photos (DG-47), the report text
 *   spoken or typed (FR-PUB.9, DG-61), and a location (FR-PUB.24) — with its location
 *   recording when the location was spoken (DG-77).
 * - **The capture time sent is the first capture's** (FR-PUB.25: the capture time is
 *   operative; the server stores the time it received the draft separately).
 * - **The content hash** of the three texts is computed here as the server computes it
 *   (§`rendering_content_hash`), so the phone confirms exactly the texts it showed.
 */
import type { DraftBody } from "../api/reporting";
import type { DraftRow, EvidenceRow } from "../storage/drafts";
import { locationOf } from "../storage/drafts";
import { EVIDENCE_RULES } from "./evidenceRules";
import { locationBody } from "./location";

export type Missing = "category" | "photo" | "description" | "location";

/** The draft's report text, as CIT-09 left it: a recording, typed text, or nothing yet. */
export function descriptionOf(draft: DraftRow, evidence: readonly EvidenceRow[]): "voice" | "typed" | null {
  const recorded = evidence.some((e) => e.kind === "voice_original" && e.source_uri === null);
  const typed = (draft.typed_description ?? "").trim().length > 0;
  if (recorded && typed) return draft.description_mode;
  return recorded ? "voice" : typed ? "typed" : null;
}

/** What is still missing before the draft can be sent; empty when it is ready. */
export function missingParts(draft: DraftRow, evidence: readonly EvidenceRow[]): Missing[] {
  const adopted = evidence.filter((e) => e.source_uri === null);
  const missing: Missing[] = [];
  if (!draft.category) missing.push("category");
  if (adopted.filter((e) => e.kind === "photo").length < EVIDENCE_RULES.photoMin) missing.push("photo");
  if (!descriptionOf(draft, adopted)) missing.push("description");
  const location = locationOf(draft);
  if (!location || (location.kind === "spoken" && !adopted.some((e) => e.kind === "location_voice"))) {
    missing.push("location");
  }
  return missing;
}

/** The API-130 body of a ready draft. */
export function draftBody(draft: DraftRow, evidence: readonly EvidenceRow[]): DraftBody {
  const adopted = evidence.filter((e) => e.source_uri === null);
  const mode = descriptionOf(draft, adopted);
  const location = locationOf(draft);
  if (!draft.category || !mode || !location || adopted.length === 0)
    throw new Error("the draft is not ready");
  const firstCapture = adopted.map((e) => e.captured_at).sort()[0] as string;
  return {
    client_submission_id: draft.client_submission_id,
    category: draft.category,
    description_mode: mode,
    ...(mode === "typed" ? { typed_description: draft.typed_description ?? "" } : {}),
    captured_at: firstCapture,
    location: locationBody(location),
  };
}

/** The canonical form a content hash is computed over: NFC, LF line endings, trimmed (never what is stored). */
export function canonicalText(text: string): string {
  const normalised = typeof text.normalize === "function" ? text.normalize("NFC") : text;
  return normalised.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

/**
 * The text whose SHA-256 is `rendering_content_hash`: the JSON object {"en","transcription","ur"},
 * keys sorted, no spaces, non-ASCII as is — the server's rendering_hash, byte for byte.
 */
export function contentHashText(transcription: string, urdu: string, english: string): string {
  return JSON.stringify({
    en: canonicalText(english),
    transcription: canonicalText(transcription),
    ur: canonicalText(urdu),
  });
}
