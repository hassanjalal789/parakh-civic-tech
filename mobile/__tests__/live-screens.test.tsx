/**
 * Opt-in end-to-end check of the review, waiting and received screens against a running
 * backend (T-062): a ready draft → CIT-11 prepares it (API-130 to API-134) → the
 * targeted question answered (corrections route) → the texts confirmed (API-135) →
 * Submit through the real submission queue (API-140) → CIT-13 with the server's reference.
 *
 * Skipped unless both variables are set, as in live-report.test.ts:
 *   PARAKH_LIVE_API_BASE_URL — e.g. http://127.0.0.1:8765
 *   PARAKH_DEV_SMS_LOG       — the server's console log, where the SIMULATED SMS line appears
 * Run it against a throwaway server (`manage.py testserver`), not the development database.
 * Uses a designated synthetic number (DG-70); the files are synthetic.
 */
import { randomUUID } from "crypto";
import * as Crypto from "expo-crypto";
import { render, screen, userEvent, waitFor } from "@testing-library/react-native";

import { fetchCitizenProfile, requestCitizenOtp, verifyCitizenOtp } from "../src/api/auth";
import { fetchDraftStatus } from "../src/api/reporting";
import { usePrincipal } from "../src/auth/principal";
import i18n, { setLanguage } from "../src/i18n";
import { ReceivedScreen } from "../src/screens/ReceivedScreen";
import { ReviewScreen } from "../src/screens/ReviewScreen";
import { receivedReference } from "../src/services/received";
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
jest.mock("expo-audio", () => jest.requireActual("./fakes/expoAudio"));
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
jest.setTimeout(90_000);
const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);

beforeAll(() => {
  global.fetch = nodeFetch as unknown as typeof fetch;
  // Real random identifiers: the test double counts from 1 in every file, and a live server
  // keeps the drafts of earlier runs and other files.
  jest
    .spyOn(Crypto, "randomUUID")
    .mockImplementation(() => randomUUID() as `${string}-${string}-${string}-${string}-${string}`);
});

live("CIT-11 → CIT-13 against a running backend", () => {
  test("review, the targeted question, confirm, Submit — then the server's reference", async () => {
    await setLanguage("en");
    const e164 = "+923009990002"; // designated synthetic test number (DG-70)
    await requestCitizenOtp(e164, {
      ref: "live-screens-check",
      version: "citizen-consent-draft-1",
      locale: "en",
      selections: { account_creation_and_processing: true, voice_processing: true, sms_notification: false },
    });
    await verifyCitizenOtp(e164, simulatedCode(smsLog as string, "0002"));
    usePrincipal.getState().signedInAsCitizen();
    const { account_id } = await fetchCitizenProfile();

    resetFileSystem();
    resetSqlite();
    const db = memoryDatabase();
    await migrate(db);
    const drafts = draftRepository(db, account_id);
    const id = (await drafts.create()).client_submission_id;
    await drafts.update(id, { category: "water" });
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
      new Uint8Array([0xff, 0xd8, 0xff, 0xe0, ...new Array(6000).fill(9)]),
      "photo",
      "image/jpeg",
    );
    await capture("r.m4a", syntheticMp4({ seconds: 10, tracks: ["soun"] }), "voice_original", "audio/mp4");
    await drafts.setLocation(id, {
      kind: "coordinates",
      measured: {
        latitude: 31.52037,
        longitude: 74.358749,
        accuracyM: 8.2,
        fix: "current",
        measuredAt: new Date(Date.now() - 30_000).toISOString(),
      },
      reported: { latitude: 31.52037, longitude: 74.358749 },
    });

    const onReceived = jest.fn();
    const onQueued = jest.fn();
    await render(
      <ReviewScreen
        drafts={drafts}
        draftId={id}
        queue={submissionQueue(drafts)}
        onEdit={jest.fn()}
        onReceived={onReceived}
        onQueued={onQueued}
        pollMs={300}
      />,
    );
    const state = () => screen.getByTestId("review-state");
    // The SIMULATED processing marks one field low-confidence, so the question is asked.
    await waitFor(() => expect(state()).toHaveTextContent(t("review.state.question")), { timeout: 30_000 });
    expect(screen.getByText(t("review.simulated"))).toBeTruthy();
    const user = userEvent.setup();
    await user.press(screen.getByRole("button", { name: t("review.yesRight") }));
    await waitFor(() => expect(state()).toHaveTextContent(t("review.state.corrected")), { timeout: 15_000 });
    expect(screen.getByTestId("review-version")).toHaveTextContent(
      t("review.versionReplaces", { version: 2, previous: 1 }),
    );

    await user.press(screen.getByRole("button", { name: t("review.confirm") }));
    await waitFor(() => expect(state()).toHaveTextContent(t("review.state.ready")), { timeout: 15_000 });
    await user.press(screen.getByRole("button", { name: t("review.submit") }));
    await waitFor(() => expect(onReceived).toHaveBeenCalled(), { timeout: 15_000 });
    expect(onQueued).not.toHaveBeenCalled();

    const reference = onReceived.mock.calls[0]?.[0] as string;
    expect(reference).toMatch(/^PRK-/);
    expect(receivedReference(id)).toBe(reference); // what the CIT-13 route shows
    expect(await fetchDraftStatus(id)).toBe("submitted");
    expect(await drafts.get(id)).toBeNull();

    await render(<ReceivedScreen reportReference={reference} onHome={jest.fn()} />);
    expect(screen.getByTestId("report-reference")).toHaveTextContent(reference);
    expect(screen.getByText(t("received.track"))).toBeTruthy();
  });
});
