/**
 * The report's location (FR-PUB.24; DG-30, DG-73, DG-77 — Hassan Jalal, 2026-10-11).
 *
 * - First the phone's current GPS position; failing that, its last known position;
 *   failing both (or with location refused), the reporter describes the place by
 *   voice or in writing — typing is never required (DG-77) — and the report says
 *   plainly that precise coordinates were not available. A spoken description is a
 *   `location_voice` recording among the draft's evidence, never interpreted by AI.
 * - A measured position may be moved with directional buttons. **What the phone
 *   measured is kept unchanged beside the position the reporter confirms**; an
 *   adjusted position is never presented as the measurement (M3).
 * - No map, no map provider, no address lookup (DG-30).
 *
 * The server derives the source and the unverified flag by the same rules; these
 * functions let the screens show them before anything is sent.
 */

/** Characters; a technical safeguard like the typed-text limit, not a product rule (backend LOCATION_DESCRIPTION_MAX). */
export const LOCATION_DESCRIPTION_MAX = 500;

export type MeasuredPosition = {
  latitude: number;
  longitude: number;
  /** Metres, as the phone reported it; absent when the phone gives none. */
  accuracyM: number | null;
  fix: "current" | "last_known";
  /** The reading's own time from the phone (ISO 8601) — not the report's capture time. */
  measuredAt: string;
};

export type Position = { latitude: number; longitude: number };

export type ReportLocation =
  | { kind: "coordinates"; measured: MeasuredPosition; reported: Position }
  | { kind: "description"; description: string }
  /** Described by voice: the draft holds one `location_voice` recording (DG-77). */
  | { kind: "spoken" };

export type LocationSource =
  "gps_current" | "gps_last_known" | "adjusted" | "written_description" | "spoken_description";

/** API-130 `location` (docs/api/CITIZEN_REPORTING_CONTRACT.md). */
export type LocationBody = {
  measured: {
    latitude: number;
    longitude: number;
    accuracy_m: number | null;
    fix: "current" | "last_known";
    measured_at: string;
  } | null;
  reported: Position | null;
  description: string | null;
  spoken_description: boolean;
};

/** Coordinates as the server stores them: six decimal places (about 0.1 m). */
const micro = (degrees: number) => Math.round(degrees * 1e6);

export function isAdjusted(location: ReportLocation): boolean {
  if (location.kind !== "coordinates") return false;
  const { measured, reported } = location;
  return (
    micro(measured.latitude) !== micro(reported.latitude) ||
    micro(measured.longitude) !== micro(reported.longitude)
  );
}

export function locationSource(location: ReportLocation): LocationSource {
  if (location.kind === "description") return "written_description";
  if (location.kind === "spoken") return "spoken_description";
  if (isAdjusted(location)) return "adjusted";
  return location.measured.fix === "current" ? "gps_current" : "gps_last_known";
}

/** FR-PUB.24: anything but an unadjusted current GPS fix is unverified. */
export function locationUnverified(location: ReportLocation): boolean {
  return locationSource(location) !== "gps_current";
}

const inRange = (value: number, limit: number) => Number.isFinite(value) && Math.abs(value) <= limit;

/** Why the server would refuse this location, or null. */
export function locationProblem(location: ReportLocation): string | null {
  if (location.kind === "spoken") return null; // its recording is checked when it is captured and sent
  if (location.kind === "description") {
    const { description } = location;
    if (!description.trim()) return "description_blank";
    if (description.length > LOCATION_DESCRIPTION_MAX) return "description_too_long";
    return null;
  }
  const { measured, reported } = location;
  if (!inRange(measured.latitude, 90) || !inRange(measured.longitude, 180)) return "measured_out_of_range";
  if (!inRange(reported.latitude, 90) || !inRange(reported.longitude, 180)) return "reported_out_of_range";
  if (measured.accuracyM !== null && !(measured.accuracyM >= 0 && measured.accuracyM <= 100_000)) {
    return "accuracy_out_of_range";
  }
  if (measured.fix !== "current" && measured.fix !== "last_known") return "unknown_fix";
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(measured.measuredAt)) {
    return "measured_at_invalid";
  }
  return null;
}

export function locationBody(location: ReportLocation): LocationBody {
  if (location.kind === "description") {
    // Exactly as written.
    return { measured: null, reported: null, description: location.description, spoken_description: false };
  }
  if (location.kind === "spoken") {
    return { measured: null, reported: null, description: null, spoken_description: true };
  }
  const { measured, reported } = location;
  return {
    measured: {
      latitude: measured.latitude,
      longitude: measured.longitude,
      accuracy_m: measured.accuracyM,
      fix: measured.fix,
      measured_at: measured.measuredAt,
    },
    reported: { latitude: reported.latitude, longitude: reported.longitude },
    description: null,
    spoken_description: false,
  };
}

// --- Directional buttons (DG-30) -------------------------------------------------------------------------------

/** Metres per press of a directional button (approved by Hassan Jalal, 2026-10-11: 5 m, not 10). */
export const ADJUST_STEP_M = 5;

export type Direction = "north" | "south" | "east" | "west";

const METRES_PER_DEGREE = 111_320; // one degree of latitude, and of longitude at the equator
const round6 = (degrees: number) => Math.round(degrees * 1e6) / 1e6;

/** The position moved by `metres` towards `direction`, to six decimal places. */
export function moved(position: Position, direction: Direction, metres: number = ADJUST_STEP_M): Position {
  const north = direction === "north" ? metres : direction === "south" ? -metres : 0;
  const east = direction === "east" ? metres : direction === "west" ? -metres : 0;
  const latitude = Math.max(-90, Math.min(90, position.latitude + north / METRES_PER_DEGREE));
  const scale = Math.max(Math.cos((position.latitude * Math.PI) / 180), 0.01);
  let longitude = position.longitude + east / (METRES_PER_DEGREE * scale);
  if (longitude > 180) longitude -= 360;
  if (longitude < -180) longitude += 360;
  return { latitude: round6(latitude), longitude: round6(longitude) };
}

/** About how far, in metres, `to` lies from `from` (an equirectangular approximation: fine over a street). */
export function distanceMetres(from: Position, to: Position): number {
  const north = (to.latitude - from.latitude) * METRES_PER_DEGREE;
  const east =
    (to.longitude - from.longitude) *
    METRES_PER_DEGREE *
    Math.cos((((from.latitude + to.latitude) / 2) * Math.PI) / 180);
  return Math.sqrt(north * north + east * east);
}
