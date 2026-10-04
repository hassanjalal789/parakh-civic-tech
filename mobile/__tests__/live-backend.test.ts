/// <reference types="node" />
/**
 * Opt-in contract check against a running development backend. Skipped
 * unless both variables are set:
 *   PARAKH_LIVE_API_BASE_URL — e.g. http://127.0.0.1:8765
 *   PARAKH_DEV_SMS_LOG       — the dev server's console log, where the
 *                              SIMULATED SMS line appears (development only)
 * Uses a synthetic number. Nothing is sent to any real phone. Under Jest,
 * Expo's global fetch is backed by a mocked native module and never reaches
 * the network, so this test supplies a minimal fetch over Node's http module.
 */
import { readFileSync } from "fs";
import http from "http";

import { fetchCitizenProfile, logout, requestCitizenOtp, verifyCitizenOtp } from "../src/api/auth";
import { ApiError } from "../src/api/errors";
import { usePrincipal } from "../src/auth/principal";
import { readAccessToken, readRefreshToken, saveCitizenTokens } from "../src/services/secureStorage";

const base = process.env.PARAKH_LIVE_API_BASE_URL;
const smsLog = process.env.PARAKH_DEV_SMS_LOG;

jest.mock("../src/config", () => ({
  config: {
    variant: "development",
    apiBaseUrl: process.env.PARAKH_LIVE_API_BASE_URL,
    consentVersion: "citizen-consent-draft-1",
    otpLength: 6,
  },
  assertTransportAllowed: () => undefined,
}));

const live = base && smsLog ? describe : describe.skip;

function nodeFetch(url: string, init: { method: string; headers: Record<string, string>; body?: string }) {
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const req = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: target.pathname,
        method: init.method,
        headers: init.body
          ? { ...init.headers, "Content-Length": String(Buffer.byteLength(init.body)) }
          : init.headers,
      },
      (res) => {
        let data = "";
        res.on("data", (chunk) => (data += chunk));
        res.on("end", () => {
          const status = res.statusCode ?? 0;
          resolve({
            ok: status >= 200 && status < 300,
            status,
            json: async () => (data ? JSON.parse(data) : null),
          });
        });
      },
    );
    req.on("error", reject);
    if (init.body) req.write(init.body);
    req.end();
  });
}

beforeAll(() => {
  global.fetch = nodeFetch as unknown as typeof fetch;
});

const CONSENT = {
  ref: "live-contract-check",
  version: "citizen-consent-draft-1",
  locale: "en" as const,
  selections: { account_creation_and_processing: true, voice_processing: true, sms_notification: true },
};

/** The latest SIMULATED code the development server printed for a synthetic number ending in `suffix`. */
function simulatedCode(suffix: string): string {
  const lines = readFileSync(smsLog as string, "utf8")
    .split("\n")
    .filter((l) => l.includes("SIMULATED SMS") && l.includes(`*** ${suffix}`));
  return lines[lines.length - 1]?.split(": ").pop()?.trim() ?? "";
}

live("mobile client against the live development backend", () => {
  test("API-121 → API-122 → API-155 → API-003 on 401 → API-004 with the client's own request shapes", async () => {
    const e164 = "+923009990001"; // synthetic
    const sent = await requestCitizenOtp(e164, CONSENT);
    expect(sent).toEqual({ expires_in_seconds: 300, resend_after_seconds: 60, code_length: 6 });

    const code = simulatedCode("0001");
    expect(code).toMatch(/^\d{6}$/);

    const wrong = await verifyCitizenOtp(e164, code === "000000" ? "111111" : "000000").catch(
      (e: unknown) => e,
    );
    expect(wrong).toBeInstanceOf(ApiError);
    expect((wrong as ApiError).action).toBe("show_uniform_otp_error");
    expect((wrong as ApiError).numberDetail("attempts_remaining")).toBe(4);

    await verifyCitizenOtp(e164, code);
    const profile = await fetchCitizenProfile();
    expect(profile.masked_mobile_number).toBe("+92 300 *** 0001");
    expect(profile.preferred_language).toBe("en");
    expect(profile.consents.sms_notification?.granted).toBe(true);

    // T-044: an unusable access token is renewed once with the refresh token and the request retried.
    const firstRefresh = (await readRefreshToken()) as string;
    await saveCitizenTokens({ accessToken: "not-a-valid-token", refreshToken: firstRefresh });
    await expect(fetchCitizenProfile()).resolves.toMatchObject({ masked_mobile_number: "+92 300 *** 0001" });
    expect(await readRefreshToken()).not.toBe(firstRefresh);

    await logout();
    await expect(fetchCitizenProfile()).rejects.toThrow(); // no session left on the device
  });

  test("replaying a consumed refresh token revokes the session and returns the device to sign-in", async () => {
    const e164 = "+923009990002"; // synthetic
    await requestCitizenOtp(e164, CONSENT);
    await verifyCitizenOtp(e164, simulatedCode("0002"));
    usePrincipal.getState().signedInAsCitizen();

    const consumed = (await readRefreshToken()) as string;
    await saveCitizenTokens({ accessToken: "not-a-valid-token", refreshToken: consumed });
    await fetchCitizenProfile(); // rotates: `consumed` is now spent
    const rotated = {
      accessToken: (await readAccessToken()) as string,
      refreshToken: (await readRefreshToken()) as string,
    };

    await saveCitizenTokens({ accessToken: "not-a-valid-token", refreshToken: consumed });
    const replay = await fetchCitizenProfile().catch((e: unknown) => e);
    expect((replay as ApiError).code).toBe("E_REFRESH_INVALID");
    expect(await readRefreshToken()).toBeNull();
    expect(usePrincipal.getState().principal).toBeNull();
    expect(usePrincipal.getState().notice).toBe("session_expired");

    // The whole family is revoked: the pair issued by the rotation no longer works either.
    await saveCitizenTokens(rotated);
    const after = await fetchCitizenProfile().catch((e: unknown) => e);
    expect((after as ApiError).status).toBe(401);
  });
});
