/**
 * T-051 — CIT-10, where the issue is (FR-PUB.24, FR-COMMON.16; DG-30, DG-73).
 *
 * expo-location is a stand-in: it answers with synthetic positions, and its
 * address-lookup functions fail the test if they are ever called (no address
 * lookup, DG-30). Everything after a reading — what is saved, what is shown —
 * runs the real code on the fake SQLite.
 */
import { act, fireEvent, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo, Linking } from "react-native";

import { ADJUST_STEP_M, moved } from "../src/domain/location";
import i18n, { setLanguage } from "../src/i18n";
import { CURRENT_FIX_TIMEOUT_MS, LocationScreen, withTimeout } from "../src/screens/LocationScreen";
import { draftRepository, type DraftRepository, locationOf } from "../src/storage/drafts";
import { migrate } from "../src/storage/schema";
import { resetFileSystem } from "./fakes/fileSystem";
import { memoryDatabase, resetSqlite } from "./fakes/sqlite";

jest.mock("expo-file-system", () => jest.requireActual("./fakes/fileSystem"));
jest.mock("expo-sqlite", () => jest.requireActual("./fakes/sqlite"));
jest.mock("expo-location", () => {
  const control = {
    permission: null as unknown,
    onRequest: null as unknown,
    requests: 0,
    current: null as unknown, // a position, "fail", or "hang"
    lastKnown: null as unknown,
    currentCalls: 0,
    lastKnownCalls: 0,
  };
  const forbidden = () => {
    throw new Error("an address lookup was used (DG-30)");
  };
  return {
    Accuracy: { High: 4 },
    getForegroundPermissionsAsync: async () => control.permission,
    requestForegroundPermissionsAsync: async () => {
      control.requests++;
      const next = control.onRequest as (() => unknown) | null;
      if (next) control.permission = next();
      return control.permission;
    },
    getCurrentPositionAsync: () => {
      control.currentCalls++;
      if (control.current === "hang") return new Promise(() => undefined);
      if (control.current === "fail") return Promise.reject(new Error("no fix"));
      return Promise.resolve(control.current);
    },
    getLastKnownPositionAsync: async () => {
      control.lastKnownCalls++;
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
  });
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
    expect(screen.getByText(t("location.accuracy", { metres: 12 }))).toBeTruthy();
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
    expect((await saved())?.kind === "coordinates" && (await saved())).toMatchObject({
      measured: { fix: "last_known", measuredAt: "2026-10-11T08:48:00.000Z", accuracyM: 30 },
    });
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
    const words = "  Main bazaar, opposite the mosque\n";
    await fireEvent.changeText(screen.getByTestId("location-description"), words);
    await waitFor(async () => expect(await saved()).toEqual({ kind: "description", description: words }));
    expect(await sourceOf()).toBe("description");
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
    await fireEvent.changeText(screen.getByTestId("location-description"), "Near the water tank");
    await waitFor(async () => expect(await sourceOf()).toBe("description"));
  });

  test("finding the position again replaces the description with coordinates", async () => {
    gps.current = "fail";
    const { user } = await open();
    await fireEvent.changeText(await screen.findByTestId("location-description"), "Near the water tank");
    await waitFor(async () => expect(await sourceOf()).toBe("description"));
    gps.current = FIX;
    await user.press(button("location.tryAgain"));
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
    expect(await screen.findByText(t("location.adjusted", { metres: 10 }))).toBeTruthy();
    expect(
      screen.getByText(t("location.measured", { latitude: "31.520370", longitude: "74.358749" })),
    ).toBeTruthy();
    expect(announce).toHaveBeenCalledWith(
      t("location.moved", { metres: 10, direction: t("location.north") }),
    );

    for (const direction of ["east", "south", "west"]) {
      expect(
        button("location.moveLabel", { direction: t(`location.${direction}`), metres: 10 }),
      ).toBeTruthy();
    }
    await user.press(button("location.reset"));
    await waitFor(async () => expect(await sourceOf()).toBe("gps_current"));
    expect(screen.queryByText(t("location.adjusted", { metres: 10 }))).toBeNull();
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
