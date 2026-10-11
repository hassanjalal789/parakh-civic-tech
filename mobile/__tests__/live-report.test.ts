/// <reference types="node" />
/**
 * Opt-in end-to-end check of the citizen report flow against a running backend (T-052):
 * sign-in → a draft on the phone (category, photo, recording, location) → API-130 →
 * evidence upload (API-131/132/133) → the server's SIMULATED processing → API-134 →
 * confirmation (API-135, the phone's own hash check) → Submit through the submission
 * queue (API-140) → a report reference.
 *
 * Skipped unless both variables are set, as in live-backend.test.ts:
 *   PARAKH_LIVE_API_BASE_URL — e.g. http://127.0.0.1:8765
 *   PARAKH_DEV_SMS_LOG       — the server's console log, where the SIMULATED SMS line appears
 * Run it against a throwaway server (`manage.py testserver`), not the development database.
 * Uses a designated synthetic number (DG-70); the files are synthetic.
 */
import { randomUUID } from "crypto";
import * as Crypto from "expo-crypto";
import { fetchCitizenProfile, requestCitizenOtp, verifyCitizenOtp } from "../src/api/auth";
import { fetchDraft, fetchDraftStatus } from "../src/api/reporting";
import { usePrincipal } from "../src/auth/principal";
import {
  checkRendering,
  confirmReviewed,
  PIPELINE_API as API,
  prepareForReview,
  submitConfirmed,
} from "../src/services/reportPipeline";
import { submissionQueue } from "../src/services/submissionQueue";
import { ingestCapture } from "../src/storage/capture";
import { draftRepository } from "../src/storage/drafts";
import { migrate } from "../src/storage/schema";
import { File, Paths, resetFileSystem } from "./fakes/fileSystem";
import { nodeFetch, simulatedCode } from "./fakes/liveHttp";
import { syntheticMp4 } from "./fakes/mp4";
import { memoryDatabase, resetSqlite } from "./fakes/sqlite";

jest.mock("expo-file-system", () => jest.requireActual("./fakes/fileSystem"));
jest.mock("expo-sqlite", () => jest.requireActual("./fakes/sqlite"));
jest.mock("../src/config", () => ({
  config: {
    variant: "development",
    apiBaseUrl: process.env.PARAKH_LIVE_API_BASE_URL,
    consentVersion: "citizen-consent-draft-1",
    otpLength: 6,
  },
  assertTransportAllowed: () => undefined,
}));

const base = process.env.PARAKH_LIVE_API_BASE_URL;
const smsLog = process.env.PARAKH_DEV_SMS_LOG;
const live = base && smsLog ? describe : describe.skip;
jest.setTimeout(60_000);

beforeAll(() => {
  global.fetch = nodeFetch as unknown as typeof fetch;
  // Real random identifiers: the test double counts from 1 in every file, and a live server
  // keeps the drafts of earlier runs and other files.
  jest
    .spyOn(Crypto, "randomUUID")
    .mockImplementation(() => randomUUID() as `${string}-${string}-${string}-${string}-${string}`);
});

live("the citizen report flow against a running backend", () => {
  test("draft → upload → processing → confirmation → Submit → a report reference", async () => {
    const e164 = "+923009990001"; // designated synthetic test number (DG-70)
    await requestCitizenOtp(e164, {
      ref: "live-report-check",
      version: "citizen-consent-draft-1",
      locale: "en",
      selections: { account_creation_and_processing: true, voice_processing: true, sms_notification: false },
    });
    await verifyCitizenOtp(e164, simulatedCode(smsLog as string, "0001"));
    usePrincipal.getState().signedInAsCitizen();
    const { account_id } = await fetchCitizenProfile();

    resetFileSystem();
    resetSqlite();
    const db = memoryDatabase();
    await migrate(db);
    const drafts = draftRepository(db, account_id);
    const id = (await drafts.create()).client_submission_id;
    await drafts.update(id, { category: "drainage" });
    const capture = async (
      name: string,
      bytes: Uint8Array,
      kind: "photo" | "voice_original",
      mimeType: string,
    ) => {
      const file = new File(Paths.cache, name);
      file.write(bytes);
      await ingestCapture(drafts, id, {
        uri: file.uri,
        kind,
        mimeType,
        capturedAt: new Date(Date.now() - 60_000).toISOString(),
      });
    };
    await capture(
      "p.jpg",
      new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(6000).fill(7)]),
      "photo",
      "image/jpeg",
    );
    await capture("r.m4a", syntheticMp4({ seconds: 12, tracks: ["soun"] }), "voice_original", "audio/mp4");
    await drafts.setLocation(id, {
      kind: "coordinates",
      measured: {
        latitude: 31.52037,
        longitude: 74.358749,
        accuracyM: 9.5,
        fix: "current",
        measuredAt: new Date(Date.now() - 30_000).toISOString(),
      },
      reported: { latitude: 31.520415, longitude: 74.358749 }, // moved 5 m north
    });

    let prepared = await prepareForReview(drafts, id, API);
    for (let i = 0; prepared.kind === "processing" && i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      prepared = await checkRendering(id, API);
    }
    expect(prepared.kind).toBe("review");
    if (prepared.kind !== "review") return;
    expect(prepared.rendering.simulated).toBe(true); // development: the AI is SIMULATED

    const draftOnServer = await fetchDraft(id);
    expect(draftOnServer?.evidence.map((e) => e.status)).toEqual(["COMPLETE", "COMPLETE"]);

    expect(await confirmReviewed(drafts, id, prepared.rendering, randomUUID(), API)).toEqual({
      kind: "confirmed",
    });
    const result = await submitConfirmed(drafts, id, submissionQueue(drafts));
    expect(result).toMatchObject({ kind: "submitted" });
    if (result.kind === "submitted") expect(result.reportReference).toMatch(/^PRK-/);
    expect(await fetchDraftStatus(id)).toBe("submitted");
    expect(await drafts.get(id)).toBeNull(); // the phone's copy is gone once the report exists
  });
});
