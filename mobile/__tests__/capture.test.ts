/**
 * T-049: what turns a camera's file into draft evidence — the video duration
 * read from the container as the server reads it (DG-54), the size limits, and
 * the camera settings (NFR-8). T-050: the same for a recording (FR-PUB.10).
 * The files are synthetic; no real media is used.
 */
import { createHash } from "crypto";

import {
  CAPTURE_SETTINGS,
  choosePictureSize,
  roomToCapture,
  videoFitsLimit,
  videoMimeType,
} from "../src/domain/captureSettings";
import { MalformedMedia, summariseMedia } from "../src/domain/mp4";
import { MAX_RECORDING_SECONDS, RECORDING_SETTINGS } from "../src/domain/recordingSettings";
import { ingestCapture } from "../src/storage/capture";
import { draftRepository, EvidenceRefused } from "../src/storage/drafts";
import { draftMediaFile } from "../src/storage/media";
import { migrate } from "../src/storage/schema";
import { File, fsControl, Paths, resetFileSystem } from "./fakes/fileSystem";
import { box, syntheticMp4 } from "./fakes/mp4";
import { memoryDatabase, resetSqlite } from "./fakes/sqlite";

jest.mock("expo-file-system", () => jest.requireActual("./fakes/fileSystem"));
jest.mock("expo-sqlite", () => jest.requireActual("./fakes/sqlite"));

const ACCOUNT = "11111111-1111-4111-8111-111111111111"; // synthetic
const NOW = new Date("2026-10-09T10:00:00.000Z");
const MiB = 1024 * 1024;

const sha256 = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

function cacheFile(name: string, bytes: Uint8Array): string {
  const file = new File(Paths.cache, name);
  file.write(bytes);
  return file.uri;
}

async function newDraft() {
  const db = memoryDatabase();
  await migrate(db);
  const drafts = draftRepository(db, ACCOUNT, () => NOW);
  return { drafts, draft: await drafts.create() };
}

async function refusal(promise: Promise<unknown>): Promise<string> {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(EvidenceRefused);
  return (error as EvidenceRefused).reason;
}

beforeEach(() => {
  resetFileSystem();
  resetSqlite();
});

describe("reading a video's duration (the same reading as the backend)", () => {
  test("version 0 and version 1 movie headers, before or after the media data", () => {
    expect(summariseMedia(syntheticMp4({ seconds: 42 })).durationSeconds).toBe(42);
    expect(summariseMedia(syntheticMp4({ seconds: 59.5, version: 1 })).durationSeconds).toBe(59.5);
    expect(summariseMedia(syntheticMp4({ seconds: 12, moovFirst: true })).durationSeconds).toBe(12);
    expect(summariseMedia(syntheticMp4({ seconds: 3, timescale: 90000 })).durationSeconds).toBe(3);
  });

  test("track types and the brand are read", () => {
    const video = summariseMedia(syntheticMp4());
    expect(video.brand).toBe("isom");
    expect([...video.trackTypes]).toEqual(["vide", "soun"]);
    expect([...summariseMedia(syntheticMp4({ tracks: ["soun"] })).trackTypes]).toEqual(["soun"]);
  });

  test("anything malformed is refused, never trusted", () => {
    const good = syntheticMp4();
    const cases: Uint8Array[] = [
      new Uint8Array(0),
      new Uint8Array([1, 2, 3]),
      good.subarray(0, good.length - 20), // cut off inside the movie header
      box("ftyp", new Uint8Array(4)), // no movie
      box("moov", box("mvhd", new Uint8Array(20))), // no ftyp
      new Uint8Array(
        Buffer.concat([box("ftyp", Buffer.from("isom")), box("moov", box("mvhd", new Uint8Array([7])))]),
      ),
      new Uint8Array(Buffer.concat([box("ftyp", Buffer.from("isom")), box("moov")])), // no movie header
    ];
    for (const bytes of cases) expect(() => summariseMedia(bytes)).toThrow(MalformedMedia);
    const zeroTimescale = new Uint8Array(
      Buffer.concat([box("ftyp", Buffer.from("isom")), box("moov", box("mvhd", new Uint8Array(100)))]),
    );
    expect(() => summariseMedia(zeroTimescale)).toThrow("zero timescale");
    const oversized = new Uint8Array(good);
    oversized.set([0x7f, 0xff, 0xff, 0xff], 0); // the first box claims more bytes than exist
    expect(() => summariseMedia(oversized)).toThrow(MalformedMedia);
  });
});

describe("camera settings (NFR-8, DG-54)", () => {
  test("the largest picture size at or below about 3 megapixels, else the smallest offered", () => {
    expect(choosePictureSize(["4000x3000", "1920x1080", "1280x720", "2048x1536"])).toBe("2048x1536");
    expect(choosePictureSize(["1280x720", "1920x1080"])).toBe("1920x1080");
    expect(choosePictureSize(["8000x6000", "4000x3000"])).toBe("4000x3000");
    expect(choosePictureSize(["Photo", "", "0x0"])).toBeUndefined();
    expect(choosePictureSize([])).toBeUndefined();
  });

  test("the decided video limits and the settings approved by DG-72", () => {
    expect(CAPTURE_SETTINGS.videoQuality).toBe("720p");
    expect(CAPTURE_SETTINGS.videoMaxSeconds).toBe(60);
    expect(CAPTURE_SETTINGS.videoMaxBytes).toBe(40 * MiB);
    expect(CAPTURE_SETTINGS.photoMaxBytes).toBe(10 * MiB);
    expect(CAPTURE_SETTINGS.photoQuality).toBeGreaterThan(0);
    expect(CAPTURE_SETTINGS.photoQuality).toBeLessThan(1);
  });

  test("F-2: a full 60-second video at the configured bitrate fits under the camera's stop point", () => {
    // On the test phone the default 12 Mbit/s filled 40 MiB in 26 seconds (VAL-061).
    expect(CAPTURE_SETTINGS.videoBitrate).toBe(4_500_000);
    expect(videoFitsLimit(60)).toBe(true);
    expect(videoFitsLimit(75)).toBe(false); // the margin is real, not unbounded
  });

  test("a capture is started only with room for it", () => {
    expect(roomToCapture("photo", CAPTURE_SETTINGS.minFreeBytesForPhoto)).toBe(true);
    expect(roomToCapture("photo", CAPTURE_SETTINGS.minFreeBytesForPhoto - 1)).toBe(false);
    expect(roomToCapture("video", CAPTURE_SETTINGS.minFreeBytesForVideo - 1)).toBe(false);
    expect(CAPTURE_SETTINGS.minFreeBytesForVideo).toBeGreaterThan(CAPTURE_SETTINGS.videoMaxBytes);
  });

  test("the container type comes from the file the camera wrote", () => {
    expect(videoMimeType("file:///cache/Camera/abc.mp4")).toBe("video/mp4");
    expect(videoMimeType("file:///tmp/abc.MOV")).toBe("video/quicktime");
    expect(videoMimeType("file:///tmp/abc.3gp")).toBeNull();
  });
});

describe("a video becomes draft evidence", () => {
  test("its duration is read from the file, hashed at capture, and the file is moved, not copied", async () => {
    const { drafts, draft } = await newDraft();
    const bytes = syntheticMp4({ seconds: 42 });
    const uri = cacheFile("capture.mp4", bytes);
    const row = await ingestCapture(drafts, draft.client_submission_id, {
      uri,
      kind: "video",
      mimeType: "video/mp4",
      capturedAt: NOW.toISOString(),
      durationSeconds: 5, // a claim from outside is not trusted: the container decides
    });
    expect(row.duration_seconds).toBe(42);
    expect(row.sha256).toBe(sha256(bytes));
    expect(row.captured_at).toBe(NOW.toISOString());
    expect(new File(uri).exists).toBe(false);
    expect(await draftMediaFile(row.file_name).bytes()).toEqual(bytes);
    expect(fsControl.moves).toBe(1);
    expect(fsControl.copies).toBe(0);
  });

  test("60 seconds and the container's half-second rounding are kept; longer is refused and deleted", async () => {
    const { drafts, draft } = await newDraft();
    const id = draft.client_submission_id;
    const capture = (seconds: number, name: string) => ({
      uri: cacheFile(name, syntheticMp4({ seconds })),
      kind: "video" as const,
      mimeType: "video/mp4",
      capturedAt: NOW.toISOString(),
    });
    const long = capture(61, "long.mp4");
    expect(await refusal(ingestCapture(drafts, id, long))).toBe("video_too_long");
    expect(new File(long.uri).exists).toBe(false);
    expect(await drafts.evidence(id)).toHaveLength(0);
    expect((await ingestCapture(drafts, id, capture(60.5, "edge.mp4"))).duration_seconds).toBe(60.5);
  });

  test("an unreadable video, or one without a video track, is refused and deleted", async () => {
    const { drafts, draft } = await newDraft();
    for (const [name, bytes] of [
      ["garbage.mp4", new Uint8Array(512).fill(7)],
      ["sound-only.mp4", syntheticMp4({ tracks: ["soun"] })],
      ["no-track.mp4", syntheticMp4({ tracks: [] })],
    ] as const) {
      const uri = cacheFile(name, bytes);
      const result = ingestCapture(drafts, draft.client_submission_id, {
        uri,
        kind: "video",
        mimeType: "video/mp4",
        capturedAt: NOW.toISOString(),
      });
      expect(await refusal(result)).toBe("unreadable_video");
      expect(new File(uri).exists).toBe(false);
    }
    expect(await drafts.evidence(draft.client_submission_id)).toHaveLength(0);
  });

  test("DG-71: a video without a sound track is refused and deleted — never kept silently", async () => {
    const { drafts, draft } = await newDraft();
    const uri = cacheFile("silent.mp4", syntheticMp4({ seconds: 20, tracks: ["vide"] }));
    const result = ingestCapture(drafts, draft.client_submission_id, {
      uri,
      kind: "video",
      mimeType: "video/mp4",
      capturedAt: NOW.toISOString(),
    });
    expect(await refusal(result)).toBe("video_without_sound");
    expect(new File(uri).exists).toBe(false);
    expect(await drafts.evidence(draft.client_submission_id)).toHaveLength(0);
  });

  test("an item over the server's limit is refused before it joins the draft", async () => {
    const { drafts, draft } = await newDraft();
    const big = new Uint8Array(CAPTURE_SETTINGS.photoMaxBytes + 1);
    const uri = cacheFile("big.jpg", big);
    const result = ingestCapture(drafts, draft.client_submission_id, {
      uri,
      kind: "photo",
      mimeType: "image/jpeg",
      capturedAt: NOW.toISOString(),
    });
    expect(await refusal(result)).toBe("too_large");
    expect(new File(uri).exists).toBe(false);
    const atLimit = cacheFile("limit.jpg", new Uint8Array(CAPTURE_SETTINGS.photoMaxBytes));
    await expect(
      ingestCapture(drafts, draft.client_submission_id, {
        uri: atLimit,
        kind: "photo",
        mimeType: "image/jpeg",
        capturedAt: NOW.toISOString(),
      }),
    ).resolves.toMatchObject({ byte_size: CAPTURE_SETTINGS.photoMaxBytes });
  });
});

describe("a recording becomes draft evidence (T-050)", () => {
  const recording = (uri: string) => ({
    uri,
    kind: "voice_original" as const,
    mimeType: RECORDING_SETTINGS.mimeType,
    capturedAt: NOW.toISOString(),
  });

  test("the recorder's own file: its length read from the file, hashed, moved, never copied or changed", async () => {
    const { drafts, draft } = await newDraft();
    const bytes = syntheticMp4({ seconds: 95.5, tracks: ["soun"] });
    const uri = cacheFile("recording.m4a", bytes);
    const row = await ingestCapture(drafts, draft.client_submission_id, {
      ...recording(uri),
      durationSeconds: 3,
    });
    expect(row).toMatchObject({ kind: "voice_original", mime_type: "audio/mp4", duration_seconds: 95.5 });
    expect(row.sha256).toBe(sha256(bytes));
    expect(row.file_name.endsWith(".m4a")).toBe(true);
    expect(await draftMediaFile(row.file_name).bytes()).toEqual(bytes);
    expect(new File(uri).exists).toBe(false);
    expect(fsControl.moves).toBe(1);
    expect(fsControl.copies).toBe(0);
  });

  test("a file that is not a sound-only recording is refused and deleted", async () => {
    const { drafts, draft } = await newDraft();
    for (const [name, bytes] of [
      ["garbage.m4a", new Uint8Array(512).fill(7)],
      ["with-picture.m4a", syntheticMp4({ tracks: ["vide", "soun"] })],
      ["picture-only.m4a", syntheticMp4({ tracks: ["vide"] })],
      ["no-track.m4a", syntheticMp4({ tracks: [] })],
    ] as const) {
      const uri = cacheFile(name, bytes);
      expect(await refusal(ingestCapture(drafts, draft.client_submission_id, recording(uri)))).toBe(
        "unreadable_recording",
      );
      expect(new File(uri).exists).toBe(false);
    }
    expect(await drafts.evidence(draft.client_submission_id)).toHaveLength(0);
  });

  test("over the server's 20 MiB limit is refused before it joins the draft", async () => {
    const { drafts, draft } = await newDraft();
    const uri = cacheFile("long.m4a", new Uint8Array(20 * MiB + 1));
    expect(await refusal(ingestCapture(drafts, draft.client_submission_id, recording(uri)))).toBe(
      "too_large",
    );
    expect(new File(uri).exists).toBe(false);
    expect(await drafts.evidence(draft.client_submission_id)).toHaveLength(0);
  });

  test("DG-74: 3 minutes and the container's half-second rounding are kept; longer is refused and deleted", async () => {
    const { drafts, draft } = await newDraft();
    const id = draft.client_submission_id;
    const long = cacheFile("long.m4a", syntheticMp4({ seconds: 181, tracks: ["soun"] }));
    expect(await refusal(ingestCapture(drafts, id, recording(long)))).toBe("recording_too_long");
    expect(new File(long).exists).toBe(false);
    expect(await drafts.evidence(id)).toHaveLength(0);
    const edge = cacheFile("edge.m4a", syntheticMp4({ seconds: 180.5, tracks: ["soun"] }));
    expect((await ingestCapture(drafts, id, recording(edge))).duration_seconds).toBe(180.5);
  });

  test("the approved settings (DG-74): AAC in MPEG-4, one channel, 64 kbit/s, stopped at 3 minutes", () => {
    expect(RECORDING_SETTINGS).toMatchObject({
      extension: ".m4a",
      mimeType: "audio/mp4",
      channels: 1,
      bitRate: 64_000,
    });
    expect(MAX_RECORDING_SECONDS).toBe(180);
    // A full 3 minutes at 64 kbit/s, with 2 % for the container, is far below the server's 20 MiB.
    expect((MAX_RECORDING_SECONDS * RECORDING_SETTINGS.bitRate * 1.02) / 8).toBeLessThan(2 * MiB);
    expect(RECORDING_SETTINGS.maxBytes).toBe(20 * MiB);
    expect(RECORDING_SETTINGS.minFreeBytes).toBeGreaterThan(RECORDING_SETTINGS.maxBytes);
  });
});
