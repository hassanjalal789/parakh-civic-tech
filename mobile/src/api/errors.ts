/**
 * Error catalogue: every server error code maps to exactly one client action.
 *
 * The nine codes of API Contract §11 are the specified ones. The
 * authentication codes are PROPOSED (DG-52) — they are what the development
 * backend returns today (docs/api/CITIZEN_AUTH_IMPLEMENTATION_NOTES.md §3).
 */
export type ClientAction =
  | "fix_number"
  | "fix_input"
  | "show_uniform_otp_error"
  | "wait_and_retry"
  | "review_consent"
  | "sign_in_again"
  | "contact_support"
  | "refetch_rendering"
  | "confirm_rendering"
  | "add_evidence"
  | "refresh_and_retry"
  | "recapture_evidence"
  | "show_conflict_excluded"
  | "step_up"
  | "not_found"
  | "show_offline"
  | "generic_error";

export const ERROR_ACTIONS: Readonly<Record<string, ClientAction>> = {
  // API Contract §11
  E_RENDERING_SUPERSEDED: "refetch_rendering",
  E_RENDERING_HASH_MISMATCH: "refetch_rendering",
  E_RENDERING_NOT_CONFIRMED: "confirm_rendering",
  E_EVIDENCE_REQUIRED: "add_evidence",
  E_STALE_STATE: "refresh_and_retry",
  E_CAPTURE_INTEGRITY: "recapture_evidence",
  E_ROLE_ASSIGNMENT_INVALID: "sign_in_again",
  E_CONFLICT_EXCLUDED: "show_conflict_excluded",
  E_STEP_UP_REQUIRED: "step_up",
  // Authentication — PROPOSED (DG-52)
  E_INVALID_NUMBER: "fix_number",
  E_VALIDATION: "fix_input",
  E_OTP_INVALID: "show_uniform_otp_error",
  E_OTP_COOLDOWN: "wait_and_retry",
  E_RATE_LIMITED: "wait_and_retry",
  E_CONSENT_REQUIRED: "review_consent",
  E_CONSENT_VERSION: "review_consent",
  E_UNAUTHENTICATED: "sign_in_again",
  E_REFRESH_INVALID: "sign_in_again",
  E_ACCOUNT_UNAVAILABLE: "contact_support",
  E_NOT_FOUND: "not_found",
};

export class ApiError extends Error {
  readonly action: ClientAction;

  constructor(
    readonly code: string,
    readonly status: number,
    readonly details: Readonly<Record<string, unknown>> = {},
  ) {
    super(code);
    this.name = "ApiError";
    this.action = ERROR_ACTIONS[code] ?? "generic_error";
  }

  /** A numeric detail such as attempts_remaining or retry_after_seconds, if present. */
  numberDetail(key: string): number | undefined {
    const value = this.details[key];
    return typeof value === "number" ? value : undefined;
  }
}

/** No network: OTP and AI never work offline, and nothing is queued (Screen Inventory §1). */
export class OfflineError extends Error {
  readonly action: ClientAction = "show_offline";

  constructor() {
    super("offline");
    this.name = "OfflineError";
  }
}

/** A request that matches no transport profile is never sent (SRS §3.2.2 rule 4). */
export class UnmatchedRequestError extends Error {
  constructor(reason: string) {
    super(`Request not sent: ${reason}`);
    this.name = "UnmatchedRequestError";
  }
}
