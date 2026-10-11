/**
 * Recording settings for CIT-09 (FR-PUB.9–FR-PUB.11).
 *
 * APPROVED by Hassan Jalal on 2026-10-11 (DG-74):
 * - AAC in an MPEG-4 file, one channel, 64 kbit/s — clear speech at about half a
 *   megabyte a minute.
 * - A hard maximum of 3 minutes for a citizen's spoken description: the product
 *   limit, not the length the server's 20 MiB item limit would allow. The recorder
 *   stops itself at 3 minutes, and a longer file is refused on the device and on the
 *   server (EVIDENCE_RULES.voiceMaxSeconds).
 */
import { EVIDENCE_RULES } from "./evidenceRules";

const MiB = 1024 * 1024;

export const RECORDING_SETTINGS = {
  extension: ".m4a",
  mimeType: "audio/mp4",
  sampleRate: 44_100,
  channels: 1,
  bitRate: 64_000,
  /** The server's item limit (docs/api/CITIZEN_REPORTING_CONTRACT.md); a 3-minute recording is far below it. */
  maxBytes: 20 * MiB,
  /** Free space needed before a recording starts (proposed with DG-74, kept unchanged). */
  minFreeBytes: 20 * MiB + 5 * MiB,
} as const;

/** The recorder stops itself here: 3 minutes (DG-74). */
export const MAX_RECORDING_SECONDS = EVIDENCE_RULES.voiceMaxSeconds;

/** The server's limit on typed report text, in characters (backend MAX_TYPED_DESCRIPTION). */
export const MAX_TYPED_CHARACTERS = 4000;
