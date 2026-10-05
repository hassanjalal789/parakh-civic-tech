/** Citizen authentication calls. Body shapes: docs/api/CITIZEN_AUTH_IMPLEMENTATION_NOTES.md §2. */
import { runCitizenSessionTeardown } from "../auth/session";
import { clearCitizenTokens, saveCitizenTokens } from "../services/secureStorage";
import { request, type TokenResponse } from "./client";

export type ConsentSelections = {
  account_creation_and_processing: boolean;
  voice_processing: boolean;
  sms_notification: boolean;
};

export type PendingConsent = {
  ref: string;
  version: string;
  locale: "ur" | "en";
  selections: ConsentSelections;
};

export type OtpRequestResult = {
  expires_in_seconds: number;
  resend_after_seconds: number;
  code_length: number;
};

/** API-121. The consent snapshot travels with the request and is held by the server (DG-12). */
export function requestCitizenOtp(e164: string, consent: PendingConsent): Promise<OtpRequestResult> {
  return request<OtpRequestResult>("citizenOtpRequest", {
    body: {
      mobile_number: e164,
      pending_consent_ref: consent.ref,
      consent_version: consent.version,
      locale: consent.locale,
      consent_selections: consent.selections,
    },
  });
}

/**
 * API-122. On success the tokens go straight to secure storage and are not
 * returned to the screen. The code is never stored.
 */
export async function verifyCitizenOtp(e164: string, code: string): Promise<void> {
  const tokens = await request<TokenResponse>("citizenOtpVerify", { body: { mobile_number: e164, code } });
  await saveCitizenTokens({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token });
}

/** API-004. Server-side revocation first; local tokens are cleared even if the network fails. */
export async function logout(): Promise<void> {
  try {
    await request<void>("logout");
  } finally {
    await clearCitizenTokens();
    await runCitizenSessionTeardown();
  }
}

export type CitizenProfile = {
  /** The citizen's own account id; local drafts are bound to it (FR-COMMON.25). */
  account_id: string;
  masked_mobile_number: string | null;
  preferred_language: "ur" | "en";
  status: string;
  consents: Record<string, { version: string; granted: boolean }>;
};

/** API-155 (read). */
export function fetchCitizenProfile(): Promise<CitizenProfile> {
  return request<CitizenProfile>("citizenProfile");
}
