/**
 * Recording settings for CIT-09 (FR-PUB.9–FR-PUB.11).
 *
 * The server accepts a recording of at most 20 MiB (docs/api/CITIZEN_REPORTING_CONTRACT.md).
 * No requirement sets a maximum length for a spoken description; the cap below
 * only keeps a recording under that limit, so it can always be sent.
 *
 * PROPOSED technical defaults (DG-74, 2026-10-11), reversible: AAC in an MPEG-4
 * file, one channel, 64 kbit/s — clear speech at about half a megabyte a minute.
 * A shorter product limit for a spoken description would be the Project Lead's
 * decision; none is set here.
 */
const MiB = 1024 * 1024;

export const RECORDING_SETTINGS = {
  extension: ".m4a",
  mimeType: "audio/mp4",
  sampleRate: 44_100,
  channels: 1,
  bitRate: 64_000,
  maxBytes: 20 * MiB,
  /** Free space needed before a recording starts: the largest recording and a margin. */
  minFreeBytes: 20 * MiB + 5 * MiB,
} as const;

/**
 * The longest recording that stays under the server's limit: 95 % of 20 MiB at the
 * configured bitrate, with about 2 % for the container — about 40 minutes.
 */
export const MAX_RECORDING_SECONDS = Math.floor(
  (0.95 * RECORDING_SETTINGS.maxBytes * 8) / (RECORDING_SETTINGS.bitRate * 1.02),
);

/** The server's limit on typed report text, in characters (backend MAX_TYPED_DESCRIPTION). */
export const MAX_TYPED_CHARACTERS = 4000;
