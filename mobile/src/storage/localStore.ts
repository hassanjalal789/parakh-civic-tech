/**
 * The open local store: one connection to the draft database, shared by every
 * screen of the signed-in citizen, with no application key (DG-63).
 *
 * Opening it, once per session:
 *   1. opens and migrates the draft database;
 *   2. moves the drafts of the 5 October build across, once (T-128);
 *   3. finishes captures a crash interrupted (capture.ts);
 *   4. deletes unsubmitted drafts whose 2-day lifetime has ended (DG-64), and
 *      pending submissions not confirmed within 48 hours of Submit (DG-67);
 *   5. removes media files that no row refers to.
 * Everything it did is returned in `report`, so nothing is deleted silently.
 *
 * closeLocalStore() is the wipe protocol's step 5 (SRS §3.4.3): it releases
 * the connection. Drafts stay on the phone for the same account (§3.4.3.3).
 */
import { AppState, type NativeEventSubscription } from "react-native";

import { onCitizenSessionTeardown } from "../auth/session";
import { type CaptureRecovery, recoverCaptures } from "./capture";
import { openDraftDatabase } from "./database";
import { draftRepository, type DraftRepository } from "./drafts";
import { type LegacyMigrationResult, migrateLegacyStore } from "./legacy/migrate";
import { type Purged, purgeExpiredDrafts, removeOrphanMedia } from "./lifetime";
import { withMediaLock } from "./mediaLock";
import type { SqlDb } from "./sql";

export type OpenReport = {
  legacy: LegacyMigrationResult;
  captures: CaptureRecovery;
  /** Unsubmitted drafts deleted because their lifetime had ended. */
  expired: number;
  /** Pending submissions deleted because they were not confirmed within 48 hours of Submit. */
  unconfirmedRemoved: number;
  orphansRemoved: number;
};

type Opened = {
  db: SqlDb;
  report: OpenReport;
  released: boolean;
  foreground: NativeEventSubscription | null;
};

export type LocalStore = { drafts: DraftRepository; report: OpenReport };

export class LocalStoreClosed extends Error {
  constructor() {
    super("The session ended while local drafts were opening");
    this.name = "LocalStoreClosed";
  }
}

let clock: () => Date = () => new Date();
let opened: Opened | null = null;
let opening: Promise<Opened> | null = null;
/** Bumped by every close, so an open that finishes after a close never installs its connection. */
let generation = 0;

/** Tests move time; the app never calls this. */
export function setStoreClock(next: () => Date): void {
  clock = next;
}

/** The time the store's lifetime rules use. */
export function storeTime(): Date {
  return clock();
}

async function openOnce(): Promise<Opened> {
  const db = await openDraftDatabase();
  try {
    let legacy: LegacyMigrationResult;
    try {
      legacy = await withMediaLock(() => migrateLegacyStore(db, clock()));
    } catch {
      legacy = { status: "kept", reason: "error" }; // the old store is never removed on an error
    }
    const captures = await recoverCaptures(db);
    const purged = await purgeExpiredDrafts(db, clock());
    const orphansRemoved = await removeOrphanMedia(db);
    const report = {
      legacy,
      captures,
      expired: purged.drafts,
      unconfirmedRemoved: purged.pendingSubmissions,
      orphansRemoved,
    };
    return { db, report, released: false, foreground: null };
  } catch (error) {
    await db.closeAsync().catch(() => undefined);
    throw error;
  }
}

async function release(store: Opened): Promise<void> {
  if (store.released) return;
  store.released = true;
  store.foreground?.remove();
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
    // A draft whose lifetime ends while the app is in the background is deleted on return.
    result.foreground = AppState.addEventListener("change", (state) => {
      if (state === "active") void purgeExpired().catch(() => undefined);
    });
    opened = result;
  }
  return { drafts: draftRepository(opened.db, ownerAccountId, clock), report: opened.report };
}

export async function closeLocalStore(): Promise<void> {
  generation++;
  opening = null; // an open in flight is released by its own caller; the next open starts afresh
  const current = opened;
  opened = null;
  if (current) await release(current);
}

// Sign-out and session expiry release the connection before sign-in returns.
onCitizenSessionTeardown(closeLocalStore);

export function isLocalStoreOpen(): boolean {
  return opened !== null;
}

function openDb(): SqlDb {
  if (!opened) throw new Error("the local store is not open");
  return opened.db;
}

/** A repository on the open store with its own clock; the self-check makes an expired draft with it. */
export function repositoryAt(ownerAccountId: string, at: () => Date): DraftRepository {
  return draftRepository(openDb(), ownerAccountId, at);
}

/** Deletes, now, every expired draft and every pending submission past its 48 hours. */
export function purgeExpired(): Promise<Purged> {
  return purgeExpiredDrafts(openDb(), clock());
}

export function sweepOrphanMedia(): Promise<number> {
  return removeOrphanMedia(openDb());
}
