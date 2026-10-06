/**
 * Read-only access to the encrypted draft store of the 5 October 2026
 * development build (DR-23, superseded for drafts and media by DG-63).
 * It is used once, by the migration (T-128), and never writes a draft.
 */
import * as Crypto from "expo-crypto";
import { Directory, File, Paths } from "expo-file-system";
import * as SecureStore from "expo-secure-store";
import * as SQLite from "expo-sqlite";

import { bufferSource, concat, fromHex, toHex, utf8 } from "../bytes";
import type { SqlDb } from "../sql";

export const LEGACY_DB_NAME = "parakh-local.db";
export const LEGACY_KEY_NAME = "parakh.local.db_key";
const MEDIA_LABEL = "parakh-media-v1:";
const MAGIC = utf8("PKM1");

function asFileUri(path: string): string {
  return path.startsWith("/") ? `file://${path}` : path;
}

export function legacyDatabaseFile(): File {
  return new File(asFileUri(String(SQLite.defaultDatabaseDirectory)), LEGACY_DB_NAME);
}

export function legacyMediaDirectory(): Directory {
  return new Directory(Paths.document, "parakh-media");
}

export function legacyMediaFile(evidenceId: string): File {
  if (!/^[0-9a-f-]{36}$/.test(evidenceId)) throw new Error("evidence ids are UUIDs");
  return new File(legacyMediaDirectory(), `${evidenceId}.pkm`);
}

/** The old key, or null when it is absent or unreadable. Nothing is ever created here. */
export async function readLegacyKey(): Promise<Uint8Array | null> {
  try {
    const stored = await SecureStore.getItemAsync(LEGACY_KEY_NAME);
    return stored && /^[0-9a-f]{64}$/.test(stored) ? fromHex(stored) : null;
  } catch {
    return null;
  }
}

/** Opens the old database with its key applied first, and proves the key reads it. */
export async function openLegacyDatabase(key: Uint8Array): Promise<SqlDb> {
  const db = await SQLite.openDatabaseAsync(LEGACY_DB_NAME, { useNewConnection: true });
  try {
    await db.execAsync(`PRAGMA key = "x'${toHex(key)}'";`);
    await db.getFirstAsync("SELECT count(*) AS n FROM sqlite_master");
    return db;
  } catch (error) {
    await db.closeAsync().catch(() => undefined);
    throw error;
  }
}

export async function legacyMediaKey(databaseKey: Uint8Array): Promise<Crypto.AESEncryptionKey> {
  const material = new Uint8Array(
    await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, concat(utf8(MEDIA_LABEL), databaseKey)),
  );
  try {
    return await Crypto.AESEncryptionKey.import(material);
  } finally {
    material.fill(0);
  }
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  return toHex(new Uint8Array(await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, bufferSource(bytes))));
}

/** Decrypts one old item; null when it is missing or fails its integrity check. */
export async function decryptLegacyMedia(
  key: Crypto.AESEncryptionKey,
  evidenceId: string,
  expectedSha256: string,
): Promise<Uint8Array | null> {
  const file = legacyMediaFile(evidenceId);
  if (!file.exists) return null;
  const raw = await file.bytes();
  if (raw.length < MAGIC.length + 12 + 16 || !MAGIC.every((b, i) => raw[i] === b)) return null;
  try {
    const sealed = Crypto.AESSealedData.fromCombined(raw.subarray(MAGIC.length));
    const plaintext = await Crypto.aesDecryptAsync(sealed, key, {
      additionalData: utf8(`${MEDIA_LABEL}${evidenceId}`),
    });
    return (await sha256Hex(plaintext)) === expectedSha256 ? plaintext : null;
  } catch {
    return null;
  }
}

/** Removes the old store once its drafts are safely in the new one: database, then media, then key. */
export async function removeLegacyStore(): Promise<void> {
  const db = legacyDatabaseFile();
  if (db.exists) await SQLite.deleteDatabaseAsync(LEGACY_DB_NAME);
  const media = legacyMediaDirectory();
  if (media.exists) for (const entry of media.list()) if (entry instanceof File) entry.delete();
  await SecureStore.deleteItemAsync(LEGACY_KEY_NAME);
}
