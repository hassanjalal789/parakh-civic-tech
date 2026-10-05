/**
 * A development-build self-check of the native local store, used to gather
 * DEP-08 evidence on an emulator or a device. It runs the real SQLCipher,
 * expo-crypto and expo-file-system code with a synthetic owner and synthetic
 * bytes, never citizen data, and removes everything it wrote.
 */
import * as Crypto from "expo-crypto";
import { File, Paths } from "expo-file-system";

import { concat, equalBytes, utf8 } from "./bytes";
import { ingestCapture } from "./capture";
import { databaseFile, hasPlaintextHeader, readHead } from "./database";
import { type LocalStore, openLocalStore } from "./localStore";
import { deleteStored, mediaFile, readDecrypted } from "./media";

export const SELF_CHECK_OWNER = "00000000-0000-4000-8000-00000000c4ec";
const OTHER_OWNER = "00000000-0000-4000-8000-00000000c4ed";
const MARKER = utf8("PARAKH-SELF-CHECK-SYNTHETIC");

export type SelfCheckResult = {
  cipherVersion: string;
  databaseHeaderEncrypted: boolean;
  mediaCiphertextOnly: boolean;
  mediaRoundTrip: boolean;
  plaintextCacheRemoved: boolean;
  otherOwnerSeesNothing: boolean;
  cleanedUp: boolean;
  passed: boolean;
};

function includes(haystack: Uint8Array, needle: Uint8Array): boolean {
  outer: for (let i = 0; i + needle.length <= haystack.length; i++) {
    for (let j = 0; j < needle.length; j++) if (haystack[i + j] !== needle[j]) continue outer;
    return true;
  }
  return false;
}

/** expo-crypto returns at most 1024 random bytes per call (seen on the emulator, 2026-10-05). */
function syntheticBytes(size: number): Uint8Array {
  const parts: Uint8Array[] = [];
  for (let made = 0; made < size; made += 1024)
    parts.push(Crypto.getRandomBytes(Math.min(1024, size - made)));
  return concat(...parts);
}

/** Removes every draft of the synthetic owner, including any left by an interrupted run. */
async function removeSyntheticDrafts(store: LocalStore): Promise<void> {
  for (const draft of await store.drafts.list()) {
    for (const item of await store.drafts.remove(draft.client_submission_id)) deleteStored(item.evidence_id);
  }
}

export async function runStorageSelfCheck(): Promise<SelfCheckResult> {
  const store = await openLocalStore(SELF_CHECK_OWNER);
  await removeSyntheticDrafts(store);
  const cache = new File(Paths.cache, `parakh-self-check-${Crypto.randomUUID()}.jpg`);
  let evidenceId: string | null = null;
  try {
    const draft = await store.drafts.create();
    const photo = concat(MARKER, syntheticBytes(64 * 1024));
    cache.create();
    cache.write(photo);

    const row = await ingestCapture(store, draft.client_submission_id, {
      uri: cache.uri,
      kind: "photo",
      mimeType: "image/jpeg",
      capturedAt: new Date().toISOString(),
    });
    evidenceId = row.evidence_id;
    const stored = await mediaFile(row.evidence_id).bytes();
    const back = await readDecrypted(store.mediaKey, row.evidence_id, row.sha256);
    const other = await openLocalStore(OTHER_OWNER);

    const result = {
      cipherVersion: store.cipherVersion,
      databaseHeaderEncrypted: !hasPlaintextHeader(readHead(databaseFile())),
      mediaCiphertextOnly: !includes(stored, MARKER),
      mediaRoundTrip: equalBytes(back, photo),
      plaintextCacheRemoved: !cache.exists,
      otherOwnerSeesNothing:
        (await other.drafts.list()).length === 0 &&
        (await other.drafts.get(draft.client_submission_id)) === null,
    };
    await removeSyntheticDrafts(store);
    const cleanedUp = (await store.drafts.list()).length === 0 && !mediaFile(row.evidence_id).exists;
    const passed = Object.values(result).every((v) => v !== false) && cleanedUp;
    return { ...result, cleanedUp, passed };
  } finally {
    await removeSyntheticDrafts(store);
    if (evidenceId) deleteStored(evidenceId);
    if (cache.exists) cache.delete();
  }
}
