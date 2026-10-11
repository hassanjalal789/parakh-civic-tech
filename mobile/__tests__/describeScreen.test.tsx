/**
 * T-050 — CIT-09, speak or type the report text (FR-PUB.9–FR-PUB.13,
 * FR-COMMON.14, FR-COMMON.16; DG-61, DG-62).
 *
 * The recorder and the player are stand-ins: the recorder writes a synthetic
 * sound-only MPEG-4 file where expo-audio would (the cache), so everything after
 * Stop — the hash, the move into the draft, the length read from the file — runs
 * the real code on the fake storage. No real audio is involved.
 */
import { act, fireEvent, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { createHash } from "crypto";
import { AccessibilityInfo, Linking } from "react-native";

import { MAX_RECORDING_SECONDS, MAX_TYPED_CHARACTERS } from "../src/domain/recordingSettings";
import i18n, { setLanguage } from "../src/i18n";
import { DescribeScreen } from "../src/screens/DescribeScreen";
import { draftRepository, type DraftRepository } from "../src/storage/drafts";
import { draftMediaFile } from "../src/storage/media";
import { migrate } from "../src/storage/schema";
import { File, fsControl, Paths, resetFileSystem } from "./fakes/fileSystem";
import { syntheticMp4 } from "./fakes/mp4";
import { memoryDatabase, resetSqlite } from "./fakes/sqlite";

jest.mock("expo-file-system", () => jest.requireActual("./fakes/fileSystem"));
jest.mock("expo-sqlite", () => jest.requireActual("./fakes/sqlite"));
jest.mock("expo-audio", () => {
  const React = jest.requireActual("react");
  const fake = jest.requireActual("./fakes/fileSystem");
  const GRANTED = { granted: true, status: "granted", canAskAgain: true, expires: "never" };
  const listeners = new Set<() => void>();
  const control = {
    permission: GRANTED as Record<string, unknown>,
    onRequest: null as null | (() => Record<string, unknown>),
    requests: 0,
    recording: null as Uint8Array | null,
    options: null as Record<string, unknown> | null,
    statusListener: null as unknown,
    modes: [] as unknown[],
    prepares: 0,
    records: [] as unknown[],
    stops: 0,
    count: 0,
    playerSource: null as unknown,
    plays: 0,
    pauses: 0,
    playing: false,
  };
  const notify = () => listeners.forEach((l) => l());
  const recorder = {
    uri: null as string | null,
    prepareToRecordAsync: async () => {
      control.prepares++;
    },
    record: (options: unknown) => {
      control.records.push(options);
    },
    // As on Android: the file is complete at stop, and a finish is reported after it.
    stop: async () => {
      control.stops++;
      const file = new fake.File(fake.Paths.cache, `recording-${++control.count}.m4a`);
      file.write(control.recording);
      recorder.uri = file.uri;
      const report = control.statusListener as ((...args: unknown[]) => void) | null;
      report?.({ isFinished: true, hasError: false });
    },
  };
  const player = {
    play: () => {
      control.plays++;
      control.playing = true;
      notify();
    },
    pause: () => {
      control.pauses++;
      control.playing = false;
      notify();
    },
    seekTo: async () => undefined,
  };
  return {
    RecordingPresets: {
      HIGH_QUALITY: {
        extension: ".m4a",
        sampleRate: 44100,
        numberOfChannels: 2,
        bitRate: 128000,
        android: { outputFormat: "mpeg4", audioEncoder: "aac" },
        ios: {},
        web: {},
      },
    },
    useAudioRecorder: (options: Record<string, unknown>, listener: unknown) => {
      control.options = options;
      control.statusListener = listener;
      return recorder;
    },
    useAudioRecorderState: () => ({ isRecording: false, durationMillis: 0, canRecord: true }),
    useAudioPlayer: (source: unknown) => {
      control.playerSource = source;
      return player;
    },
    useAudioPlayerStatus: () => {
      const [, setTick] = React.useState(0);
      React.useEffect(() => {
        const listener = () => setTick((n: number) => n + 1);
        listeners.add(listener);
        return () => {
          listeners.delete(listener);
        };
      }, []);
      return { playing: control.playing, currentTime: 0, duration: 12, didJustFinish: false };
    },
    getRecordingPermissionsAsync: async () => control.permission,
    requestRecordingPermissionsAsync: async () => {
      control.requests++;
      control.permission = control.onRequest ? control.onRequest() : control.permission;
      return control.permission;
    },
    setAudioModeAsync: async (mode: unknown) => {
      control.modes.push(mode);
    },
    __control: control,
    __recorder: recorder,
  };
});

type Control = {
  permission: Record<string, unknown>;
  onRequest: null | (() => Record<string, unknown>);
  requests: number;
  recording: Uint8Array | null;
  options: Record<string, unknown> | null;
  statusListener: null | ((status: Record<string, unknown>) => void);
  modes: unknown[];
  prepares: number;
  records: unknown[];
  stops: number;
  count: number;
  playerSource: unknown;
  plays: number;
  pauses: number;
  playing: boolean;
};
const audio: Control = jest.requireMock("expo-audio").__control;

const ACCOUNT = "11111111-1111-4111-8111-111111111111"; // synthetic
const NOW = new Date("2026-10-11T09:00:00.000Z");
const MiB = 1024 * 1024;
const GRANTED = { granted: true, status: "granted", canAskAgain: true, expires: "never" };
const UNDETERMINED = { granted: false, status: "undetermined", canAskAgain: true, expires: "never" };
const BLOCKED = { granted: false, status: "denied", canAskAgain: false, expires: "never" };
const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

let drafts: DraftRepository;
let draftId: string;
let announce: jest.SpyInstance;

beforeEach(async () => {
  await setLanguage("en");
  resetFileSystem();
  resetSqlite();
  Object.assign(audio, {
    permission: GRANTED,
    onRequest: null,
    requests: 0,
    recording: syntheticMp4({ seconds: 12, tracks: ["soun"] }),
    options: null,
    statusListener: null,
    modes: [],
    prepares: 0,
    records: [],
    stops: 0,
    count: 0,
    playerSource: null,
    plays: 0,
    pauses: 0,
    playing: false,
  });
  const db = memoryDatabase();
  await migrate(db);
  drafts = draftRepository(db, ACCOUNT, () => NOW);
  draftId = (await drafts.create()).client_submission_id;
  announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

async function open() {
  const view = await render(
    <DescribeScreen drafts={drafts} draftId={draftId} onContinue={jest.fn()} clock={() => NOW} />,
  );
  await screen.findByText(t("describe.title"));
  return { view, user: userEvent.setup() };
}

const labels = () => screen.getAllByRole("button").map((b) => b.props.accessibilityLabel as string);
const button = (key: string) => screen.getByRole("button", { name: t(key) });
const recordings = async () => (await drafts.evidence(draftId)).filter((e) => e.kind === "voice_original");

async function record(user: ReturnType<typeof userEvent.setup>) {
  await user.press(button("describe.startRecording"));
  await user.press(await screen.findByRole("button", { name: t("describe.stopRecording") }));
  await screen.findByRole("button", { name: t("describe.play") });
}

describe("CIT-09: two equal ways, no language picker (FR-PUB.9, FR-PUB.13)", () => {
  test("Speak and Type are offered side by side; neither is chosen for the citizen and Continue waits", async () => {
    await open();
    expect(labels()).toEqual([t("describe.speak"), t("describe.type"), t("common.continue")]);
    // A new draft's stored mode is "voice" by default; the screen must not take that as a choice.
    expect(button("describe.speak").props.accessibilityState.selected).toBe(false);
    expect(button("describe.type").props.accessibilityState.selected).toBe(false);
    expect(screen.queryByRole("button", { name: t("describe.startRecording") })).toBeNull();
    expect(screen.queryByTestId("typed-description")).toBeNull();
    expect(button("common.continue")).toBeDisabled();
    expect(screen.getByText(t("describe.needText"))).toBeTruthy();
    expect(screen.queryByText(/Roman Urdu|Punjabi|select .*language/i)).toBeNull();
    expect(screen.getByText(t("describe.connectionNote"))).toBeTruthy();
  });
});

describe("CIT-09: the microphone (FR-COMMON.16, FR-PUB.12)", () => {
  test("explained before Android asks, asked only on a tap; refused, typing stays and the way to grant is kept", async () => {
    audio.permission = UNDETERMINED;
    audio.onRequest = () => BLOCKED;
    jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
    const { user } = await open();
    await user.press(button("describe.speak"));
    expect(screen.getByText(t("describe.micWhy"))).toBeTruthy();
    expect(audio.requests).toBe(0);
    await user.press(button("describe.allowMicrophone"));
    expect(audio.requests).toBe(1);
    expect(await screen.findByText(t("describe.micDenied"))).toBeTruthy();
    expect(screen.getByText(t("describe.micSettings"))).toBeTruthy();
    expect(button("evidence.openSettings")).toBeTruthy();
    expect(button("describe.type")).toBeEnabled();
    await user.press(button("describe.type"));
    expect(screen.getByTestId("typed-description")).toBeTruthy();
  });
});

describe("CIT-09: a recording (FR-PUB.10, FR-PUB.11, FR-PUB.25)", () => {
  test("the recorder's own file, hashed, moved not copied, its length read from the file, timed from its start", async () => {
    const { user } = await open();
    await user.press(button("describe.speak"));
    expect(screen.getByText(t("describe.ready"))).toBeTruthy();
    await record(user);
    expect(screen.getByText(t("describe.recordingLabel", { time: "0:12" }))).toBeTruthy();
    expect(audio.options).toMatchObject({ extension: ".m4a", numberOfChannels: 1, bitRate: 64000 });
    expect(audio.modes).toEqual([{ allowsRecording: true, playsInSilentMode: true }]);
    expect(audio.records).toEqual([{ forDuration: MAX_RECORDING_SECONDS }]);
    // Android reports a finish after Stop as well (the stand-in does too): still one recording.
    expect(audio.stops).toBe(1);
    expect(await recordings()).toHaveLength(1);
    const [row] = await recordings();
    expect(row).toMatchObject({
      mime_type: "audio/mp4",
      duration_seconds: 12,
      captured_at: NOW.toISOString(),
    });
    expect(row?.sha256).toBe(sha256(audio.recording as Uint8Array));
    expect(await draftMediaFile(row?.file_name ?? "").bytes()).toEqual(audio.recording);
    expect(new File(Paths.cache, "recording-1.m4a").exists).toBe(false);
    expect(fsControl.moves).toBe(1);
    expect(fsControl.copies).toBe(0);
    expect((await drafts.get(draftId))?.description_mode).toBe("voice");
    expect(announce).toHaveBeenCalledWith(t("describe.saved", { seconds: 12 }));
    expect(button("common.continue")).toBeEnabled();
  });

  test("a recording kept after Type was chosen and left blank stores the voice mode, not the typed one", async () => {
    const { user } = await open();
    await user.press(button("describe.type"));
    await waitFor(async () => expect((await drafts.get(draftId))?.description_mode).toBe("typed"));
    await user.press(button("describe.speak"));
    await record(user);
    expect(await drafts.get(draftId)).toMatchObject({ description_mode: "voice", typed_description: null });
  });

  test("playback plays the original recording from the draft, and pauses", async () => {
    const { user } = await open();
    await user.press(button("describe.speak"));
    await record(user);
    const [row] = await recordings();
    expect(audio.playerSource).toEqual({ uri: draftMediaFile(row?.file_name ?? "").uri });
    await user.press(button("describe.play"));
    expect(audio.plays).toBe(1);
    await user.press(await screen.findByRole("button", { name: t("describe.pause") }));
    expect(audio.pauses).toBe(1);
  });

  test("record again replaces the recording only after the citizen confirms; delete removes it and its file", async () => {
    const { user } = await open();
    await user.press(button("describe.speak"));
    await record(user);
    const [first] = await recordings();
    await user.press(button("describe.reRecord"));
    expect(screen.getByText(t("describe.replaceWarning"))).toBeTruthy();
    await user.press(button("describe.keep"));
    expect(await recordings()).toHaveLength(1);
    await user.press(button("describe.reRecord"));
    await user.press(button("describe.replaceConfirm"));
    await user.press(await screen.findByRole("button", { name: t("describe.stopRecording") }));
    await screen.findByRole("button", { name: t("describe.play") });
    const after = await recordings();
    expect(after).toHaveLength(1);
    expect(after[0]?.evidence_id).not.toBe(first?.evidence_id);
    expect(draftMediaFile(first?.file_name ?? "").exists).toBe(false);
    await user.press(button("describe.delete"));
    await waitFor(async () => expect(await recordings()).toHaveLength(0));
    expect(draftMediaFile(after[0]?.file_name ?? "").exists).toBe(false);
    expect(button("common.continue")).toBeDisabled();
  });

  test("when the recorder stops itself at its cap, the recording is kept as if Stop were pressed", async () => {
    const { user } = await open();
    await user.press(button("describe.speak"));
    await user.press(button("describe.startRecording"));
    await act(async () =>
      audio.statusListener?.({ isFinished: true, hasError: false, error: null, url: null }),
    );
    expect(await screen.findByRole("button", { name: t("describe.play") })).toBeTruthy();
    expect(await recordings()).toHaveLength(1);
  });

  test("a file that is not a sound-only recording is refused and deleted, with the reason", async () => {
    audio.recording = syntheticMp4({ seconds: 5, tracks: ["vide", "soun"] });
    const { user } = await open();
    await user.press(button("describe.speak"));
    await user.press(button("describe.startRecording"));
    await user.press(await screen.findByRole("button", { name: t("describe.stopRecording") }));
    expect(await screen.findByText(t("describe.unreadable"))).toBeTruthy();
    expect(await recordings()).toHaveLength(0);
    expect(new File(Paths.cache, "recording-1.m4a").exists).toBe(false);
  });

  test("storage nearly full: recording does not start, and the draft is kept", async () => {
    fsControl.availableDiskSpace = 10 * MiB;
    const { user } = await open();
    await user.press(button("describe.speak"));
    await user.press(button("describe.startRecording"));
    expect(await screen.findByText(t("describe.storageFull"))).toBeTruthy();
    expect(audio.prepares).toBe(0);
    expect(await drafts.get(draftId)).not.toBeNull();
  });
});

describe("CIT-09: typed text (FR-PUB.12, DG-62)", () => {
  test("kept exactly as written; only text that is not blank enables Continue; the server's limit applies", async () => {
    const { user } = await open();
    await user.press(button("describe.type"));
    const input = screen.getByTestId("typed-description");
    expect(input.props.maxLength).toBe(MAX_TYPED_CHARACTERS);
    const words = "  Pothole near the school\nby the gate  ";
    await fireEvent.changeText(input, words);
    await waitFor(async () => expect((await drafts.get(draftId))?.typed_description).toBe(words));
    expect((await drafts.get(draftId))?.description_mode).toBe("typed");
    expect(button("common.continue")).toBeEnabled();
    await fireEvent.changeText(input, "   \n ");
    expect(button("common.continue")).toBeDisabled();
  });

  test("reopening the screen brings back the typed text, and the recording", async () => {
    const first = await open();
    await first.user.press(button("describe.type"));
    await fireEvent.changeText(screen.getByTestId("typed-description"), "Broken streetlight");
    await waitFor(async () =>
      expect((await drafts.get(draftId))?.typed_description).toBe("Broken streetlight"),
    );
    await first.view.unmount();
    const second = await open();
    expect(screen.getByTestId("typed-description").props.value).toBe("Broken streetlight");
    expect(button("describe.type").props.accessibilityState.selected).toBe(true);

    await second.user.press(button("describe.speak"));
    await second.user.press(button("describe.toVoiceConfirm"));
    await record(second.user);
    await second.view.unmount();
    await open();
    expect(button("describe.speak").props.accessibilityState.selected).toBe(true);
    expect(screen.getByText(t("describe.recordingLabel", { time: "0:12" }))).toBeTruthy();
    expect(button("common.continue")).toBeEnabled();
  });

  test("Continue saves the text as written and moves on", async () => {
    const onContinue = jest.fn();
    await render(
      <DescribeScreen drafts={drafts} draftId={draftId} onContinue={onContinue} clock={() => NOW} />,
    );
    const user = userEvent.setup();
    await user.press(await screen.findByRole("button", { name: t("describe.type") }));
    await fireEvent.changeText(screen.getByTestId("typed-description"), "Garbage not collected");
    await user.press(button("common.continue"));
    await waitFor(() => expect(onContinue).toHaveBeenCalledTimes(1));
    expect((await drafts.get(draftId))?.typed_description).toBe("Garbage not collected");
  });
});

describe("CIT-09: switching never discards silently (FR-COMMON.14)", () => {
  test("from a recording to typing, and from typed text to speaking, only after the citizen confirms", async () => {
    const { user } = await open();
    await user.press(button("describe.speak"));
    await record(user);
    const [row] = await recordings();
    await user.press(button("describe.type"));
    expect(screen.getByText(t("describe.toTypedWarning"))).toBeTruthy();
    await user.press(button("describe.keep"));
    expect(await recordings()).toHaveLength(1);
    expect(screen.queryByTestId("typed-description")).toBeNull();

    await user.press(button("describe.type"));
    await user.press(button("describe.toTypedConfirm"));
    await waitFor(async () => expect(await recordings()).toHaveLength(0));
    expect(draftMediaFile(row?.file_name ?? "").exists).toBe(false);
    await fireEvent.changeText(screen.getByTestId("typed-description"), "Overflowing drain");
    await waitFor(async () =>
      expect((await drafts.get(draftId))?.typed_description).toBe("Overflowing drain"),
    );

    await user.press(button("describe.speak"));
    expect(screen.getByText(t("describe.toVoiceWarning"))).toBeTruthy();
    await user.press(button("describe.toVoiceConfirm"));
    await waitFor(async () => expect((await drafts.get(draftId))?.description_mode).toBe("voice"));
    expect((await drafts.get(draftId))?.typed_description).toBeNull();
    expect(button("describe.startRecording")).toBeTruthy();
  });
});

describe("CIT-09: drafts that cannot change", () => {
  test("a draft already sent offers neither recording nor typing", async () => {
    await drafts.update(draftId, { pipeline_state: "READY_TO_SUBMIT" });
    await render(<DescribeScreen drafts={drafts} draftId={draftId} onContinue={jest.fn()} />);
    expect(await screen.findByText(t("describe.notEditable"))).toBeTruthy();
    expect(screen.queryByRole("button", { name: t("describe.speak") })).toBeNull();
    expect(screen.queryByRole("button", { name: t("common.continue") })).toBeNull();
  });

  test("a draft no longer on the phone says so", async () => {
    const missing = "22222222-2222-4222-8222-222222222222"; // synthetic
    await render(<DescribeScreen drafts={drafts} draftId={missing} onContinue={jest.fn()} />);
    expect(await screen.findByText(t("evidence.draftGone"))).toBeTruthy();
    expect(screen.queryByRole("button", { name: t("describe.type") })).toBeNull();
  });
});
