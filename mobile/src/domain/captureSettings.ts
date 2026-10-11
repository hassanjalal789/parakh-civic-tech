/**
 * Camera settings for CIT-08 (FR-PUB.4, NFR-8, DG-54).
 *
 * Decided: video at 720p, stopped by the camera at 60 seconds and 40 MiB
 * (DG-54; docs/api/CITIZEN_REPORTING_CONTRACT.md). The server's item limits are
 * 10 MiB for a photo and 40 MiB for a video.
 *
 * Settings proposed on 2026-10-09/10 and APPROVED by Hassan Jalal on 2026-10-11 (DG-72):
 * - NFR-8 requires photos kept small through the camera's own quality and
 *   picture-size settings, with no second copy, but sets no number. On the test
 *   phone these settings give 2.76 MP photos of about 0.2 MB.
 * - DG-54 sets no video bitrate. At the phone's default (12 Mbit/s for 720p on
 *   the test phone) the 40 MiB limit stopped a recording after 26 seconds
 *   (finding F-2), so a 60-second video was impossible. The bitrate below keeps
 *   a full 60 seconds, with sound, under the limit.
 * - The free-space margins refuse a capture before it starts rather than fail
 *   half-way (FR-COMMON.14).
 *
 * On iOS, expo-camera applies the bitrate only when recordAsync is given a
 * codec; that is set and tested with the iOS build (T-024).
 */
const MiB = 1024 * 1024;

export const CAPTURE_SETTINGS = {
  photoQuality: 0.7, // DG-72
  /** The largest picture size offered at or below about 3 megapixels (DG-72). */
  maxPicturePixels: 3_200_000,
  videoQuality: "720p",
  /** Video encoder bitrate in bits per second (DG-72; see videoFitsLimit). */
  videoBitrate: 4_500_000,
  videoMaxSeconds: 60,
  videoMaxBytes: 40 * MiB,
  photoMaxBytes: 10 * MiB,
  /** Free space needed before a photo or a video is started (DG-72). */
  minFreeBytesForPhoto: 25 * MiB,
  minFreeBytesForVideo: 40 * MiB + 25 * MiB,
} as const;

/**
 * Chooses the camera's own picture size (NFR-8): the largest offered size at or
 * below the pixel limit; if every size is larger, the smallest one. Sizes come
 * from getAvailablePictureSizesAsync() as "WIDTHxHEIGHT"; others are ignored.
 */
export function choosePictureSize(
  sizes: readonly string[],
  maxPixels: number = CAPTURE_SETTINGS.maxPicturePixels,
): string | undefined {
  const parsed = sizes
    .map((size) => {
      const match = /^(\d+)x(\d+)$/.exec(size);
      return match ? { size, pixels: Number(match[1]) * Number(match[2]) } : null;
    })
    .filter((s): s is { size: string; pixels: number } => s !== null && s.pixels > 0)
    .sort((a, b) => a.pixels - b.pixels);
  if (parsed.length === 0) return undefined;
  const fitting = parsed.filter((s) => s.pixels <= maxPixels);
  return (fitting.length > 0 ? fitting[fitting.length - 1] : parsed[0])?.size;
}

/**
 * Whether a full-length video at the configured bitrate fits under the point where
 * the camera library stops a recording: 95 % of the size limit (observed in CameraX
 * on the test phone), counting its 256 kbit/s AAC audio and about 2 % container overhead.
 */
export function videoFitsLimit(seconds: number = CAPTURE_SETTINGS.videoMaxSeconds): boolean {
  const AUDIO_BITRATE = 256_000;
  const bytes = (((CAPTURE_SETTINGS.videoBitrate + AUDIO_BITRATE) * seconds) / 8) * 1.02;
  return bytes < 0.95 * CAPTURE_SETTINGS.videoMaxBytes;
}

/** Whether there is room to start this kind of capture. */
export function roomToCapture(kind: "photo" | "video", availableBytes: number): boolean {
  const needed =
    kind === "photo" ? CAPTURE_SETTINGS.minFreeBytesForPhoto : CAPTURE_SETTINGS.minFreeBytesForVideo;
  return availableBytes >= needed;
}

/** The container type of a recorded video, from its file name: MP4 on Android, QuickTime on iOS. */
export function videoMimeType(uri: string): "video/mp4" | "video/quicktime" | null {
  const lower = uri.toLowerCase();
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".mov")) return "video/quicktime";
  return null;
}
