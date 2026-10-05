/**
 * Custody of the local database key (DR-23 rules 3, 4 and 8).
 *
 * A 256-bit key from expo-crypto, generated on first launch and held only in
 * expo-secure-store (Keystore / Keychain), never in the database, a file, a
 * log or a backup. If a database exists but its key is missing or
 * unreadable, the app FAILS CLOSED: it never creates a replacement key over
 * an existing database and never opens a database without its key.
 */
import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";

import { fromHex, toHex } from "./bytes";

export const DB_KEY_NAME = "parakh.local.db_key";

export type UnavailableReason =
  "key_missing" | "key_unreadable" | "not_encrypted" | "wrong_key" | "open_failed";

/** Shown to the citizen in plain language: local drafts cannot be opened on this device. */
export class LocalStorageUnavailable extends Error {
  constructor(
    readonly reason: UnavailableReason,
    options?: { cause?: unknown },
  ) {
    super(`Local drafts cannot be opened on this device (${reason})`, options);
    this.name = "LocalStorageUnavailable";
  }
}

export async function loadDatabaseKey(databaseExists: boolean): Promise<Uint8Array> {
  let stored: string | null;
  try {
    stored = await SecureStore.getItemAsync(DB_KEY_NAME);
  } catch {
    throw new LocalStorageUnavailable("key_unreadable");
  }
  if (stored !== null) {
    if (!/^[0-9a-f]{64}$/.test(stored)) throw new LocalStorageUnavailable("key_unreadable");
    return fromHex(stored);
  }
  if (databaseExists) throw new LocalStorageUnavailable("key_missing"); // never a silent new key
  const key = Crypto.getRandomBytes(32);
  await SecureStore.setItemAsync(DB_KEY_NAME, toHex(key), {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY, // not migrated to another device
  });
  return key;
}
