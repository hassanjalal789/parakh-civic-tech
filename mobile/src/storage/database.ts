/**
 * The single encrypted database for LDS-2 and LDS-3 (DR-23 rules 1, 5 and 8).
 *
 * Open order: read the key (failing closed), open, apply `PRAGMA key` as the
 * first statement, prove SQLCipher is linked (`PRAGMA cipher_version`), prove
 * the key opens the file, migrate, then prove the file on disk does not start
 * with the plaintext SQLite header. Any failure closes the connection and
 * surfaces LocalStorageUnavailable; the database is never used unencrypted.
 */
import { File } from "expo-file-system";
import * as SQLite from "expo-sqlite";

import { toHex } from "./bytes";
import { LocalStorageUnavailable, loadDatabaseKey } from "./key";
import { migrate } from "./schema";
import type { SqlDb } from "./sql";

export const DB_NAME = "parakh-local.db";

/** "SQLite format 3\0": the first 16 bytes of every unencrypted SQLite file. */
const PLAINTEXT_HEADER = [
  0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00,
];

export function hasPlaintextHeader(head: Uint8Array): boolean {
  return head.length >= 16 && PLAINTEXT_HEADER.every((b, i) => head[i] === b);
}

function asFileUri(path: string): string {
  return path.startsWith("/") ? `file://${path}` : path;
}

export function databaseFile(): File {
  return new File(asFileUri(String(SQLite.defaultDatabaseDirectory)), DB_NAME);
}

/** The first 16 bytes of a file: enough to tell an encrypted database from a plaintext one. */
export function readHead(file: File): Uint8Array {
  const handle = file.open();
  try {
    return handle.readBytes(16);
  } finally {
    handle.close();
  }
}

export interface OpenedDatabase {
  db: SqlDb;
  /** Derive LDS-4's media key before this array is wiped by the caller. */
  key: Uint8Array;
  cipherVersion: string;
}

export async function openEncryptedDatabase(): Promise<OpenedDatabase> {
  const file = databaseFile();
  const key = await loadDatabaseKey(file.exists);
  const db = await SQLite.openDatabaseAsync(DB_NAME, { useNewConnection: true });
  try {
    await db.execAsync(`PRAGMA key = "x'${toHex(key)}'";`); // rule 5: the first statement
    const cipher = await db.getFirstAsync<{ cipher_version: string }>("PRAGMA cipher_version");
    if (!cipher?.cipher_version) throw new LocalStorageUnavailable("not_encrypted");
    try {
      await db.getFirstAsync("SELECT count(*) AS n FROM sqlite_master");
    } catch {
      throw new LocalStorageUnavailable("wrong_key");
    }
    await migrate(db);
    if (hasPlaintextHeader(readHead(file))) throw new LocalStorageUnavailable("not_encrypted");
    return { db, key, cipherVersion: cipher.cipher_version };
  } catch (error) {
    key.fill(0);
    await db.closeAsync().catch(() => undefined);
    // Whatever failed, the caller only ever sees "cannot be opened": never a half-open store.
    throw error instanceof LocalStorageUnavailable
      ? error
      : new LocalStorageUnavailable("open_failed", { cause: error });
  }
}
