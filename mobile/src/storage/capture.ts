/**
 * Moving a capture into the encrypted store (FR-PUB.5, DR-23 rules 6 and 7).
 *
 * The camera and recorder write their output to an app-private cache file.
 * Ingestion hashes those exact bytes (the hash at capture), writes them
 * encrypted to LDS-4, proves the stored copy decrypts to the same hash,
 * records the row, and only then deletes the plaintext cache file. The bytes
 * are never re-encoded, trimmed or replaced.
 */
import * as Crypto from "expo-crypto";
import { File } from "expo-file-system";

import type { EvidenceKind } from "../domain/evidenceRules";
import { EvidenceRefused, type EvidenceRow } from "./drafts";
import type { LocalStore } from "./localStore";
import { deleteStored, readDecrypted, sha256Hex, writeEncrypted } from "./media";
import { withMediaLock } from "./mediaLock";

export type Capture = {
  uri: string;
  kind: EvidenceKind;
  mimeType: string;
  capturedAt: string;
  durationSeconds?: number | null;
};

/** Runs under the media lock, so the orphan sweep never sees the ciphertext before its row (R-006). */
export function ingestCapture(store: LocalStore, draftId: string, capture: Capture): Promise<EvidenceRow> {
  return withMediaLock(() => ingest(store, draftId, capture));
}

async function ingest(store: LocalStore, draftId: string, capture: Capture): Promise<EvidenceRow> {
  const source = new File(capture.uri);
  const bytes = await source.bytes();
  const sha256 = await sha256Hex(bytes);
  const evidenceId = Crypto.randomUUID();
  let row: EvidenceRow;
  try {
    await writeEncrypted(store.mediaKey, evidenceId, bytes);
    await readDecrypted(store.mediaKey, evidenceId, sha256); // the stored copy is the captured bytes
    row = await store.drafts.registerEvidence(draftId, {
      evidenceId,
      kind: capture.kind,
      mimeType: capture.mimeType,
      byteSize: bytes.length,
      sha256,
      capturedAt: capture.capturedAt,
      durationSeconds: capture.durationSeconds ?? null,
    });
  } catch (error) {
    deleteStored(evidenceId);
    // A refused item can never join this draft, so its plaintext goes too. After any other
    // failure the cache file is kept, so no captured evidence is lost on an error path (NFR-9).
    if (error instanceof EvidenceRefused && source.exists) source.delete();
    throw error;
  } finally {
    bytes.fill(0);
  }
  if (source.exists) source.delete();
  return row;
}
