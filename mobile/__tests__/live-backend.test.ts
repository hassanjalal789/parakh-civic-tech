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

live("mobile client against the live development backend", () => {
  test("API-121 → API-122 → API-155 → API-004 with the client's own request shapes", async () => {
    const e164 = "+923009990001"; // synthetic
    const consent = {
      ref: "live-contract-check",
      version: "citizen-consent-draft-1",
      locale: "en" as const,
      selections: { account_creation_and_processing: true, voice_processing: true, sms_notification: true },
    };
    const sent = await requestCitizenOtp(e164, consent);
    expect(sent).toEqual({ expires_in_seconds: 300, resend_after_seconds: 60, code_length: 6 });

    const lines = readFileSync(smsLog as string, "utf8")
      .split("\n")
      .filter((l) => l.includes("SIMULATED SMS") && l.includes("*** 0001"));
    const code = lines[lines.length - 1]?.split(": ").pop()?.trim() ?? "";
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

    await logout();
    await expect(fetchCitizenProfile()).rejects.toThrow(); // no session left on the device
  });
});
