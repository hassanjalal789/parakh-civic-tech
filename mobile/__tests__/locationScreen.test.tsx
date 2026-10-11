/**
 * T-051 — CIT-10, where the issue is (FR-PUB.24, FR-COMMON.16; DG-30, DG-73, DG-77).
 *
 * expo-location is a stand-in: it answers with synthetic positions, and its
 * address-lookup functions fail the test if they are ever called (no address
 * lookup, DG-30). Everything after a reading — what is saved, what is shown —
 * runs the real code on the fake SQLite.
 */
import { act, fireEvent, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo, Linking } from "react-native";

import { ADJUST_STEP_M, moved } from "../src/domain/location";
import { MAX_LOCATION_RECORDING_SECONDS } from "../src/domain/recordingSettings";
import i18n, { setLanguage } from "../src/i18n";
import {
  accuracyText,
  CURRENT_FIX_TIMEOUT_MS,
  FIX_ACCURACY,
  LocationScreen,
  withTimeout,
} from "../src/screens/LocationScreen";
import { draftRepository, type DraftRepository, locationOf } from "../src/storage/drafts";
import { draftMediaFile } from "../src/storage/media";
import { migrate } from "../src/storage/schema";
import { __control as audio, resetExpoAudio } from "./fakes/expoAudio";
import { File, Paths, resetFileSystem } from "./fakes/fileSystem";
import { syntheticMp4 } from "./fakes/mp4";
import { memoryDatabase, resetSqlite } from "./fakes/sqlite";

jest.mock("expo-file-system", () => jest.requireActual("./fakes/fileSystem"));
jest.mock("expo-sqlite", () => jest.requireActual("./fakes/sqlite"));
jest.mock("expo-audio", () => jest.requireActual("./fakes/expoAudio"));
jest.mock("expo-location", () => {
  const control = {
    permission: null as unknown,
    onRequest: null as unknown,
    requests: 0,
    current: null as unknown, // a position, "fail", or "hang"
    lastKnown: null as unknown,
    currentCalls: 0,
    lastKnownCalls: 0,
    options: [] as unknown[],
    lastKnownOptions: null as unknown,
  };
  const forbidden = () => {
    throw new Error("an address lookup was used (DG-30)");
  };
  return {
    Accuracy: { High: 4, Highest: 5 },
    getForegroundPermissionsAsync: async () => control.permission,
    requestForegroundPermissionsAsync: async () => {
      control.requests++;
      const next = control.onRequest as (() => unknown) | null;
      if (next) control.permission = next();
      return control.permission;
    },
    getCurrentPositionAsync: (options: unknown) => {
      control.currentCalls++;
      control.options.push(options);
      if (control.current === "hang") return new Promise(() => undefined);
      if (control.current === "fail") return Promise.reject(new Error("no fix"));
      return Promise.resolve(control.current);
    },
    getLastKnownPositionAsync: async (options: unknown) => {
      control.lastKnownCalls++;
      control.lastKnownOptions = options;
      return control.lastKnown;
    },
    reverseGeocodeAsync: forbidden,
    geocodeAsync: forbidden,
    __control: control,
  };
});

type Control = {
  permission: unknown;
  onRequest: (() => unknown) | null;
  requests: number;
  current: unknown;
  lastKnown: unknown;
  currentCalls: number;
  lastKnownCalls: number;
  options: unknown[];
  lastKnownOptions: unknown;
};
const gps: Control = jest.requireMock("expo-location").__control;

const ACCOUNT = "11111111-1111-4111-8111-111111111111"; // synthetic
const NOW = new Date("2026-10-11T09:00:00.000Z");
const GRANTED = { granted: true, status: "granted", canAskAgain: true, expires: "never" };
const UNDETERMINED = { granted: false, status: "undetermined", canAskAgain: true, expires: "never" };
const BLOCKED = { granted: false, status: "denied", canAskAgain: false, expires: "never" };
const FIX = {
  coords: {
    latitude: 31.5203704,
    longitude: 74.3587491,
    accuracy: 12.4,
    altitude: null,
    heading: null,
    speed: null,
  },
  timestamp: Date.parse("2026-10-11T08:59:58.000Z"),
};
const OLD_FIX = {
  coords: { latitude: 31.51, longitude: 74.35, accuracy: 30, altitude: null, heading: null, speed: null },
  timestamp: Date.parse("2026-10-11T08:48:00.000Z"), // 12 minutes before NOW
};
const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);

let drafts: DraftRepository;
let draftId: string;
let announce: jest.SpyInstance;

beforeEach(async () => {
  await setLanguage("en");
  resetFileSystem();
  resetSqlite();
  Object.assign(gps, {
    permission: GRANTED,
    onRequest: null,
    requests: 0,
    current: FIX,
    lastKnown: null,
    currentCalls: 0,
    lastKnownCalls: 0,
    options: [],
    lastKnownOptions: null,
  });
  resetExpoAudio(syntheticMp4({ seconds: 9, tracks: ["soun"] }));
  const db = memoryDatabase();
  await migrate(db);
  drafts = draftRepository(db, ACCOUNT, () => NOW);
  draftId = (await drafts.create()).client_submission_id;
  announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

async function open(onContinue = jest.fn()) {
  const view = await render(
    <LocationScreen drafts={drafts} draftId={draftId} onContinue={onContinue} clock={() => NOW} />,
  );
  await screen.findByText(t("location.title"));
  return { view, onContinue, user: userEvent.setup() };
}

const button = (key: string, options?: Record<string, unknown>) =>
  screen.getByRole("button", { name: t(key, options) });
const saved = async () => {
  const row = await drafts.get(draftId);
  return row ? locationOf(row) : null;
};
const sourceOf = async () => (await drafts.get(draftId))?.location_source;

describe("CIT-10: the current GPS position (FR-PUB.24, DG-30)", () => {
  test("found at once when location is allowed: coordinates, accuracy, and nothing but the GPS", async () => {
    const { onContinue, user } = await open();
    expect(await screen.findByText(t("location.current"))).toBeTruthy();
    expect(screen.getByTestId("reported-coordinates").props.children).toBe(
      t("location.coordinates", { latitude: "31.520370", longitude: "74.358749" }),
    );
    // The accuracy the phone reported, never shown as better than it is; the best accuracy was asked for.
    expect(screen.getByText(t("location.accuracy", { metres: "12.4" }))).toBeTruthy();
    expect(gps.options).toEqual([{ accuracy: FIX_ACCURACY }]);
    expect(FIX_ACCURACY).toBe(5); // Location.Accuracy.Highest
    expect(await saved()).toEqual({
      kind: "coordinates",
      measured: {
        latitude: 31.5203704,
        longitude: 74.3587491,
        accuracyM: 12.4,
        fix: "current",
        measuredAt: "2026-10-11T08:59:58.000Z",
      },
      reported: { latitude: 31.5203704, longitude: 74.3587491 },
    });
    expect(await sourceOf()).toBe("gps_current");
    expect(gps.lastKnownCalls).toBe(0);
    expect(screen.getByText(t("location.intro"))).toBeTruthy(); // no map, no address search: said, and none exists
    await user.press(button("common.continue"));
    expect(onContinue).toHaveBeenCalled();
  });

  test("explained before Android asks, and asked only when the reporter taps", async () => {
    gps.permission = UNDETERMINED;
    gps.onRequest = () => GRANTED;
    const { user } = await open();
    expect(screen.getByText(t("location.why"))).toBeTruthy();
    expect(gps.requests).toBe(0);
    expect(gps.currentCalls).toBe(0);
    expect(button("common.continue")).toBeDisabled();
    await user.press(button("location.allow"));
    expect(gps.requests).toBe(1);
    expect(await screen.findByText(t("location.current"))).toBeTruthy();
    expect(await sourceOf()).toBe("gps_current");
  });
});

describe("CIT-10: the last known position (DG-73, E2)", () => {
  test("used when no current fix is obtained, with its age, and kept as the phone's last known reading", async () => {
    gps.current = "fail";
    gps.lastKnown = OLD_FIX;
    await open();
    expect(
      await screen.findByText(t("location.lastKnown", { age: t("location.agoMinutes", { count: 12 }) })),
    ).toBeTruthy();
    expect(await sourceOf()).toBe("gps_last_known");
    expect(gps.lastKnownOptions).toEqual({ maxAge: 30 * 60 * 1000 }); // only a reading at most 30 minutes old
    expect((await saved())?.kind === "coordinates" && (await saved())).toMatchObject({
      measured: { fix: "last_known", measuredAt: "2026-10-11T08:48:00.000Z", accuracyM: 30 },
    });
  });

  test("a last known position more than 30 minutes old is not used: the description is offered instead", async () => {
    gps.current = "fail";
    // As if the platform ignored maxAge: the screen checks the age itself.
    gps.lastKnown = { ...OLD_FIX, timestamp: Date.parse("2026-10-11T08:29:00.000Z") }; // 31 minutes before NOW
    await open();
    expect(await screen.findByText(t("location.lastKnownTooOld", { minutes: 30 }))).toBeTruthy();
    expect(screen.getByText(t("location.noCoordinates"))).toBeTruthy();
    expect(await saved()).toBeNull();
    expect(screen.queryByTestId("reported-coordinates")).toBeNull();
  });

  test("exactly 30 minutes old is still used", async () => {
    gps.current = "fail";
    gps.lastKnown = { ...OLD_FIX, timestamp: Date.parse("2026-10-11T08:30:00.000Z") };
    await open();
    expect(await screen.findByTestId("reported-coordinates")).toBeTruthy();
    expect(await sourceOf()).toBe("gps_last_known");
  });

  test("a current fix that never comes is given up after the timeout", async () => {
    jest.useFakeTimers();
    try {
      const never = new Promise<string>(() => undefined);
      const result = withTimeout(never, CURRENT_FIX_TIMEOUT_MS);
      jest.advanceTimersByTime(CURRENT_FIX_TIMEOUT_MS);
      await expect(result).resolves.toBeNull();
      await expect(withTimeout(Promise.resolve("fix"), 10)).resolves.toBe("fix");
      await expect(withTimeout(Promise.reject(new Error("x")), 10)).resolves.toBeNull();
    } finally {
      jest.useRealTimers();
    }
  });
});

describe("CIT-10: a written description when there are no coordinates (DG-73, E3)", () => {
  test("neither a current nor a last known position: the reporter describes the place, kept exactly as written", async () => {
    gps.current = "fail";
    gps.lastKnown = null;
    await open();
    expect(await screen.findByText(t("location.noCoordinates"))).toBeTruthy();
    expect(screen.getByText(t("location.noCoordinatesSaved"))).toBeTruthy();
    expect(button("common.continue")).toBeDisabled();
    // Speak and Type are offered equally; neither is chosen for the reporter (DG-77).
    expect(button("location.speak").props.accessibilityState.selected).toBe(false);
    expect(button("location.type").props.accessibilityState.selected).toBe(false);
    expect(screen.queryByTestId("location-description")).toBeNull();
    await userEvent.setup().press(button("location.type"));
    const words = "  Main bazaar, opposite the mosque\n";
    await fireEvent.changeText(screen.getByTestId("location-description"), words);
    await waitFor(async () => expect(await saved()).toEqual({ kind: "description", description: words }));
    expect(await sourceOf()).toBe("written_description");
    expect(button("common.continue")).toBeEnabled();
    expect(screen.getByTestId("location-description").props.maxLength).toBe(500);

    await fireEvent.changeText(screen.getByTestId("location-description"), "  \n ");
    expect(button("common.continue")).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId("location-description"), "");
    await waitFor(async () => expect(await saved()).toBeNull()); // an emptied description is not kept
  });

  test("location refused: nothing is measured, the description is offered, and the way to allow it is kept", async () => {
    gps.permission = BLOCKED;
    jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
    const { user } = await open();
    expect(screen.getByText(t("location.denied"))).toBeTruthy();
    expect(screen.getByText(t("location.settings"))).toBeTruthy();
    expect(screen.getByText(t("location.noCoordinates"))).toBeTruthy();
    expect(gps.currentCalls + gps.lastKnownCalls).toBe(0);
    await user.press(button("evidence.openSettings"));
    expect(Linking.openSettings).toHaveBeenCalled();
    await user.press(button("location.type"));
    await fireEvent.changeText(screen.getByTestId("location-description"), "Near the water tank");
    await waitFor(async () => expect(await sourceOf()).toBe("written_description"));
  });

  test("a position found later replaces a description only when the reporter agrees", async () => {
    gps.current = "fail";
    const { user } = await open();
    await user.press(await screen.findByRole("button", { name: t("location.type") }));
    await fireEvent.changeText(screen.getByTestId("location-description"), "Near the water tank");
    await waitFor(async () => expect(await sourceOf()).toBe("written_description"));
    gps.current = FIX;
    await user.press(button("location.tryAgain"));
    expect(await screen.findByText(t("location.useFix"))).toBeTruthy();
    await user.press(button("describe.keep"));
    expect(await sourceOf()).toBe("written_description");
    await user.press(button("location.tryAgain"));
    await user.press(await screen.findByRole("button", { name: t("location.useFixConfirm") }));
    expect(await screen.findByText(t("location.current"))).toBeTruthy();
    expect(await sourceOf()).toBe("gps_current");
    expect(screen.queryByTestId("location-description")).toBeNull();
  });
});

describe("CIT-10: directional buttons keep the measurement (DG-30, DG-73 M3)", () => {
  test("moving the position keeps what the phone measured, says so, and can go back", async () => {
    const { user } = await open();
    await screen.findByText(t("location.current"));
    const north = button("location.moveLabel", { direction: t("location.north"), metres: ADJUST_STEP_M });
    await user.press(north);
    await waitFor(async () => expect(await sourceOf()).toBe("adjusted"));
    const after = await saved();
    expect(after).toMatchObject({
      measured: { latitude: 31.5203704, longitude: 74.3587491, accuracyM: 12.4, fix: "current" },
      reported: moved({ latitude: 31.5203704, longitude: 74.3587491 }, "north"),
    });
    expect(ADJUST_STEP_M).toBe(5);
    expect(await screen.findByText(t("location.adjusted", { metres: 5 }))).toBeTruthy();
    expect(
      screen.getByText(t("location.measured", { latitude: "31.520370", longitude: "74.358749" })),
    ).toBeTruthy();
    expect(announce).toHaveBeenCalledWith(t("location.moved", { metres: 5, direction: t("location.north") }));

    for (const direction of ["east", "south", "west"]) {
      expect(button("location.moveLabel", { direction: t(`location.${direction}`), metres: 5 })).toBeTruthy();
    }
    await user.press(button("location.reset"));
    await waitFor(async () => expect(await sourceOf()).toBe("gps_current"));
    expect(screen.queryByText(t("location.adjusted", { metres: 5 }))).toBeNull();
  });
});

describe("CIT-10: coming back, and drafts that cannot change", () => {
  test("a saved location is shown again without measuring again", async () => {
    const first = await open();
    await screen.findByText(t("location.current"));
    await first.view.unmount();
    gps.currentCalls = 0;
    await open();
    expect(await screen.findByText(t("location.current"))).toBeTruthy();
    await act(async () => undefined);
    expect(gps.currentCalls).toBe(0);
  });

  test("a sent draft's location cannot change; a draft no longer on the phone says so", async () => {
    await drafts.update(draftId, { pipeline_state: "READY_TO_SUBMIT" });
    const sent = await render(<LocationScreen drafts={drafts} draftId={draftId} onContinue={jest.fn()} />);
    expect(await screen.findByText(t("location.notEditable"))).toBeTruthy();
    expect(gps.currentCalls).toBe(0);
    await sent.unmount();
    await render(
      <LocationScreen
        drafts={drafts}
        draftId="22222222-2222-4222-8222-222222222222"
        onContinue={jest.fn()}
      />,
    );
    expect(await screen.findByText(t("evidence.draftGone"))).toBeTruthy();
  });
});

describe("CIT-10: the location described by voice (DG-77)", () => {
  const locationRecordings = async () =>
    (await drafts.evidence(draftId)).filter((e) => e.kind === "location_voice");

  async function speak(user: ReturnType<typeof userEvent.setup>) {
    await user.press(await screen.findByRole("button", { name: t("location.speak") }));
    expect(screen.getByText(t("location.speakHint"))).toBeTruthy();
    expect(screen.getByText(t("location.limit", { seconds: 60 }))).toBeTruthy();
    await user.press(button("describe.startRecording"));
    await user.press(await screen.findByRole("button", { name: t("describe.stopRecording") }));
    await screen.findByRole("button", { name: t("describe.play") });
  }

  test("no coordinates: speaking alone is enough — the recording is evidence, the location spoken and unverified", async () => {
    gps.current = "fail";
    const { user, onContinue } = await open();
    await speak(user);
    const [row] = await locationRecordings();
    expect(row).toMatchObject({ kind: "location_voice", mime_type: "audio/mp4", duration_seconds: 9 });
    expect(await draftMediaFile(row?.file_name ?? "").bytes()).toEqual(audio.recording);
    expect(new File(Paths.cache, "recording-1.m4a").exists).toBe(false); // moved, not copied
    // DG-79 (Hassan Jalal, 2026-10-11): the recorder stops itself at 1 minute.
    expect(MAX_LOCATION_RECORDING_SECONDS).toBe(60);
    expect(audio.records).toEqual([{ forDuration: 60 }]);
    expect(await saved()).toEqual({ kind: "spoken" });
    expect(await sourceOf()).toBe("spoken_description");
    expect(screen.getByText(t("location.recorded", { time: "0:09" }))).toBeTruthy();
    expect(screen.getByText(t("location.noCoordinatesSaved"))).toBeTruthy();
    expect(announce).toHaveBeenCalledWith(t("location.spokenSaved"));
    expect(screen.queryByTestId("location-description")).toBeNull(); // no typing was needed
    await user.press(button("common.continue"));
    expect(onContinue).toHaveBeenCalled();
  });

  test("played back from the draft, and deleted with its file", async () => {
    gps.current = "fail";
    const { user } = await open();
    await speak(user);
    const [row] = await locationRecordings();
    expect(audio.playerSource).toEqual({ uri: draftMediaFile(row?.file_name ?? "").uri });
    await user.press(button("describe.play"));
    expect(audio.plays).toBe(1);
    await user.press(button("describe.delete"));
    await waitFor(async () => expect(await locationRecordings()).toHaveLength(0));
    expect(draftMediaFile(row?.file_name ?? "").exists).toBe(false);
    expect(await saved()).toBeNull();
    expect(button("common.continue")).toBeDisabled();
  });

  test("switching between speaking and typing deletes nothing without the reporter's agreement", async () => {
    gps.current = "fail";
    const { user } = await open();
    await speak(user);
    await user.press(button("location.type"));
    expect(screen.getByText(t("location.toWrittenWarning"))).toBeTruthy();
    await user.press(button("describe.keep"));
    expect(await locationRecordings()).toHaveLength(1);
    await user.press(button("location.type"));
    await user.press(button("location.toWrittenConfirm"));
    await waitFor(async () => expect(await locationRecordings()).toHaveLength(0));
    await fireEvent.changeText(screen.getByTestId("location-description"), "Near the tank");
    await waitFor(async () => expect(await sourceOf()).toBe("written_description"));
    await user.press(button("location.speak"));
    expect(screen.getByText(t("location.toSpokenWarning"))).toBeTruthy();
    await user.press(button("location.toSpokenConfirm"));
    await waitFor(async () => expect(await saved()).toBeNull());
  });

  test("a position found later replaces a spoken description only when agreed, then deletes its recording", async () => {
    gps.current = "fail";
    const { user } = await open();
    await speak(user);
    const [row] = await locationRecordings();
    gps.current = FIX;
    await user.press(button("location.tryAgain"));
    await user.press(await screen.findByRole("button", { name: t("location.useFixConfirm") }));
    expect(await screen.findByText(t("location.current"))).toBeTruthy();
    expect(await sourceOf()).toBe("gps_current");
    expect(await locationRecordings()).toHaveLength(0);
    expect(draftMediaFile(row?.file_name ?? "").exists).toBe(false);
  });

  test("the microphone is explained first; refused, typing stays available", async () => {
    gps.current = "fail";
    audio.permission = { granted: false, status: "undetermined", canAskAgain: true, expires: "never" };
    audio.onRequest = () => ({ granted: false, status: "denied", canAskAgain: false, expires: "never" });
    const { user } = await open();
    await user.press(await screen.findByRole("button", { name: t("location.speak") }));
    expect(screen.getByText(t("describe.micWhy"))).toBeTruthy();
    expect(audio.requests).toBe(0);
    await user.press(button("describe.allowMicrophone"));
    expect(await screen.findByText(t("describe.micDenied"))).toBeTruthy();
    expect(button("location.type")).toBeEnabled();
  });

  test("a file that is not a sound-only recording is refused, with the reason", async () => {
    gps.current = "fail";
    audio.recording = syntheticMp4({ seconds: 5, tracks: ["vide", "soun"] });
    const { user } = await open();
    await user.press(await screen.findByRole("button", { name: t("location.speak") }));
    await user.press(button("describe.startRecording"));
    await user.press(await screen.findByRole("button", { name: t("describe.stopRecording") }));
    expect(await screen.findByText(t("describe.unreadable"))).toBeTruthy();
    expect(await locationRecordings()).toHaveLength(0);
    expect(await saved()).toBeNull();
  });
});

describe("CIT-10: the accuracy is the phone's, never better", () => {
  test("rounded up to a tenth of a metre", () => {
    expect(accuracyText(12.4)).toBe("12.4");
    expect(accuracyText(12.41)).toBe("12.5");
    expect(accuracyText(3)).toBe("3");
    expect(Number(accuracyText(7.0001))).toBeGreaterThanOrEqual(7.0001);
  });
});

describe("CIT-10: a spoken location description lasts at most 1 minute (DG-79)", () => {
  test("stopped by the recorder at 1 minute, it is kept and the reporter is told why", async () => {
    gps.current = "fail";
    audio.recording = syntheticMp4({ seconds: 60.2, tracks: ["soun"] });
    const { user } = await open();
    await user.press(await screen.findByRole("button", { name: t("location.speak") }));
    await user.press(button("describe.startRecording"));
    await act(async () => audio.statusListener?.({ isFinished: true, hasError: false }));
    expect(await screen.findByRole("button", { name: t("describe.play") })).toBeTruthy();
    expect(announce).toHaveBeenCalledWith(t("describe.savedAtLimit", { max: "1:00" }));
    expect(await sourceOf()).toBe("spoken_description");
  });

  test("a longer recording is refused and deleted, with the reason", async () => {
    gps.current = "fail";
    audio.recording = syntheticMp4({ seconds: 61, tracks: ["soun"] });
    const { user } = await open();
    await user.press(await screen.findByRole("button", { name: t("location.speak") }));
    await user.press(button("describe.startRecording"));
    await user.press(await screen.findByRole("button", { name: t("describe.stopRecording") }));
    expect(await screen.findByText(t("location.tooLong", { seconds: 60 }))).toBeTruthy();
    expect((await drafts.evidence(draftId)).filter((e) => e.kind === "location_voice")).toHaveLength(0);
    expect(new File(Paths.cache, "recording-1.m4a").exists).toBe(false);
    expect(await saved()).toBeNull();
  });
});
