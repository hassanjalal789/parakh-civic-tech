/**
 * Evidence bounds decided by Hassan on 2026-10-04: 1–3 live photos (DG-47)
 * and at most one live video of up to 60 seconds that never replaces a photo
 * (DG-54). A spoken description of at most 3 minutes (DG-74, Hassan Jalal,
 * 2026-10-11). The backend enforces the same bounds and has the final word.
 */
export const EVIDENCE_RULES = {
  photoMin: 1,
  photoMax: 3,
  videoMax: 1,
  videoMaxSeconds: 60,
  /** Container rounding; equals the backend's PARAKH_VIDEO_DURATION_TOLERANCE_SECONDS. */
  videoDurationToleranceSeconds: 0.5,
  voiceMax: 1,
  /** DG-74 (Hassan Jalal, 2026-10-11): the product limit for a spoken description, a hard maximum. */
  voiceMaxSeconds: 180,
  /** Container rounding, as for a video; equals the backend's PARAKH_RECORDING_DURATION_TOLERANCE_SECONDS. */
  voiceDurationToleranceSeconds: 0.5,
  /** DG-77: one spoken location description, only when there are no coordinates. */
  locationVoiceMax: 1,
  /** DG-79 (Hassan Jalal, 2026-10-11): a spoken location description lasts at most 1 minute, a hard maximum. */
  locationVoiceMaxSeconds: 60,
} as const;

/**
 * `location_voice` (DG-77, Hassan Jalal, 2026-10-11): the reporter's spoken description of where the issue
 * is, kept as evidence and never sent to the AI. Recorded like `voice_original` (DG-74's settings), but
 * for at most 1 minute (DG-79).
 */
export type EvidenceKind = "photo" | "video" | "voice_original" | "location_voice";

export const MIME_TYPES: Record<EvidenceKind, readonly string[]> = {
  photo: ["image/jpeg"],
  video: ["video/mp4", "video/quicktime"],
  voice_original: ["audio/mp4", "audio/m4a"], // AAC in MPEG-4, as expo-audio records it
  location_voice: ["audio/mp4", "audio/m4a"],
};

/** Why another item of this kind cannot be added, or null when it can. */
export function addRefusal(
  kind: EvidenceKind,
  counts: Partial<Record<EvidenceKind, number>>,
  durationSeconds?: number | null,
): "photo_limit" | "video_limit" | "voice_limit" | "video_too_long" | "recording_too_long" | null {
  const n = counts[kind] ?? 0;
  if (kind === "photo" && n >= EVIDENCE_RULES.photoMax) return "photo_limit";
  if (kind === "video") {
    if (n >= EVIDENCE_RULES.videoMax) return "video_limit";
    const limit = EVIDENCE_RULES.videoMaxSeconds + EVIDENCE_RULES.videoDurationToleranceSeconds;
    if (durationSeconds != null && durationSeconds > limit) return "video_too_long";
  }
  if (kind === "voice_original" || kind === "location_voice") {
    const max = kind === "voice_original" ? EVIDENCE_RULES.voiceMax : EVIDENCE_RULES.locationVoiceMax;
    if (n >= max) return "voice_limit";
    const seconds =
      kind === "voice_original" ? EVIDENCE_RULES.voiceMaxSeconds : EVIDENCE_RULES.locationVoiceMaxSeconds;
    const limit = seconds + EVIDENCE_RULES.voiceDurationToleranceSeconds;
    if (durationSeconds != null && durationSeconds > limit) return "recording_too_long";
  }
  return null;
}
