/**
 * A development-build self-check of the native draft store, used to gather
 * evidence on an emulator or a device (T-046). It runs the real expo-sqlite
 * and expo-file-system code with synthetic owners and synthetic bytes, never
 * citizen data, and removes everything it wrote.
 *
 * It checks what the decisions of 6 October 2026 require: the database is
 * plain SQLite with no application key (DG-63); a capture file is moved, not
 * copied; the 2-day lifetime is fixed at creation and an expired draft is
 * deleted with its file (DG-64); another account sees nothing (FR-COMMON.25).
 */
import * as Crypto from "expo-crypto";
import { File, Paths } from "expo-file-system";

import { concat, equalBytes, utf8 } from "./bytes";
import { ingestCapture } from "./capture";
import { draftDatabaseFile, hasPlaintextHeader, readHead } from "./database";
import { DRAFT_LIFETIME_MS, type DraftRepository } from "./drafts";
import { discardDraft } from "./lifetime";
import {
  type LocalStore,
  openLocalStore,
  type OpenReport,
  purgeExpired,
  repositoryAt,
  storeTime,
} from "./localStore";
import { draftMediaDirectory, draftMediaFile, readDraftMedia } from "./media";

export const SELF_CHECK_OWNER = "00000000-0000-4000-8000-00000000c4ec";
const OTHER_OWNER = "00000000-0000-4000-8000-00000000c4ed";
const MARKER = utf8("PARAKH-SELF-CHECK-SYNTHETIC");

export type SelfCheckResult = {
  legacy: OpenReport["legacy"];
  databaseIsPlainSqlite: boolean;
  captureMovedNotCopied: boolean;
  mediaMatchesCapture: boolean;
  lifetimeFixedAtCreation: boolean;
  expiredDraftDeleted: boolean;
  otherOwnerSeesNothing: boolean;
  cleanedUp: boolean;
  passed: boolean;
};

/** expo-crypto returns at most 1024 random bytes per call (seen on the emulator, 2026-10-05). */
function syntheticBytes(size: number): Uint8Array {
  const parts: Uint8Array[] = [];
  for (let made = 0; made < size; made += 1024)
    parts.push(Crypto.getRandomBytes(Math.min(1024, size - made)));
  return concat(...parts);
}

function cacheFile(bytes: Uint8Array): File {
  const file = new File(Paths.cache, `parakh-self-check-${Crypto.randomUUID()}.jpg`);
  file.create();
  file.write(bytes);
  return file;
}

/** Removes every draft and note of the synthetic owner, including any left by an interrupted run. */
async function removeSyntheticDrafts(drafts: DraftRepository): Promise<void> {
  for (const draft of await drafts.list()) await discardDraft(drafts, draft.client_submission_id);
  for (const id of await drafts.pendingServerCancellations()) await drafts.clearServerCancellation(id);
}

export async function runStorageSelfCheck(): Promise<SelfCheckResult> {
  const store: LocalStore = await openLocalStore(SELF_CHECK_OWNER);
  await removeSyntheticDrafts(store.drafts);
  const caches: File[] = [];
  try {
    const draft = await store.drafts.create();
    const photo = concat(MARKER, syntheticBytes(64 * 1024));
    const cache = cacheFile(photo);
    caches.push(cache);
    const before = draftMediaDirectory().exists ? draftMediaDirectory().list().length : 0;
    const row = await ingestCapture(store.drafts, draft.client_submission_id, {
      uri: cache.uri,
      kind: "photo",
      mimeType: "image/jpeg",
      capturedAt: storeTime().toISOString(),
    });
    const stored = await readDraftMedia(row.file_name, row.sha256);
    const other = await openLocalStore(OTHER_OWNER);

    // A draft created 2 days and a second ago: its lifetime has ended, and the purge removes it.
    const past = new Date(storeTime().getTime() - DRAFT_LIFETIME_MS - 1000);
    const then = repositoryAt(SELF_CHECK_OWNER, () => past);
    const old = await then.create();
    const oldCache = cacheFile(syntheticBytes(4 * 1024));
    caches.push(oldCache);
    const oldItem = await ingestCapture(then, old.client_submission_id, {
      uri: oldCache.uri,
      kind: "photo",
      mimeType: "image/jpeg",
      capturedAt: past.toISOString(),
    });
    const edited = await store.drafts.update(draft.client_submission_id, { category: "other" });
    await purgeExpired();

    const result = {
      legacy: store.report.legacy,
      databaseIsPlainSqlite: hasPlaintextHeader(readHead(draftDatabaseFile())),
      captureMovedNotCopied:
        !cache.exists &&
        draftMediaFile(row.file_name).exists &&
        draftMediaDirectory().list().length === before + 1,
      mediaMatchesCapture: equalBytes(stored, photo),
      lifetimeFixedAtCreation:
        Date.parse(draft.expires_at) - Date.parse(draft.created_at) === DRAFT_LIFETIME_MS &&
        edited?.expires_at === draft.expires_at,
      expiredDraftDeleted:
        (await store.drafts.get(old.client_submission_id)) === null &&
        !draftMediaFile(oldItem.file_name).exists,
      otherOwnerSeesNothing:
        (await other.drafts.list()).length === 0 &&
        (await other.drafts.get(draft.client_submission_id)) === null,
    };
    await removeSyntheticDrafts(store.drafts);
    const cleanedUp = (await store.drafts.list()).length === 0 && !draftMediaFile(row.file_name).exists;
    const checks = Object.entries(result).filter(([k]) => k !== "legacy");
    const passed = checks.every(([, v]) => v === true) && cleanedUp;
    return { ...result, cleanedUp, passed };
  } finally {
    await removeSyntheticDrafts(store.drafts);
    for (const file of caches) if (file.exists) file.delete();
  }
}
