/**
 * A test double for expo-sqlite over Node's built-in SQLite.
 *
 * SQLCipher is SIMULATED; nothing here encrypts anything. It stands in for
 * the encrypted store of the 5 October build, which the app now only reads
 * once (T-128). In "sqlcipher" mode a database opened with `PRAGMA key` holds
 * a stand-in header plus a key fingerprint at its path (so a wrong key fails
 * as SQLCipher's "file is not a database" does) and its rows live in a shadow
 * file beside it; a database opened without a key is plain SQLite. "plain" passes every
 * statement to unencrypted SQLite, which ignores PRAGMA key and has no
 * cipher_version: what a build without SQLCipher does. "key_ignored" reports
 * a cipher version but stores plaintext, as if the key were never applied.
 * Real encryption is verified on the emulator and on devices (DEP-08).
 */
import { createHash } from "crypto";
import * as fs from "fs";
import * as path from "path";

import { root } from "./fileSystem";

type NodeStatement = {
  run(...p: unknown[]): { changes: number | bigint };
  get(...p: unknown[]): unknown;
  all(...p: unknown[]): unknown[];
};
type NodeDatabase = { exec(sql: string): void; prepare(sql: string): NodeStatement; close(): void };
const { DatabaseSync } = (
  process as unknown as { getBuiltinModule(id: string): { DatabaseSync: new (file: string) => NodeDatabase } }
).getBuiltinModule("node:sqlite");

export type CipherMode = "sqlcipher" | "plain" | "key_ignored";

export const control = {
  mode: "sqlcipher" as CipherMode,
  statements: [] as string[],
  opened: 0,
  closed: 0,
  /** The next statement matching this fails once, as an interruption would. */
  failOn: null as RegExp | null,
  /** The next deleteDatabaseAsync fails once. */
  failNextDelete: false,
};

function interrupt(sql: string): void {
  if (control.failOn?.test(sql)) {
    control.failOn = null;
    throw new Error("synthetic interruption");
  }
}

export const defaultDatabaseDirectory = path.join(root, "SQLite"); // a plain path, as on Android

const STAND_IN_HEADER = Buffer.from("SIMULATED-CIPHER"); // 16 bytes, never "SQLite format 3\0"
const KEY_PRAGMA = /^\s*PRAGMA\s+key\s*=\s*"x'([0-9a-f]{64})'"\s*;?\s*$/i;

function fingerprint(keyHex: string): string {
  return createHash("sha256").update(keyHex).digest("hex");
}

class FakeDatabase {
  private real: NodeDatabase | null = null;
  private keyHex: string | null = null;
  private isClosed = false;

  constructor(readonly databasePath: string) {}

  private connection(): NodeDatabase {
    if (this.isClosed) throw new Error("database is closed");
    if (this.real) return this.real;
    if (control.mode === "sqlcipher" && this.keyHex) {
      const expected = Buffer.concat([STAND_IN_HEADER, Buffer.from(fingerprint(this.keyHex))]);
      if (fs.existsSync(this.databasePath)) {
        if (!fs.readFileSync(this.databasePath).equals(expected)) throw new Error("file is not a database");
      } else {
        fs.writeFileSync(this.databasePath, expected);
      }
      this.real = new DatabaseSync(`${this.databasePath}.rows`);
    } else {
      this.real = new DatabaseSync(this.databasePath); // no key applied: plaintext, as SQLite writes it
    }
    return this.real;
  }

  async execAsync(sql: string): Promise<void> {
    control.statements.push(sql);
    interrupt(sql);
    const key = KEY_PRAGMA.exec(sql);
    if (key && control.mode !== "plain") {
      if (this.real) throw new Error("PRAGMA key must come before any other statement");
      if (control.mode === "sqlcipher") this.keyHex = key[1] ?? null;
      return;
    }
    this.connection().exec(sql);
  }

  async runAsync(sql: string, ...params: unknown[]): Promise<{ changes: number; lastInsertRowId: number }> {
    control.statements.push(sql);
    interrupt(sql);
    const result = this.connection()
      .prepare(sql)
      .run(...params);
    return { changes: Number(result.changes), lastInsertRowId: 0 };
  }

  async getFirstAsync<T>(sql: string, ...params: unknown[]): Promise<T | null> {
    control.statements.push(sql);
    interrupt(sql);
    if (/^\s*PRAGMA\s+cipher_version/i.test(sql) && control.mode !== "plain") {
      return { cipher_version: "4.x (simulated)" } as T; // like SQLCipher: answered without reading the file
    }
    return (
      (this.connection()
        .prepare(sql)
        .get(...params) as T | undefined) ?? null
    );
  }

  async getAllAsync<T>(sql: string, ...params: unknown[]): Promise<T[]> {
    control.statements.push(sql);
    interrupt(sql);
    return this.connection()
      .prepare(sql)
      .all(...params) as T[];
  }

  async closeAsync(): Promise<void> {
    if (this.isClosed) return;
    this.isClosed = true;
    await new Promise((resolve) => setTimeout(resolve, 0)); // the native close finishes later, as on a device
    this.real?.close();
    this.real = null;
    control.closed++;
  }
}

export async function openDatabaseAsync(
  name: string,
  _options?: unknown,
  directory?: string,
): Promise<FakeDatabase> {
  const dir = directory ?? defaultDatabaseDirectory;
  fs.mkdirSync(dir, { recursive: true });
  control.opened++;
  return new FakeDatabase(path.join(dir, name));
}

/** Deletes a closed database's files, as expo-sqlite does. */
export async function deleteDatabaseAsync(name: string, directory?: string): Promise<void> {
  if (control.failNextDelete) {
    control.failNextDelete = false;
    throw new Error("synthetic interruption while deleting");
  }
  const file = path.join(directory ?? defaultDatabaseDirectory, name);
  if (!fs.existsSync(file)) throw new Error(`database ${name} not found`);
  for (const suffix of ["", ".rows", "-wal", "-shm", "-journal"])
    fs.rmSync(`${file}${suffix}`, { force: true });
}

/** An in-memory database for repository tests that need no file at all. */
export function memoryDatabase(): FakeDatabase {
  const db = new FakeDatabase(":memory:");
  return db;
}

export function resetSqlite(mode: CipherMode = "sqlcipher"): void {
  control.mode = mode;
  control.statements = [];
  control.opened = 0;
  control.closed = 0;
  control.failOn = null;
  control.failNextDelete = false;
}
