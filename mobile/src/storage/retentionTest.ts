/**
 * Development builds only: synthetic items for testing the retention rules
 * by hand on a phone or emulator (docs/testing/PHYSICAL_ANDROID_TESTING.md).
 *
 * They belong to a synthetic account, hold random bytes as their "photo",
 * and follow exactly the rules real drafts follow: a test draft is deleted
 * 48 hours after it was created (DG-64); a test pending submission 48 hours
 * after its Submit (DG-67). Nothing is ever sent: no submission queue runs
 * for this account, so its Submit is only recorded.
 */
import * as Crypto from "expo-crypto";
import { File, Paths } from "expo-file-system";

import { localStatus } from "../domain/draftStatus";
import { concat } from "./bytes";
import { ingestCapture } from "./capture";
import { discardDraft } from "./lifetime";
import { openLocalStore, type OpenReport } from "./localStore";

export const RETENTION_TEST_OWNER = "00000000-0000-4000-8000-000000007e57";

export type TestItem = {
  id: string;
  kind: "draft" | "pending_submission";
  createdAt: string;
  deletesAt: string;
  files: number;
};

function syntheticPhoto(): Uint8Array {
  return concat(Crypto.getRandomBytes(1024), Crypto.getRandomBytes(1024)); // at most 1024 per call
}

async function store() {
  return (await openLocalStore(RETENTION_TEST_OWNER)).drafts;
}

async function createWithPhoto() {
  const drafts = await store();
  const draft = await drafts.create();
  const cache = new File(Paths.cache, `parakh-retention-test-${Crypto.randomUUID()}.jpg`);
  cache.create();
  cache.write(syntheticPhoto());
  await ingestCapture(drafts, draft.client_submission_id, {
    uri: cache.uri,
    kind: "photo",
    mimeType: "image/jpeg",
    capturedAt: draft.created_at,
  });
  return { drafts, id: draft.client_submission_id };
}

/** A saved draft: Submit is never pressed. */
export async function createTestDraft(): Promise<void> {
  await createWithPhoto();
}

/** A pending submission: reviewed, Submit pressed, never sent. */
export async function createTestPendingSubmission(): Promise<void> {
  const { drafts, id } = await createWithPhoto();
  await drafts.update(id, { pipeline_state: "READY_TO_SUBMIT" });
  await drafts.recordSubmit(id, Crypto.randomUUID());
}

/** The test items still on the phone. Notes to the server for deleted ones are dropped: none can be sent. */
export async function listTestItems(): Promise<TestItem[]> {
  const drafts = await store();
  for (const id of await drafts.pendingServerCancellations()) await drafts.clearServerCancellation(id);
  const items: TestItem[] = [];
  for (const draft of await drafts.list()) {
    const status = localStatus(draft);
    if (status.kind === "received") continue;
    items.push({
      id: draft.client_submission_id,
      kind: status.kind,
      createdAt: draft.created_at,
      deletesAt: status.deletesAt,
      files: (await drafts.evidence(draft.client_submission_id)).length,
    });
  }
  return items;
}

export async function removeTestItems(): Promise<number> {
  const drafts = await store();
  const all = await drafts.list();
  for (const draft of all) await discardDraft(drafts, draft.client_submission_id);
  for (const id of await drafts.pendingServerCancellations()) await drafts.clearServerCancellation(id);
  return all.length;
}

/** What the store deleted when it last opened: shown after a restart. */
export async function lastOpenReport(): Promise<OpenReport> {
  return (await openLocalStore(RETENTION_TEST_OWNER)).report;
}
