/**
 * T-049 — CIT-08 live evidence capture (FR-PUB.4–FR-PUB.8, FR-COMMON.14,
 * FR-COMMON.16, FR-PUB.25; UC-CIT-016, UC-CIT-017).
 *
 * The camera is a stand-in that writes synthetic files where a real camera
 * would (the cache), so everything after the shutter — hashing, the move into
 * the draft, the bounds, review — runs the real code on the fake storage.
 */
import { act, render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";
import { AccessibilityInfo, AppState, Linking } from "react-native";

import i18n, { setLanguage } from "../src/i18n";
import { CitizenStoreStatus, EvidenceScreen } from "../src/screens/EvidenceScreen";
import { ingestCapture } from "../src/storage/capture";
import { draftRepository, type DraftRepository } from "../src/storage/drafts";
import { draftMediaFile } from "../src/storage/media";
import { migrate } from "../src/storage/schema";
import { File, fsControl, Paths, resetFileSystem } from "./fakes/fileSystem";
import { syntheticMp4 } from "./fakes/mp4";
import { memoryDatabase, resetSqlite } from "./fakes/sqlite";

jest.mock("expo-file-system", () => jest.requireActual("./fakes/fileSystem"));
jest.mock("expo-sqlite", () => jest.requireActual("./fakes/sqlite"));
jest.mock("expo-video", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return {
    useVideoPlayer: () => ({}),
    VideoView: () => React.createElement(View, { testID: "video-player" }),
  };
});
jest.mock("expo-camera", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  const fake = jest.requireActual("./fakes/fileSystem");
  const { randomBytes } = jest.requireActual("crypto");
  const GRANTED = { granted: true, status: "granted", canAskAgain: true, expires: "never" };
  const control = {
    permissions: { camera: GRANTED, microphone: GRANTED } as Record<string, unknown>,
    onRequest: {} as Record<string, () => unknown>,
    sizes: ["4000x3000", "1920x1080", "1280x720"],
    photo: null as Uint8Array | null,
    video: null as Uint8Array | null,
    photoError: null as Error | null,
    lastProps: {} as Record<string, unknown>,
    takePicture: [] as unknown[],
    record: [] as unknown[],
    stops: 0,
    finish: null as null | (() => void),
    count: 0,
  };
  const api = {
    takePictureAsync: async (options: unknown) => {
      control.takePicture.push(options);
      if (control.photoError) throw control.photoError;
      const file = new fake.File(fake.Paths.cache, `camera-photo-${++control.count}.jpg`);
      file.write(control.photo ?? new Uint8Array([0xff, 0xd8, 0xff, ...randomBytes(2048)]));
      return { uri: file.uri, width: 1920, height: 1080, format: "jpg" };
    },
    recordAsync: (options: unknown) => {
      control.record.push(options);
      return new Promise((resolve) => {
        control.finish = () => {
          const file = new fake.File(fake.Paths.cache, `camera-video-${++control.count}.mp4`);
          file.write(control.video);
          resolve({ uri: file.uri });
        };
      });
    },
    stopRecording: () => {
      control.stops++;
      control.finish?.();
    },
    getAvailablePictureSizesAsync: async () => control.sizes,
  };
  const CameraView = React.forwardRef(function CameraView(
    props: Record<string, unknown> & { onCameraReady?: () => void },
    ref: unknown,
  ) {
    control.lastProps = props;
    React.useImperativeHandle(ref, () => api);
    React.useEffect(() => {
      props.onCameraReady?.();
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return React.createElement(View, { testID: "camera" });
  });
  const hook = (kind: string) => () => {
    const [permission, setPermission] = React.useState(control.permissions[kind]);
    const request = async () => {
      const next = control.onRequest[kind] ? control.onRequest[kind]() : permission;
      control.permissions[kind] = next;
      setPermission(next);
      return next;
    };
    // Android's current answer, as after the citizen changed it in Settings.
    const read = async () => {
      setPermission(control.permissions[kind]);
      return control.permissions[kind];
    };
    return [permission, request, read];
  };
  return {
    CameraView,
    useCameraPermissions: hook("camera"),
    useMicrophonePermissions: hook("microphone"),
    __control: control,
  };
});

type Control = {
  permissions: Record<string, unknown>;
  onRequest: Record<string, () => unknown>;
  sizes: string[];
  photo: Uint8Array | null;
  video: Uint8Array | null;
  photoError: Error | null;
  lastProps: Record<string, unknown>;
  takePicture: unknown[];
  record: unknown[];
  stops: number;
};
const camera: Control = jest.requireMock("expo-camera").__control;

const ACCOUNT = "11111111-1111-4111-8111-111111111111"; // synthetic
const NOW = new Date("2026-10-09T10:00:00.000Z");
const MiB = 1024 * 1024;
const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);
const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

const GRANTED = { granted: true, status: "granted", canAskAgain: true, expires: "never" };
const UNDETERMINED = { granted: false, status: "undetermined", canAskAgain: true, expires: "never" };
const BLOCKED = { granted: false, status: "denied", canAskAgain: false, expires: "never" };
const REFUSED_ONCE = { granted: false, status: "denied", canAskAgain: true, expires: "never" };

let drafts: DraftRepository;
let draftId: string;
let announce: jest.SpyInstance;

beforeEach(async () => {
  await setLanguage("en");
  resetFileSystem();
  resetSqlite();
  Object.assign(camera, {
    permissions: { camera: GRANTED, microphone: GRANTED },
    onRequest: {},
    sizes: ["4000x3000", "1920x1080", "1280x720"],
    photo: null,
    video: syntheticMp4({ seconds: 42 }),
    photoError: null,
    lastProps: {},
    takePicture: [],
    record: [],
    stops: 0,
  });
  const db = memoryDatabase();
  await migrate(db);
  drafts = draftRepository(db, ACCOUNT, () => NOW);
  draftId = (await drafts.create()).client_submission_id;
  announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

async function open(onContinue = jest.fn()) {
  await render(
    <EvidenceScreen drafts={drafts} draftId={draftId} onContinue={onContinue} clock={() => NOW} />,
  );
  await screen.findByText(t("evidence.title"));
  return { onContinue, user: userEvent.setup() };
}

const buttonLabels = () => screen.getAllByRole("button").map((b) => b.props.accessibilityLabel as string);

const photosInDraft = async () => (await drafts.evidence(draftId)).filter((e) => e.kind === "photo");

async function takePhotos(user: ReturnType<typeof userEvent.setup>, n: number) {
  for (let i = 1; i <= n; i++) {
    await user.press(screen.getByRole("button", { name: t("evidence.takePhoto") }));
    await screen.findByLabelText(t("evidence.thumbPhoto", { n: i }));
  }
}

describe("CIT-08: the in-app camera only (FR-PUB.4, FR-PUB.8)", () => {
  test("the only controls are the camera's — no gallery, file, import or skip control", async () => {
    await open();
    expect(buttonLabels()).toEqual([
      t("evidence.photoMode"),
      t("evidence.videoMode"),
      t("evidence.takePhoto"),
      t("common.continue"),
    ]);
    expect(screen.queryByText(/gallery|library|import|upload|skip/i)).toBeNull();
  });

  test("no gallery or file-picker module is installed, and gallery permissions are blocked", () => {
    // Importing one is already an ESLint error (eslint.config.js, no-restricted-imports).
    const pkg = JSON.parse(readFileSync(join(__dirname, "..", "package.json"), "utf8"));
    const installed = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    for (const name of [
      "expo-image-picker",
      "expo-document-picker",
      "expo-media-library",
      "react-native-image-picker",
      "@react-native-camera-roll/camera-roll",
    ])
      expect(installed).not.toContain(name);
    const config = readFileSync(join(__dirname, "..", "app.config.ts"), "utf8");
    for (const permission of ["READ_MEDIA_IMAGES", "READ_MEDIA_VIDEO", "READ_EXTERNAL_STORAGE"])
      expect(config).toContain(`"android.permission.${permission}"`);
  });

  test("Continue stays disabled, with the reason, until a photo exists — and a video does not count", async () => {
    const { onContinue, user } = await open();
    const next = () => screen.getByRole("button", { name: t("common.continue") });
    expect(next()).toBeDisabled();
    expect(screen.getByText(t("evidence.needPhoto"))).toBeTruthy();

    await user.press(screen.getByRole("button", { name: t("evidence.videoMode") }));
    await user.press(screen.getByRole("button", { name: t("evidence.startRecording") }));
    await user.press(await screen.findByRole("button", { name: t("evidence.stopRecording") }));
    await screen.findByLabelText(t("evidence.thumbVideo", { seconds: 42 }));
    expect(next()).toBeDisabled();

    await user.press(screen.getByRole("button", { name: t("evidence.photoMode") }));
    await takePhotos(user, 1);
    expect(next()).toBeEnabled();
    expect(screen.queryByText(t("evidence.needPhoto"))).toBeNull();
    await user.press(next());
    expect(onContinue).toHaveBeenCalled();
  });
});

describe("CIT-08: a photo (FR-PUB.5, FR-PUB.25, NFR-8, DG-63)", () => {
  test("hashed at capture, moved into the draft — never copied — with its capture time", async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, ...Buffer.from("SYNTHETIC-PHOTO")]);
    camera.photo = bytes;
    const { user } = await open();
    await takePhotos(user, 1);
    const [row] = await photosInDraft();
    expect(row?.sha256).toBe(sha256(bytes));
    expect(row?.captured_at).toBe(NOW.toISOString());
    expect(row?.mime_type).toBe("image/jpeg");
    expect(await draftMediaFile(row?.file_name ?? "").bytes()).toEqual(bytes);
    expect(new File(Paths.cache, "camera-photo-1.jpg").exists).toBe(false);
    expect(fsControl.moves).toBe(1);
    expect(fsControl.copies).toBe(0);
    expect(announce).toHaveBeenCalledWith(t("evidence.photoSaved", { photos: 1 }));
  });

  test("kept small by the camera's own settings: about 3 megapixels at quality 0.7", async () => {
    const { user } = await open();
    await waitFor(() => expect(camera.lastProps.pictureSize).toBe("1920x1080"));
    expect(camera.lastProps.mode).toBe("picture");
    expect(camera.lastProps.facing).toBe("back");
    await takePhotos(user, 1);
    expect(camera.takePicture).toEqual([{ quality: 0.7, exif: false }]);
  });

  test("three photos at most: the shutter stops at three and says why", async () => {
    const { user } = await open();
    await takePhotos(user, 3);
    expect(screen.getByRole("button", { name: t("evidence.takePhoto") })).toBeDisabled();
    expect(screen.getByText(t("evidence.photoLimit"))).toBeTruthy();
    expect(screen.getByText(t("evidence.counts", { photos: 3, videos: 0 }))).toBeTruthy();
    expect(await photosInDraft()).toHaveLength(3);
  });

  test("storage nearly full: nothing is captured, the reason is named, earlier items stay", async () => {
    const { user } = await open();
    await takePhotos(user, 1);
    fsControl.availableDiskSpace = 10 * MiB;
    await user.press(screen.getByRole("button", { name: t("evidence.takePhoto") }));
    expect(await screen.findByText(t("evidence.storageFull"))).toBeTruthy();
    expect(camera.takePicture).toHaveLength(1);
    expect(await photosInDraft()).toHaveLength(1);
  });

  test("a camera failure is named and keeps the draft and earlier items", async () => {
    const { user } = await open();
    await takePhotos(user, 1);
    camera.photoError = new Error("camera busy");
    await user.press(screen.getByRole("button", { name: t("evidence.takePhoto") }));
    expect(await screen.findByText(t("evidence.saveFailed"))).toBeTruthy();
    expect(await photosInDraft()).toHaveLength(1);
  });
});

describe("CIT-08: the optional video (FR-PUB.4, FR-PUB.6, DG-54)", () => {
  test("720p, stopped by the camera at 60 seconds and 40 MiB, its length read from the file", async () => {
    const { user } = await open();
    await user.press(screen.getByRole("button", { name: t("evidence.videoMode") }));
    expect(camera.lastProps.mode).toBe("video");
    expect(camera.lastProps.videoQuality).toBe("720p");
    expect(camera.lastProps.videoBitrate).toBe(4_500_000); // F-2: otherwise 40 MiB ends a video at about 26 s
    expect(camera.lastProps.mute).toBe(false); // DG-71: a video includes sound
    await user.press(screen.getByRole("button", { name: t("evidence.startRecording") }));
    expect(camera.record).toEqual([{ maxDuration: 60, maxFileSize: 40 * MiB }]);
    expect(screen.getByRole("button", { name: t("evidence.photoMode") })).toBeDisabled();
    await user.press(screen.getByRole("button", { name: t("evidence.stopRecording") }));
    expect(camera.stops).toBe(1);
    await screen.findByLabelText(t("evidence.thumbVideo", { seconds: 42 }));
    const [video] = await drafts.evidence(draftId);
    expect(video).toMatchObject({ kind: "video", mime_type: "video/mp4", duration_seconds: 42 });
    expect(video?.sha256).toBe(sha256(camera.video as Uint8Array));
    expect(announce).toHaveBeenCalledWith(t("evidence.videoSaved", { seconds: 42 }));
  });

  test("one video at most; a video over 60 seconds is not kept, and the reason is given", async () => {
    camera.video = syntheticMp4({ seconds: 61 });
    const { user } = await open();
    await user.press(screen.getByRole("button", { name: t("evidence.videoMode") }));
    await user.press(screen.getByRole("button", { name: t("evidence.startRecording") }));
    await user.press(await screen.findByRole("button", { name: t("evidence.stopRecording") }));
    expect(await screen.findByText(t("evidence.videoTooLong"))).toBeTruthy();
    expect(await drafts.evidence(draftId)).toHaveLength(0);
    expect(new File(Paths.cache, "camera-video-1.mp4").exists).toBe(false);

    camera.video = syntheticMp4({ seconds: 30 });
    await user.press(screen.getByRole("button", { name: t("evidence.startRecording") }));
    await user.press(await screen.findByRole("button", { name: t("evidence.stopRecording") }));
    await screen.findByLabelText(t("evidence.thumbVideo", { seconds: 30 }));
    expect(screen.getByRole("button", { name: t("evidence.startRecording") })).toBeDisabled();
    expect(screen.getByText(t("evidence.videoLimit"))).toBeTruthy();
  });

  test("DG-71: a video without sound is not kept, and the citizen is told why", async () => {
    camera.video = syntheticMp4({ seconds: 20, tracks: ["vide"] });
    const { user } = await open();
    await user.press(screen.getByRole("button", { name: t("evidence.videoMode") }));
    await user.press(screen.getByRole("button", { name: t("evidence.startRecording") }));
    await user.press(await screen.findByRole("button", { name: t("evidence.stopRecording") }));
    expect(await screen.findByText(t("evidence.noSound"))).toBeTruthy();
    expect(await drafts.evidence(draftId)).toHaveLength(0);
    expect(new File(Paths.cache, "camera-video-1.mp4").exists).toBe(false);
  });

  test("a video needs room for 40 MiB before it starts", async () => {
    fsControl.availableDiskSpace = 50 * MiB;
    const { user } = await open();
    await user.press(screen.getByRole("button", { name: t("evidence.videoMode") }));
    await user.press(screen.getByRole("button", { name: t("evidence.startRecording") }));
    expect(await screen.findByText(t("evidence.storageFull"))).toBeTruthy();
    expect(camera.record).toHaveLength(0);
  });
});

describe("CIT-08: permissions, explained first (FR-COMMON.16, FR-PUB.7, UC-CIT-017)", () => {
  test("the camera is explained before Android asks, and asked only when the citizen taps", async () => {
    camera.permissions.camera = UNDETERMINED;
    camera.onRequest.camera = () => GRANTED;
    const { user } = await open();
    expect(screen.getByText(t("evidence.cameraWhy"))).toBeTruthy();
    expect(screen.queryByTestId("camera")).toBeNull();
    await user.press(screen.getByRole("button", { name: t("evidence.allowCamera") }));
    expect(await screen.findByTestId("camera")).toBeTruthy();
  });

  test("a refusal gets a plain explanation and Settings — never a gallery — and the draft is kept", async () => {
    camera.permissions.camera = BLOCKED;
    const settings = jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
    const { user } = await open();
    expect(screen.getByText(t("evidence.cameraDenied"))).toBeTruthy();
    expect(screen.getByText(t("evidence.cameraSettings"))).toBeTruthy();
    expect(buttonLabels()).toEqual([t("evidence.openSettings"), t("common.continue")]);
    expect(screen.getByRole("button", { name: t("common.continue") })).toBeDisabled();
    await user.press(screen.getByRole("button", { name: t("evidence.openSettings") }));
    expect(settings).toHaveBeenCalled();
    expect(await drafts.get(draftId)).not.toBeNull();
  });

  test("a video also needs the microphone, explained first; refused, photos still work", async () => {
    camera.permissions.microphone = UNDETERMINED;
    camera.onRequest.microphone = () => BLOCKED;
    jest.spyOn(Linking, "openSettings").mockResolvedValue(undefined);
    const { user } = await open();
    await user.press(screen.getByRole("button", { name: t("evidence.videoMode") }));
    expect(screen.getByText(t("evidence.micWhy"))).toBeTruthy();
    expect(screen.queryByRole("button", { name: t("evidence.startRecording") })).toBeNull();
    await user.press(screen.getByRole("button", { name: t("evidence.allowMicrophone") }));
    expect(await screen.findByText(t("evidence.micDenied"))).toBeTruthy();
    expect(screen.getByText(t("evidence.micSettings"))).toBeTruthy();
    expect(screen.getByRole("button", { name: t("evidence.openSettings") })).toBeTruthy();
    await user.press(screen.getByRole("button", { name: t("evidence.photoMode") }));
    await takePhotos(user, 1);
  });
});

describe("CIT-08: after a refusal (FR-PUB.7; finding F-3, 2026-10-10)", () => {
  test("Android can still ask: the consequence and Allow, no Settings instruction; a second refusal leads to Settings", async () => {
    camera.permissions.camera = REFUSED_ONCE;
    camera.onRequest.camera = () => BLOCKED;
    const { user } = await open();
    expect(screen.getByText(t("evidence.cameraDenied"))).toBeTruthy();
    expect(screen.queryByText(t("evidence.cameraSettings"))).toBeNull();
    expect(screen.queryByRole("button", { name: t("evidence.openSettings") })).toBeNull();
    await user.press(screen.getByRole("button", { name: t("evidence.allowCamera") }));
    expect(await screen.findByText(t("evidence.cameraSettings"))).toBeTruthy();
    expect(screen.getByRole("button", { name: t("evidence.openSettings") })).toBeTruthy();
    expect(screen.queryByTestId("camera")).toBeNull();
  });

  test("allowed in Settings: the camera appears as soon as the citizen comes back, with no reopening", async () => {
    const listeners: ((state: string) => void)[] = [];
    jest.spyOn(AppState, "addEventListener").mockImplementation((_type, listener) => {
      listeners.push(listener as (state: string) => void);
      return { remove: () => undefined } as ReturnType<typeof AppState.addEventListener>;
    });
    camera.permissions.camera = BLOCKED;
    camera.permissions.microphone = BLOCKED;
    await open();
    expect(screen.getByRole("button", { name: t("evidence.openSettings") })).toBeTruthy();
    camera.permissions.camera = GRANTED; // the citizen allows it in Settings
    await act(async () => listeners.forEach((listener) => listener("background")));
    expect(screen.queryByTestId("camera")).toBeNull();
    await act(async () => listeners.forEach((listener) => listener("active")));
    expect(await screen.findByTestId("camera")).toBeTruthy();
    expect(screen.queryByText(t("evidence.cameraSettings"))).toBeNull();
  });
});

describe("CIT-08: review, retake and delete (FR-PUB.6, UC-CIT-016)", () => {
  test("delete removes the item and its file from the local draft only", async () => {
    const { user } = await open();
    await takePhotos(user, 2);
    const [first] = await photosInDraft();
    await user.press(screen.getByLabelText(t("evidence.thumbPhoto", { n: 1 })));
    expect(await screen.findByText(t("evidence.reviewPhoto", { n: 1 }))).toBeTruthy();
    await user.press(screen.getByRole("button", { name: t("evidence.delete") }));
    await waitFor(async () => expect(await photosInDraft()).toHaveLength(1));
    expect(draftMediaFile(first?.file_name ?? "").exists).toBe(false);
    expect(announce).toHaveBeenCalledWith(t("evidence.deleted"));
    expect(screen.queryByTestId("CIT-08-review")).toBeNull();
  });

  test("retake removes the item and returns to the camera in the same mode", async () => {
    const { user } = await open();
    await user.press(screen.getByRole("button", { name: t("evidence.videoMode") }));
    await user.press(screen.getByRole("button", { name: t("evidence.startRecording") }));
    await user.press(await screen.findByRole("button", { name: t("evidence.stopRecording") }));
    await user.press(await screen.findByLabelText(t("evidence.thumbVideo", { seconds: 42 })));
    expect(await screen.findByTestId("video-player")).toBeTruthy();
    await user.press(screen.getByRole("button", { name: t("evidence.retake") }));
    await waitFor(async () => expect(await drafts.evidence(draftId)).toHaveLength(0));
    expect(screen.getByRole("button", { name: t("evidence.startRecording") })).toBeEnabled();
  });
});

describe("CIT-08 and CIT-09 share a draft", () => {
  test("a recording made on CIT-09 is not shown, counted or reviewable as a video on CIT-08", async () => {
    const recording = new File(Paths.cache, "recording.m4a");
    recording.write(syntheticMp4({ seconds: 30, tracks: ["soun"] }));
    await ingestCapture(drafts, draftId, {
      uri: recording.uri,
      kind: "voice_original",
      mimeType: "audio/mp4",
      capturedAt: NOW.toISOString(),
    });
    const { user } = await open();
    expect(screen.queryByLabelText(t("evidence.thumbVideo", { seconds: 30 }))).toBeNull();
    await user.press(screen.getByRole("button", { name: t("evidence.videoMode") }));
    expect(screen.getByRole("button", { name: t("evidence.startRecording") })).toBeEnabled();
    expect(screen.queryByText(t("evidence.videoLimit"))).toBeNull();
  });
});

describe("CIT-08: drafts that cannot change", () => {
  test("a draft no longer on the phone offers no camera", async () => {
    draftId = "99999999-9999-4999-8999-999999999999";
    await render(<EvidenceScreen drafts={drafts} draftId={draftId} onContinue={jest.fn()} />);
    expect(await screen.findByText(t("evidence.draftGone"))).toBeTruthy();
    expect(screen.queryByTestId("camera")).toBeNull();
  });

  test("a submitted draft's evidence cannot change", async () => {
    await drafts.update(draftId, { pipeline_state: "READY_TO_SUBMIT" });
    await render(<EvidenceScreen drafts={drafts} draftId={draftId} onContinue={jest.fn()} />);
    expect(await screen.findByText(t("evidence.notEditable"))).toBeTruthy();
    expect(screen.queryByTestId("camera")).toBeNull();
  });
});

describe("opening the citizen's drafts", () => {
  test("offline before the account is known on this phone: a plain message", async () => {
    await render(<CitizenStoreStatus state={{ status: "failed", reason: "offline" }} />);
    expect(screen.getByText(t("evidence.needConnection"))).toBeTruthy();
    await act(async () => undefined);
  });
});
