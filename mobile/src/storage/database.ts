/**
 * The local draft database (LDS-2): app-private `expo-sqlite`, with **no
 * application encryption and no key** (DG-63; Mobile SRS v2.3.0 §3.6.3).
 * The operating system's app sandbox and device encryption protect it;
 * account binding keeps one account's drafts from another (FR-COMMON.25),
 * and the 2-day lifetime keeps them from staying indefinitely (DG-64).
 *
 * The SQLCipher-capable build is kept only so the encrypted store of the
 * 5 October build can be read once and moved (T-128). This database is
 * opened without `PRAGMA key`, which SQLCipher treats as plain SQLite.
 */
import { File } from "expo-file-system";
import * as SQLite from "expo-sqlite";

import { migrate } from "./schema";
import type { SqlDb } from "./sql";

export const DRAFTS_DB_NAME = "parakh-drafts.db";

function asFileUri(path: string): string {
  return path.startsWith("/") ? `file://${path}` : path;
}

export function draftDatabaseFile(): File {
  return new File(asFileUri(String(SQLite.defaultDatabaseDirectory)), DRAFTS_DB_NAME);
}

/** "SQLite format 3\0": the first 16 bytes of every unencrypted SQLite file. */
const PLAINTEXT_HEADER = [
  0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66, 0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00,
];

export function hasPlaintextHeader(head: Uint8Array): boolean {
  return head.length >= 16 && PLAINTEXT_HEADER.every((b, i) => head[i] === b);
}

/** The first 16 bytes of a file. */
export function readHead(file: File): Uint8Array {
  const handle = file.open();
  try {
    return handle.readBytes(16);
  } finally {
    handle.close();
  }
}

export async function openDraftDatabase(): Promise<SqlDb> {
  const db = await SQLite.openDatabaseAsync(DRAFTS_DB_NAME, { useNewConnection: true });
  try {
    await migrate(db);
    return db;
  } catch (error) {
    await db.closeAsync().catch(() => undefined);
    throw error;
  }
}
