/** Test helpers. All numbers are synthetic; no real citizen data is used. */
import * as SecureStore from "expo-secure-store";

export const NUMBER = "300 1234567"; // synthetic
export const E164 = "+923001234567";

type FakeResponse = { ok: boolean; status: number; json: () => Promise<unknown> };

export function jsonResponse(status: number, body: unknown): FakeResponse {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

export function mockFetch(...responses: (FakeResponse | Error)[]): jest.Mock {
  const fn = jest.fn();
  for (const r of responses) {
    if (r instanceof Error) fn.mockRejectedValueOnce(r);
    else fn.mockResolvedValueOnce(r);
  }
  global.fetch = fn as unknown as typeof fetch;
  return fn;
}

export function lastRequest(fn: jest.Mock): {
  url: string;
  init: RequestInit & { headers: Record<string, string> };
} {
  const call = fn.mock.calls[fn.mock.calls.length - 1];
  return { url: call[0], init: call[1] };
}

export function secureStoreContents(): Map<string, string> {
  return (SecureStore as unknown as { __store: Map<string, string> }).__store;
}

export const OTP_SENT = { expires_in_seconds: 300, resend_after_seconds: 60, code_length: 6 };

export const TOKENS = {
  access_token: "synthetic-access",
  access_expires_at: "2026-10-04T09:15:00+00:00",
  refresh_token: "synthetic-refresh",
  token_type: "Bearer",
  subject_type: "citizen",
};
