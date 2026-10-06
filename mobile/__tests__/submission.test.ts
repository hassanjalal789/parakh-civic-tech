/**
 * T-052: the submission queue (FR-PUB.28, FR-COMMON.11–13; DG-14, DG-65).
 *
 * The server is a small in-memory stand-in with the API-133, API-140 and
 * cancellation behaviour of docs/api/CITIZEN_REPORTING_CONTRACT.md: one report
 * per draft, the original report returned to any replay, and "already
 * submitted" for a cancellation that comes too late. Faults are injected to
 * lose a request before or after the server processed it. All data is synthetic.
 */
import { randomBytes } from "crypto";

import { ApiError, OfflineError } from "../src/api/errors";
import type { CancelOutcome, ReportCreated, ServerLifecycle } from "../src/api/reporting";
import { endCitizenSession } from "../src/auth/session";
import { BACKOFF_MS, RETRY_WINDOW_MS } from "../src/domain/submissionRules";
import { startSubmissionQueue, type SubmissionApi, submissionQueue } from "../src/services/submissionQueue";
import { ingestCapture } from "../src/storage/capture";
import { type DraftRepository, draftRepository } from "../src/storage/drafts";
import { purgeExpiredDrafts } from "../src/storage/lifetime";
import { draftMediaFile } from "../src/storage/media";
import { migrate } from "../src/storage/schema";
import { File, Paths, resetFileSystem } from "./fakes/fileSystem";
import { memoryDatabase, resetSqlite } from "./fakes/sqlite";

jest.mock("expo-file-system", () => jest.requireActual("./fakes/fileSystem"));
jest.mock("expo-sqlite", () => jest.requireActual("./fakes/sqlite"));

const ACCOUNT_A = "11111111-1111-4111-8111-111111111111"; // synthetic
const ACCOUNT_B = "22222222-2222-4222-8222-222222222222"; // synthetic
const START = new Date("2026-10-06T08:00:00.000Z");
const HOUR = 60 * 60 * 1000;

let now = START;
const clock = () => now;
function advance(ms: number): void {
  now = new Date(now.getTime() + ms);
}

type Fault = "lost_before" | "lost_after" | ApiError;

/** The server's side of one account's drafts. */
class FakeServer implements SubmissionApi {
  drafts = new Map<string, { lifecycle: ServerLifecycle; report: ReportCreated | null }>();
  reports: ReportCreated[] = [];
  calls: string[] = [];
  keys: string[] = [];
  faults: Fault[] = [];
  online = true;
  /** Let a test hold a submission, or a status check, in flight. */
  gate: Promise<void> | null = null;
  statusGate: Promise<void> | null = null;
  onSubmit: (() => Promise<void>) | null = null;

  register(id: string): void {
    this.drafts.set(id, { lifecycle: "active", report: null });
  }

  async fetchDraftStatus(id: string): Promise<ServerLifecycle> {
    this.calls.push("status");
    if (this.statusGate) await this.statusGate;
    if (!this.online) throw new OfflineError();
    return this.drafts.get(id)?.lifecycle ?? "absent";
  }

  async submitReport(id: string, key: string): Promise<ReportCreated> {
    this.calls.push("submit");
    this.keys.push(key);
    await this.onSubmit?.();
    if (this.gate) await this.gate;
    const fault = this.faults.shift();
    if (!this.online || fault === "lost_before") throw new OfflineError();
    if (fault instanceof ApiError) throw fault;
    const draft = this.drafts.get(id);
    if (!draft) throw new ApiError("E_NOT_FOUND", 404);
    if (draft.lifecycle === "cancelled") throw new ApiError("E_DRAFT_CANCELLED", 409);
    if (draft.lifecycle === "expired") throw new ApiError("E_DRAFT_EXPIRED", 409);
    if (!draft.report) {
      draft.report = {
        report_id: `0000f00d-0000-4000-8000-${String(this.reports.length + 1).padStart(12, "0")}`,
        report_reference: `PRK-SYN${this.reports.length + 1}`,
        state: "SUBMITTED",
        created_at: now.toISOString(),
      };
      draft.lifecycle = "submitted";
      this.reports.push(draft.report);
    }
    if (fault === "lost_after") throw new OfflineError(); // processed, but the answer never arrived
    return draft.report;
  }

  async cancelDraftOnServer(id: string): Promise<CancelOutcome> {
    this.calls.push("cancel");
    if (!this.online) throw new OfflineError();
    const draft = this.drafts.get(id);
    if (!draft) return { kind: "cancelled" };
    if (draft.report) {
      return {
        kind: "already_submitted",
        reportId: draft.report.report_id,
        reportReference: draft.report.report_reference,
      };
    }
    draft.lifecycle = "cancelled";
    return { kind: "cancelled" };
  }
}

let server: FakeServer;
let db: ReturnType<typeof memoryDatabase>;
let drafts: DraftRepository;

/** A reviewed draft with one photo, known to the server. */
async function ready(repository: DraftRepository = drafts): Promise<{ id: string; fileName: string }> {
  const draft = await repository.create();
  const id = draft.client_submission_id;
  const file = new File(Paths.cache, `camera-${id}.jpg`);
  file.write(new Uint8Array(randomBytes(512)));
  const row = await ingestCapture(repository, id, {
    uri: file.uri,
    kind: "photo",
    mimeType: "image/jpeg",
    capturedAt: now.toISOString(),
  });
  await repository.update(id, { pipeline_state: "READY_TO_SUBMIT" });
  server.register(id);
  return { id, fileName: row.file_name };
}

beforeEach(async () => {
  resetFileSystem();
  resetSqlite();
  now = START;
  server = new FakeServer();
  db = memoryDatabase();
  await migrate(db);
  drafts = draftRepository(db, ACCOUNT_A, clock);
});

describe("nothing is submitted unless the reporter presses Submit (DG-65)", () => {
  test("a reviewed draft is never sent on its own, and is deleted when its lifetime ends", async () => {
    const queue = submissionQueue(drafts, server, clock);
    const { id, fileName } = await ready();
    expect(await queue.retryNow(id)).toEqual({ kind: "refused", reason: "not_ready" }); // Submit never pressed
    for (let h = 0; h < 48; h += 6) {
      await queue.run();
      advance(6 * HOUR);
    }
    expect(server.calls.filter((c) => c === "submit")).toEqual([]);
    expect(await purgeExpiredDrafts(db, now)).toBe(1);
    expect(draftMediaFile(fileName).exists).toBe(false);
    expect(await queue.retryNow(id)).toEqual({ kind: "refused", reason: "unknown_draft" });
    expect(server.calls.filter((c) => c === "submit")).toEqual([]);
  });

  test("a draft that is not ready cannot be submitted, and nothing is sent", async () => {
    const queue = submissionQueue(drafts, server, clock);
    const { client_submission_id: id } = await drafts.create();
    expect(await queue.requestSubmission(id)).toEqual({ kind: "refused", reason: "not_ready" });
    expect(server.calls).toEqual([]);
    expect((await drafts.get(id))?.submission_requested_at).toBeNull();
  });

  test("Submit is recorded, with its one key, before the first request leaves the phone", async () => {
    const queue = submissionQueue(drafts, server, clock);
    const { id } = await ready();
    let atSend: Awaited<ReturnType<DraftRepository["get"]>> = null;
    server.onSubmit = async () => {
      atSend = await drafts.get(id);
    };

    await queue.requestSubmission(id);
    expect(atSend).toMatchObject({
      submission_requested_at: START.toISOString(),
      first_submission_attempt_at: START.toISOString(),
      submission_outcome: "unknown", // an interruption now is treated as "may have arrived"
      attempts: 1,
    });
    expect(atSend!.submission_key).toMatch(/^[0-9a-f-]{36}$/);
    expect(server.keys).toEqual([atSend!.submission_key]);
  });
});

describe("a confirmed submission", () => {
  test("returns the reference, deletes the local copy and its files, and makes exactly one report", async () => {
    const queue = submissionQueue(drafts, server, clock);
    const { id, fileName } = await ready();

    const result = await queue.requestSubmission(id);
    expect(result).toEqual({
      kind: "submitted",
      reportId: server.reports[0]?.report_id,
      reportReference: "PRK-SYN1",
    });
    expect(await drafts.get(id)).toBeNull();
    expect(draftMediaFile(fileName).exists).toBe(false);
    expect(server.reports).toHaveLength(1);
    await queue.run();
    expect(server.calls).toEqual(["submit"]); // retries stop on confirmed success
  });
});

describe("a lost response is never mistaken for an unsubmitted draft (DG-65)", () => {
  test("the status is checked first, and the replay with the same key returns the original report", async () => {
    const queue = submissionQueue(drafts, server, clock);
    const { id } = await ready();
    server.faults = ["lost_after"];

    const first = await queue.requestSubmission(id);
    expect(first).toMatchObject({ kind: "retrying", outcome: "unknown" });
    expect(await drafts.get(id)).toMatchObject({ submission_outcome: "unknown" }); // kept: receipt not confirmed
    advance(BACKOFF_MS[0]);
    await queue.run();

    expect(server.calls).toEqual(["submit", "status", "submit"]);
    expect(new Set(server.keys).size).toBe(1);
    expect(server.reports).toHaveLength(1);
    expect(await drafts.get(id)).toBeNull();
  });

  test("after an interruption mid-request, a fresh start asks the server before sending again", async () => {
    const { id } = await ready();
    const key = "0000eeee-0000-4000-8000-000000000001";
    await drafts.recordSubmit(id, key);
    await drafts.update(id, {
      submission_outcome: "unknown",
      attempts: 1,
      first_submission_attempt_at: START.toISOString(),
      next_attempt_at: null,
    });
    await server.submitReport(id, key); // the request had arrived before the phone died
    server.calls = [];

    await submissionQueue(drafts, server, clock).run();
    expect(server.calls).toEqual(["status", "submit"]);
    expect(server.keys.slice(-1)).toEqual([key]);
    expect(server.reports).toHaveLength(1);
    expect(await drafts.get(id)).toBeNull();
  });

  test("a definite refusal to process is retried without a status check, with the same key", async () => {
    const queue = submissionQueue(drafts, server, clock);
    const { id } = await ready();
    server.faults = [new ApiError("E_RATE_LIMITED", 429, { retry_after_seconds: 120 })];

    const first = await queue.requestSubmission(id);
    expect(first).toEqual({
      kind: "retrying",
      outcome: "failed",
      code: "E_RATE_LIMITED",
      nextAttemptAt: new Date(START.getTime() + 120_000).toISOString(),
    });
    advance(119_000);
    await queue.run();
    expect(server.calls).toEqual(["submit"]); // not due yet
    advance(1_000);
    await queue.run();
    expect(server.calls).toEqual(["submit", "submit"]);
    expect(new Set(server.keys).size).toBe(1);
    expect(server.reports).toHaveLength(1);
  });
});

describe("automatic retries for 48 hours from the first attempt (DG-14)", () => {
  test("the waits grow — 30 s, 1, 2, 5, 10, then every 30 minutes — while the phone is offline", async () => {
    const queue = submissionQueue(drafts, server, clock);
    const { id } = await ready();
    server.online = false;
    await queue.requestSubmission(id);

    const waits: number[] = [];
    for (let i = 0; i < 7; i++) {
      const due = Date.parse((await drafts.get(id))?.next_attempt_at as string);
      waits.push(due - now.getTime());
      now = new Date(due);
      await queue.run();
    }
    expect(waits).toEqual([30_000, 60_000, 120_000, 300_000, 600_000, 1_800_000, 1_800_000]);
  });

  test("then retries stop, the draft is kept and labelled not confirmed, and the server is checked before another attempt", async () => {
    const queue = submissionQueue(drafts, server, clock);
    const { id } = await ready();
    server.online = false;
    await queue.requestSubmission(id);
    expect(RETRY_WINDOW_MS).toBe(48 * HOUR);
    const end = START.getTime() + 48 * HOUR;

    for (let guard = 0; guard < 500; guard++) {
      const draft = await drafts.get(id);
      if (draft?.submission_outcome === "not_confirmed") break;
      const due = Date.parse(draft?.next_attempt_at as string);
      expect(due).toBeLessThanOrEqual(end); // never scheduled past the window
      now = new Date(due);
      await queue.run();
    }
    expect(now.getTime()).toBe(end);
    expect(await drafts.get(id)).toMatchObject({
      submission_outcome: "not_confirmed",
      next_attempt_at: null,
    });

    const calls = server.calls.length;
    advance(6 * HOUR);
    await queue.run();
    expect(server.calls).toHaveLength(calls); // no automatic attempt after the window
    expect(await purgeExpiredDrafts(db, now)).toBe(0); // Submit was pressed: kept past its 2 days (TBD-M15)
    expect(await drafts.get(id)).not.toBeNull();

    server.online = true;
    server.drafts.get(id)!.report = null; // nothing ever arrived
    const retried = await queue.retryNow(id);
    expect(server.calls.slice(calls)).toEqual(["status", "submit"]); // checked before the new attempt
    expect(retried).toMatchObject({ kind: "submitted", reportReference: "PRK-SYN1" });
  });

  test("after the window, a report that did arrive is found by the check, not created again", async () => {
    const queue = submissionQueue(drafts, server, clock);
    const { id } = await ready();
    server.faults = ["lost_after"];
    await queue.requestSubmission(id);
    server.online = false;
    now = new Date(START.getTime() + 48 * HOUR - 1);
    await queue.run();
    expect((await drafts.get(id))?.submission_outcome).toBe("unknown"); // still inside the window
    now = new Date(START.getTime() + 48 * HOUR);
    await queue.run();
    expect((await drafts.get(id))?.submission_outcome).toBe("not_confirmed");

    server.online = true;
    expect(await queue.requestSubmission(id)).toMatchObject({
      kind: "submitted",
      reportReference: "PRK-SYN1",
    });
    expect(server.reports).toHaveLength(1);
  });
});

describe("cancellation stops retries (DG-55, DG-65)", () => {
  test("a draft that was never submitted is deleted at once, and the server is asked to drop its copy", async () => {
    const queue = submissionQueue(drafts, server, clock);
    const { id, fileName } = await ready();
    expect(await queue.cancel(id)).toEqual({ kind: "cancelled" });
    expect(await drafts.get(id)).toBeNull();
    expect(draftMediaFile(fileName).exists).toBe(false);
    expect(server.calls).toEqual(["cancel"]);
    expect(server.drafts.get(id)?.lifecycle).toBe("cancelled");
    expect(await drafts.pendingServerCancellations()).toEqual([]);
  });

  test("offline, the local copy still goes at once; the note to the server waits for a connection", async () => {
    const queue = submissionQueue(drafts, server, clock);
    const { id } = await ready();
    server.online = false;
    expect(await queue.cancel(id)).toEqual({ kind: "cancelled" });
    expect(await drafts.get(id)).toBeNull();
    expect(await drafts.pendingServerCancellations()).toEqual([id]);

    server.online = true;
    await queue.run();
    expect(server.drafts.get(id)?.lifecycle).toBe("cancelled");
    expect(await drafts.pendingServerCancellations()).toEqual([]);
  });

  test("after Submit, retries stop at once and the local copy goes only when the server answers", async () => {
    const queue = submissionQueue(drafts, server, clock);
    const { id } = await ready();
    server.online = false;
    await queue.requestSubmission(id);
    expect(await queue.cancel(id)).toEqual({ kind: "cancel_pending" });
    expect(await drafts.get(id)).not.toBeNull(); // nothing deleted without an answer

    const submits = server.calls.filter((c) => c === "submit").length;
    advance(HOUR);
    await queue.run();
    expect(server.calls.filter((c) => c === "submit")).toHaveLength(submits); // no attempt after cancel

    server.online = true;
    await queue.run();
    expect(await drafts.get(id)).toBeNull();
    expect(server.drafts.get(id)?.lifecycle).toBe("cancelled");
    expect(server.reports).toEqual([]);
  });

  test("cancel during a submission in flight: the report exists, so it is shown — never a false cancellation", async () => {
    const queue = submissionQueue(drafts, server, clock);
    const { id } = await ready();
    let release!: () => void;
    server.gate = new Promise((r) => {
      release = r;
    });

    const submitting = queue.requestSubmission(id);
    await new Promise((r) => setTimeout(r, 5));
    const cancelling = queue.cancel(id);
    release();
    const [submitted, cancelled] = await Promise.all([submitting, cancelling]);

    expect(submitted).toMatchObject({ kind: "submitted", reportReference: "PRK-SYN1" });
    expect(cancelled).toMatchObject({ kind: "already_submitted", reportReference: "PRK-SYN1" });
    expect(server.drafts.get(id)?.lifecycle).toBe("submitted");
    expect(server.reports).toHaveLength(1);
  });

  test("a cancel that arrives during the status check stops the attempt before anything is sent", async () => {
    const queue = submissionQueue(drafts, server, clock);
    const { id } = await ready();
    server.faults = ["lost_before"];
    await queue.requestSubmission(id);
    let release!: () => void;
    server.statusGate = new Promise((r) => {
      release = r;
    });
    advance(BACKOFF_MS[0]);
    const retrying = queue.retryNow(id);
    await new Promise((r) => setTimeout(r, 5)); // the attempt is waiting for the status answer
    const cancelling = queue.cancel(id);
    release();

    expect(await retrying).toEqual({ kind: "cancel_pending" });
    expect(await cancelling).toEqual({ kind: "cancelled" });
    expect(server.calls).toEqual(["submit", "status", "cancel"]); // no second submission
    expect(server.reports).toEqual([]);
    expect(await drafts.get(id)).toBeNull();
  });

  test("cancel after a lost response: the server says it was already submitted, and the report is kept", async () => {
    const queue = submissionQueue(drafts, server, clock);
    const { id } = await ready();
    server.faults = ["lost_after"];
    await queue.requestSubmission(id);

    expect(await queue.cancel(id)).toEqual({
      kind: "already_submitted",
      reportId: server.reports[0]?.report_id,
      reportReference: "PRK-SYN1",
    });
    expect(await drafts.get(id)).toBeNull();
    expect(server.drafts.get(id)?.lifecycle).toBe("submitted");
  });

  test("a draft found cancelled on the server stops, and its local copy is deleted", async () => {
    const queue = submissionQueue(drafts, server, clock);
    const { id } = await ready();
    server.faults = ["lost_before"];
    await queue.requestSubmission(id);
    server.drafts.get(id)!.lifecycle = "cancelled"; // cancelled by the same account elsewhere
    advance(BACKOFF_MS[0]);
    await queue.run();
    expect(server.calls).toEqual(["submit", "status"]);
    expect(await drafts.get(id)).toBeNull();
  });
});

describe("duplicates and isolation", () => {
  test("two presses of Submit send one request", async () => {
    const queue = submissionQueue(drafts, server, clock);
    const { id } = await ready();
    let release!: () => void;
    server.gate = new Promise((r) => {
      release = r;
    });
    const both = Promise.all([queue.requestSubmission(id), queue.requestSubmission(id)]);
    await new Promise((r) => setTimeout(r, 5));
    release();
    const [one, two] = await both;
    expect(one).toEqual(two);
    expect(server.calls).toEqual(["submit"]);
    expect(server.reports).toHaveLength(1);
  });

  test("another account's queue cannot submit, retry or cancel the draft, and its runs never touch it", async () => {
    const { id } = await ready();
    await submissionQueue(drafts, server, clock).requestSubmission(id);
    server.calls = [];
    const other = submissionQueue(draftRepository(db, ACCOUNT_B, clock), server, clock);
    const { id: mine } = await ready();

    expect(await other.requestSubmission(mine)).toEqual({ kind: "refused", reason: "unknown_draft" });
    expect(await other.retryNow(mine)).toEqual({ kind: "refused", reason: "unknown_draft" });
    expect(await other.cancel(mine)).toEqual({ kind: "refused", reason: "unknown_draft" });
    await other.run();
    expect(server.calls).toEqual([]);
    expect(await drafts.get(mine)).toMatchObject({
      submission_requested_at: null,
      cancel_requested_at: null,
    });
  });
});

describe("answers only the reporter can act on", () => {
  test("a rejected submission waits for the reporter; Submit again after the fix reuses the key", async () => {
    const queue = submissionQueue(drafts, server, clock);
    const { id } = await ready();
    server.faults = [new ApiError("E_RENDERING_NOT_CONFIRMED", 422)];
    expect(await queue.requestSubmission(id)).toEqual({
      kind: "needs_action",
      outcome: "rejected",
      code: "E_RENDERING_NOT_CONFIRMED",
    });
    advance(HOUR);
    await queue.run();
    expect(server.calls).toEqual(["submit"]); // not retried automatically

    expect(await queue.requestSubmission(id)).toMatchObject({ kind: "submitted" });
    expect(new Set(server.keys).size).toBe(1);
  });

  test("a server that no longer holds the uploads asks for them again, and nothing is retried meanwhile", async () => {
    const queue = submissionQueue(drafts, server, clock);
    const { id } = await ready();
    server.drafts.get(id)!.lifecycle = "expired";
    expect(await queue.requestSubmission(id)).toEqual({
      kind: "needs_action",
      outcome: "needs_upload",
      code: "E_DRAFT_EXPIRED",
    });
    advance(HOUR);
    await queue.run();
    expect(server.calls).toEqual(["submit"]);
    expect(await drafts.get(id)).toMatchObject({
      pipeline_state: "SUBMISSION_FAILED",
      submission_outcome: "needs_upload",
    });
  });
});

describe("running the queue", () => {
  test("a scheduled retry runs at its time, and the queue stops when the session ends", async () => {
    jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate", "queueMicrotask"] });
    try {
      const queue = submissionQueue(drafts, server, clock);
      const { id } = await ready();
      server.faults = ["lost_before"];
      await queue.requestSubmission(id);
      const stop = startSubmissionQueue(queue, clock);
      await jest.advanceTimersByTimeAsync(0);
      expect(server.calls).toEqual(["submit"]);

      advance(BACKOFF_MS[0]);
      await jest.advanceTimersByTimeAsync(BACKOFF_MS[0]);
      expect(server.calls).toEqual(["submit", "status", "submit"]);
      expect(await drafts.get(id)).toBeNull();

      await endCitizenSession("session_expired");
      expect(queue.stopped).toBe(true);
      const { id: later } = await ready();
      expect(await queue.requestSubmission(later)).toEqual({ kind: "refused", reason: "stopped" });
      expect((await drafts.get(later))?.submission_requested_at).toBeNull();
      await queue.run();
      expect(server.calls).toEqual(["submit", "status", "submit"]);
      stop();
    } finally {
      jest.useRealTimers();
    }
  });
});
