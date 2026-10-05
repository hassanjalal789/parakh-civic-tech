/**
 * The open local store: one SQLCipher connection and the LDS-4 media key,
 * shared by every screen of the signed-in citizen.
 *
 * The database key lives in memory only long enough to apply `PRAGMA key`
 * and derive the media key; it is then overwritten. closeLocalStore() is the
 * wipe protocol's step 5 (SRS §3.4.3): it releases the connection and drops
 * the media key, and the next open re-reads the key from expo-secure-store.
 */
import type * as Crypto from "expo-crypto";

import { onCitizenSessionTeardown } from "../auth/session";
import { openEncryptedDatabase } from "./database";
import { allEvidenceIds, draftRepository, type DraftRepository } from "./drafts";
import { deleteStored, deriveMediaKey, mediaDirectory } from "./media";
import { withMediaLock } from "./mediaLock";
import type { SqlDb } from "./sql";

type Opened = { db: SqlDb; mediaKey: Crypto.AESEncryptionKey; cipherVersion: string; released: boolean };

export type LocalStore = {
  drafts: DraftRepository;
  mediaKey: Crypto.AESEncryptionKey;
  cipherVersion: string;
};

export class LocalStoreClosed extends Error {
  constructor() {
    super("The session ended while local drafts were opening");
    this.name = "LocalStoreClosed";
  }
}

let opened: Opened | null = null;
let opening: Promise<Opened> | null = null;
/** Bumped by every close, so an open that finishes after a close never installs its connection. */
let generation = 0;

async function openOnce(): Promise<Opened> {
  const { db, key, cipherVersion } = await openEncryptedDatabase();
  try {
    const mediaKey = await deriveMediaKey(key);
    return { db, mediaKey, cipherVersion, released: false };
  } catch (error) {
    await db.closeAsync().catch(() => undefined);
    throw error;
  } finally {
    key.fill(0);
  }
}

async function release(store: Opened): Promise<void> {
  if (store.released) return;
  store.released = true;
  (store.mediaKey as { release?: () => void }).release?.(); // frees the native key object
  await store.db.closeAsync();
}

/** Opens (once) and returns the store bound to this account; another account's drafts stay invisible. */
export async function openLocalStore(ownerAccountId: string): Promise<LocalStore> {
  if (!opened) {
    const started = generation;
    const pending = (opening ??= openOnce());
    let result: Opened;
    try {
      result = await pending;
    } finally {
      if (opening === pending) opening = null;
    }
    if (generation !== started) {
      await release(result);
      throw new LocalStoreClosed();
    }
    opened = result;
  }
  return {
    drafts: draftRepository(opened.db, ownerAccountId),
    mediaKey: opened.mediaKey,
    cipherVersion: opened.cipherVersion,
  };
}

export async function closeLocalStore(): Promise<void> {
  generation++;
  opening = null; // an open in flight is released by its own caller; the next open starts afresh
  const current = opened;
  opened = null;
  if (current) await release(current);
}

// Sign-out and session expiry release the connection and the key before sign-in returns.
onCitizenSessionTeardown(closeLocalStore);

export function isLocalStoreOpen(): boolean {
  return opened !== null;
}

/**
 * Removes encrypted files that no row references, left by a crash between the
 * file write and the row insert. Rows of every account count, so a file that
 * belongs to another account on this phone is never removed. It holds the
 * media lock and reads the rows only once it has it, so a capture in flight
 * finishes and registers first and its evidence is kept (R-006).
 */
export function removeOrphanMedia(): Promise<number> {
  return withMediaLock(async () => {
    const store = opened;
    if (!store) throw new Error("the local store is not open");
    const dir = mediaDirectory();
    if (!dir.exists) return 0;
    const known = await allEvidenceIds(store.db);
    let removed = 0;
    for (const entry of dir.list()) {
      const match = /^([0-9a-f-]{36})\.pkm$/.exec(entry.name);
      if (match?.[1] && !known.has(match[1])) {
        deleteStored(match[1]);
        removed++;
      }
    }
    return removed;
  });
}
