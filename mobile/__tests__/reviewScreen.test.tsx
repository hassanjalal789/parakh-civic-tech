/**
 * T-062 — CIT-11, check the report and submit it (FR-PUB.14–FR-PUB.22, FR-PUB.26,
 * FR-PUB.27; DG-62, DG-65). The server is an in-memory stand-in (fakes/pipelineServer);
 * the draft store is the fake SQLite; files are synthetic.
 */
import { fireEvent, render, screen, userEvent, waitFor, within } from "@testing-library/react-native";
import { randomBytes } from "crypto";
import { AccessibilityInfo } from "react-native";

import { ApiError } from "../src/api/errors";
import i18n, { setLanguage } from "../src/i18n";
import { ReviewScreen } from "../src/screens/ReviewScreen";
import { ingestCapture } from "../src/storage/capture";
import { draftRepository, type DraftRepository } from "../src/storage/drafts";
import { migrate } from "../src/storage/schema";
import { resetExpoAudio } from "./fakes/expoAudio";
import { File, Paths, resetFileSystem } from "./fakes/fileSystem";
import { syntheticMp4 } from "./fakes/mp4";
import { FakeServer, TEXTS } from "./fakes/pipelineServer";
import { memoryDatabase, resetSqlite } from "./fakes/sqlite";

jest.mock("expo-file-system", () => jest.requireActual("./fakes/fileSystem"));
jest.mock("expo-sqlite", () => jest.requireActual("./fakes/sqlite"));
jest.mock("expo-audio", () => jest.requireActual("./fakes/expoAudio"));

const ACCOUNT = "11111111-1111-4111-8111-111111111111"; // synthetic
const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);
const GPS = {
  kind: "coordinates" as const,
  measured: {
    latitude: 31.52037,
    longitude: 74.358749,
    accuracyM: 12,
    fix: "current" as const,
    measuredAt: new Date(Date.now() - 60_000).toISOString(),
  },
  reported: { latitude: 31.52037, longitude: 74.358749 },
};

let drafts: DraftRepository;
let id: string;
let server: FakeServer;
let announce: jest.SpyInstance;
let queue: { requestSubmission: jest.Mock };
let handlers: { onEdit: jest.Mock; onReceived: jest.Mock; onQueued: jest.Mock };

async function capture(name: string, bytes: Uint8Array, kind: "photo" | "voice_original") {
  const file = new File(Paths.cache, name);
  file.write(bytes);
  await ingestCapture(drafts, id, {
    uri: file.uri,
    kind,
    mimeType: kind === "photo" ? "image/jpeg" : "audio/mp4",
    capturedAt: new Date(Date.now() - 120_000).toISOString(),
  });
}

async function readyVoiceDraft() {
  await drafts.update(id, { category: "drainage" });
  await capture("p.jpg", new Uint8Array([0xff, 0xd8, 0xff, ...randomBytes(3000)]), "photo");
  await capture("r.m4a", syntheticMp4({ seconds: 8, tracks: ["soun"] }), "voice_original");
  await drafts.setLocation(id, GPS);
}

const show = () =>
  render(
    <ReviewScreen
      drafts={drafts}
      draftId={id}
      queue={queue}
      api={server}
      pollMs={10}
      retryMs={20}
      {...handlers}
    />,
  );

const stateIs = (key: string) =>
  waitFor(() => expect(screen.getByTestId("review-state")).toHaveTextContent(t(key)));

beforeEach(async () => {
  await setLanguage("en");
  resetFileSystem();
  resetSqlite();
  resetExpoAudio();
  const db = memoryDatabase();
  await migrate(db);
  drafts = draftRepository(db, ACCOUNT);
  id = (await drafts.create()).client_submission_id;
  server = new FakeServer();
  queue = {
    requestSubmission: jest.fn(async () => ({
      kind: "submitted" as const,
      reportId: "r-1",
      reportReference: "PRK-7Q4M-2KX9",
    })),
  };
  handlers = { onEdit: jest.fn(), onReceived: jest.fn(), onQueued: jest.fn() };
  announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

describe("CIT-11: before the texts exist", () => {
  test("missing parts are named, each with a way to add it, and nothing is sent", async () => {
    await drafts.update(id, { category: "road" });
    await show();
    await waitFor(() => expect(screen.getByText(t("review.missingBody"))).toBeTruthy());
    await userEvent
      .setup()
      .press(screen.getByRole("button", { name: t("review.add", { part: t("review.missing.photo") }) }));
    expect(handlers.onEdit).toHaveBeenCalledWith("evidence");
    expect(
      screen.getByRole("button", { name: t("review.add", { part: t("review.missing.location") }) }),
    ).toBeTruthy();
    expect(server.opened).toHaveLength(0);
  });

  test("named, announced states: processing, then the texts — never a bare spinner (FR-PUB.15)", async () => {
    await readyVoiceDraft();
    server.status = "PROCESSING";
    await show();
    await stateIs("review.state.processing");
    expect(screen.getByText(t("review.processingBody"))).toBeTruthy();
    server.status = "COMPLETED";
    await stateIs("review.state.question"); // the fake marks "location" low-confidence
    expect(announce).toHaveBeenCalledWith(t("review.state.processing"));
    expect(announce).toHaveBeenCalledWith(t("review.state.question"));
  });

  test("offline: waiting for connection, and tried again by itself", async () => {
    await readyVoiceDraft();
    server.offline = true;
    await show();
    await stateIs("review.state.waiting");
    expect(screen.getByText(t("review.waitingBody"))).toBeTruthy();
    server.offline = false;
    await stateIs("review.state.question");
  });

  test("failure keeps everything and invents no text; try again or record again (FR-PUB.20)", async () => {
    await readyVoiceDraft();
    server.status = "FAILED";
    await show();
    await stateIs("review.state.failed");
    expect(screen.getByText(t("review.failedBody"))).toBeTruthy();
    expect(screen.queryByTestId("review-text-en")).toBeNull();
    await userEvent.setup().press(screen.getByRole("button", { name: t("review.reRecord") }));
    expect(handlers.onEdit).toHaveBeenCalledWith("description");
    expect(await drafts.evidence(id)).toHaveLength(2);
  });

  test("held for a person: no texts shown, nothing to confirm", async () => {
    await readyVoiceDraft();
    server.status = "REVIEW_REQUIRED";
    await show();
    await stateIs("review.state.held");
    expect(screen.queryByRole("button", { name: t("review.confirm") })).toBeNull();
  });
});

describe("CIT-11: the review (FR-PUB.16, FR-PUB.17, FR-PUB.26)", () => {
  test("three texts, each marked AI-generated, seen and heard; the version; simulated said; the summary", async () => {
    await readyVoiceDraft();
    await show();
    await stateIs("review.state.question");
    for (const key of ["transcription", "ur", "en"] as const) {
      expect(screen.getByTestId(`review-marker-${key}`)).toHaveTextContent(t("review.aiGenerated"));
      const value = { transcription: TEXTS.transcription, ur: TEXTS.ur, en: TEXTS.en }[key];
      expect(
        within(screen.getByTestId(`review-text-${key}`)).getByText(value).props.accessibilityLabel,
      ).toMatch(new RegExp(`^${t("review.aiGenerated")}\\.`));
    }
    // Never called the reporter's exact words.
    expect(screen.getByText(t("review.transcription"))).toBeTruthy();
    expect(screen.getByTestId("review-version")).toHaveTextContent(t("review.version", { version: 1 }));
    expect(screen.getByText(t("review.simulated"))).toBeTruthy();
    expect(screen.getByText(t("category.drainage"))).toBeTruthy();
    expect(screen.getByLabelText(t("review.photoAlt", { n: 1 }))).toBeTruthy();
    expect(
      screen.getByText(t("review.locationCoordinates", { latitude: "31.520370", longitude: "74.358749" })),
    ).toBeTruthy();
    expect(screen.getByText(t("review.locationAccuracy", { metres: "12" }))).toBeTruthy();
    expect(screen.getAllByRole("button", { name: t("review.playOriginal") }).length).toBeGreaterThan(0);

    await userEvent.setup().press(screen.getByRole("button", { name: t("review.readAloud") }));
    const spoken = announce.mock.calls.map((c) => String(c[0])).find((s) => s.includes(TEXTS.ur)) ?? "";
    for (const part of [t("category.drainage"), TEXTS.transcription, TEXTS.en, t("review.aiGenerated")]) {
      expect(spoken).toContain(part);
    }
  });

  test("each part can be changed from here", async () => {
    await readyVoiceDraft();
    await show();
    await stateIs("review.state.question");
    const user = userEvent.setup();
    await user.press(
      screen.getByRole("button", { name: t("review.changeLabel", { part: t("review.location") }) }),
    );
    await user.press(
      screen.getByRole("button", { name: t("review.changeLabel", { part: t("review.category") }) }),
    );
    expect(handlers.onEdit.mock.calls).toEqual([["location"], ["category"]]);
  });
});

describe("CIT-11: questions and corrections (FR-PUB.18, FR-PUB.19)", () => {
  test("a low-confidence field is asked about, with the recording replayable; 'yes' is a new version to check", async () => {
    await readyVoiceDraft();
    await show();
    await stateIs("review.state.question");
    expect(
      screen.getByText(t("review.questionAsk", { field: t("review.field.location"), value: "location" })),
    ).toBeTruthy();
    await userEvent.setup().press(screen.getByRole("button", { name: t("review.yesRight") }));
    await stateIs("review.state.corrected");
    expect(server.corrections[0]).toMatchObject({
      corrected_fields: ["location"],
      transcription: TEXTS.transcription,
    });
    expect(screen.getByTestId("review-version")).toHaveTextContent(t("review.version", { version: 2 }));
    expect(screen.queryByTestId("review-question")).toBeNull();
  });

  test("a corrected text becomes the reporter's own, in a new version", async () => {
    await readyVoiceDraft();
    server.lowConfidence.clear();
    await show();
    await stateIs("review.state.check");
    const user = userEvent.setup();
    await user.press(screen.getAllByRole("button", { name: t("review.correct") })[2]!); // English
    await fireEvent.changeText(screen.getByTestId("review-input-en"), "Water pipe burst near the school");
    await user.press(screen.getByRole("button", { name: t("review.saveCorrection") }));
    await stateIs("review.state.corrected");
    expect(server.corrections[0]).toMatchObject({ english_rendering: "Water pipe burst near the school" });
    expect(screen.getByTestId("review-marker-en")).toHaveTextContent(t("review.yours"));
    expect(screen.getByTestId("review-marker-ur")).toHaveTextContent(t("review.aiGenerated"));
  });

  test("an empty correction cannot be saved", async () => {
    await readyVoiceDraft();
    server.lowConfidence.clear();
    await show();
    await stateIs("review.state.check");
    await userEvent.setup().press(screen.getAllByRole("button", { name: t("review.correct") })[1]!);
    await fireEvent.changeText(screen.getByTestId("review-input-ur"), "   ");
    expect(screen.getByText(t("review.emptyCorrection"))).toBeTruthy();
    expect(screen.getByRole("button", { name: t("review.saveCorrection") })).toBeDisabled();
  });

  test("a typed report: its own text is labelled as such and changed on CIT-09, not here", async () => {
    await drafts.update(id, {
      category: "road",
      description_mode: "typed",
      typed_description: TEXTS.transcription,
    });
    await capture("p.jpg", new Uint8Array([0xff, 0xd8, 0xff, ...randomBytes(3000)]), "photo");
    await drafts.setLocation(id, GPS);
    server.lowConfidence.clear();
    await show();
    await stateIs("review.state.check");
    expect(screen.getByText(t("review.transcriptionTyped"))).toBeTruthy();
    expect(screen.getAllByRole("button", { name: t("review.correct") })).toHaveLength(2); // Urdu and English only
  });
});

describe("CIT-11: confirm, then Submit (FR-PUB.21, FR-PUB.22, DG-65)", () => {
  test("confirming sends this exact version; nothing is submitted until Submit; then CIT-13", async () => {
    await readyVoiceDraft();
    server.lowConfidence.clear();
    await show();
    await stateIs("review.state.check");
    const user = userEvent.setup();
    await user.press(screen.getByRole("button", { name: t("review.confirm") }));
    await stateIs("review.state.ready");
    expect(server.confirmations).toHaveLength(1);
    expect(server.confirmations[0]?.body.rendering_version).toBe(1);
    expect(queue.requestSubmission).not.toHaveBeenCalled();
    expect(screen.getByText(t("review.submitIntro"))).toBeTruthy();

    await user.press(screen.getByRole("button", { name: t("review.submit") }));
    await waitFor(() => expect(handlers.onReceived).toHaveBeenCalledWith("PRK-7Q4M-2KX9"));
    expect(queue.requestSubmission).toHaveBeenCalledWith(id);
    expect((await drafts.get(id))?.pipeline_state).toBe("READY_TO_SUBMIT");
  });

  test("an out-of-date version is fetched again and shown — never confirmed blindly", async () => {
    await readyVoiceDraft();
    server.lowConfidence.clear();
    await show();
    await stateIs("review.state.check");
    server.refuseConfirm = new ApiError("E_RENDERING_SUPERSEDED", 409);
    server.version = 2;
    await userEvent.setup().press(screen.getByRole("button", { name: t("review.confirm") }));
    await stateIs("review.state.outdated");
    expect(screen.getByTestId("review-version")).toHaveTextContent(t("review.version", { version: 2 }));
    expect(screen.getByText(t("review.outdatedBody"))).toBeTruthy();
    expect(server.confirmations).toHaveLength(0);
  });

  test("Submit while the server cannot be reached: the report waits to send (CIT-12)", async () => {
    queue.requestSubmission.mockResolvedValueOnce({
      kind: "retrying",
      outcome: "unknown",
      code: "E_OFFLINE",
      nextAttemptAt: new Date().toISOString(),
    } as never);
    await readyVoiceDraft();
    server.lowConfidence.clear();
    await show();
    await stateIs("review.state.check");
    const user = userEvent.setup();
    await user.press(screen.getByRole("button", { name: t("review.confirm") }));
    await stateIs("review.state.ready");
    await user.press(screen.getByRole("button", { name: t("review.submit") }));
    await waitFor(() => expect(handlers.onQueued).toHaveBeenCalled());
    expect(handlers.onReceived).not.toHaveBeenCalled();
  });

  test("a report already submitted is not reviewed again: it waits to send", async () => {
    await readyVoiceDraft();
    await drafts.update(id, { pipeline_state: "READY_TO_SUBMIT" });
    await show();
    await waitFor(() => expect(handlers.onQueued).toHaveBeenCalled());
    expect(server.opened).toHaveLength(0);
  });
});

describe("CIT-11 in Urdu", () => {
  test("states and markers in Urdu; the English text stays left-to-right", async () => {
    await setLanguage("ur");
    await readyVoiceDraft();
    server.lowConfidence.clear();
    await show();
    await stateIs("review.state.check");
    expect(screen.getByTestId("review-marker-ur")).toHaveTextContent(i18n.t("review.aiGenerated"));
    const english = within(screen.getByTestId("review-text-en")).getByText(TEXTS.en);
    expect(english.props.style).toEqual(
      expect.arrayContaining([expect.objectContaining({ writingDirection: "ltr" })]),
    );
  });
});
