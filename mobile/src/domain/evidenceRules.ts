/**
 * Evidence bounds decided by Hassan on 2026-10-04: 1–3 live photos (DG-47)
 * and at most one live video of up to 60 seconds that never replaces a photo
 * (DG-54). The backend enforces the same bounds and has the final word.
 */
export const EVIDENCE_RULES = {
  photoMin: 1,
  photoMax: 3,
  videoMax: 1,
  videoMaxSeconds: 60,
  /** Container rounding; equals the backend's PARAKH_VIDEO_DURATION_TOLERANCE_SECONDS. */
  videoDurationToleranceSeconds: 0.5,
  voiceMax: 1,
} as const;

export type EvidenceKind = "photo" | "video" | "voice_original";

export const MIME_TYPES: Record<EvidenceKind, readonly string[]> = {
  photo: ["image/jpeg"],
  video: ["video/mp4", "video/quicktime"],
  voice_original: ["audio/mp4", "audio/m4a"], // AAC in MPEG-4, as expo-audio records it
};

/** Why another item of this kind cannot be added, or null when it can. */
export function addRefusal(
  kind: EvidenceKind,
  counts: Partial<Record<EvidenceKind, number>>,
  durationSeconds?: number | null,
): "photo_limit" | "video_limit" | "voice_limit" | "video_too_long" | null {
  const n = counts[kind] ?? 0;
  if (kind === "photo" && n >= EVIDENCE_RULES.photoMax) return "photo_limit";
  if (kind === "video") {
    if (n >= EVIDENCE_RULES.videoMax) return "video_limit";
    const limit = EVIDENCE_RULES.videoMaxSeconds + EVIDENCE_RULES.videoDurationToleranceSeconds;
    if (durationSeconds != null && durationSeconds > limit) return "video_too_long";
  }
  if (kind === "voice_original" && n >= EVIDENCE_RULES.voiceMax) return "voice_limit";
  return null;
}
