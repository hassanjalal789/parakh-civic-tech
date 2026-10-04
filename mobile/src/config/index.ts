import Constants from "expo-constants";

type Extra = { variant?: string; apiBaseUrl?: string };

const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

export const config = {
  variant: extra.variant ?? "development",
  apiBaseUrl: (extra.apiBaseUrl ?? "http://10.0.2.2:8000").replace(/\/+$/, ""),
  /** Must equal the backend's PARAKH_CONSENT_VERSION. Placeholder until the reviewed text exists (T-045). */
  consentVersion: "citizen-consent-draft-1",
  otpLength: 6,
} as const;

/** Plaintext HTTP is allowed only for development builds (T-033). */
export function assertTransportAllowed(baseUrl: string, variant: string): void {
  if (variant !== "development" && !baseUrl.startsWith("https://")) {
    throw new Error("Release builds must use HTTPS");
  }
}
