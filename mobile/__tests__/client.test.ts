import { logout, requestCitizenOtp, verifyCitizenOtp } from "../src/api/auth";
import { request, ROUTES } from "../src/api/client";
import { ApiError, ERROR_ACTIONS, OfflineError, UnmatchedRequestError } from "../src/api/errors";
import { assertTransportAllowed, config } from "../src/config";
import { saveCitizenTokens } from "../src/services/secureStorage";
import { E164, jsonResponse, lastRequest, mockFetch, OTP_SENT, secureStoreContents, TOKENS } from "./helpers";

const CONSENT = {
  ref: "3f1c9a52-0b7e-4d0a-9d1e-5b2f6c7a8e90",
  version: "citizen-consent-draft-1",
  locale: "ur" as const,
  selections: { account_creation_and_processing: true, voice_processing: true, sms_notification: false },
};

beforeEach(() => secureStoreContents().clear());

describe("transport profiles (SRS §3.2.2)", () => {
  test("a public-auth request carries no credential", async () => {
    await saveCitizenTokens({ accessToken: "a", refreshToken: "r" });
    const fetch = mockFetch(jsonResponse(202, OTP_SENT));
    await requestCitizenOtp(E164, CONSENT);
    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${config.apiBaseUrl}/auth/citizen/otp/request`);
    expect(Object.keys(init.headers).map((h) => h.toLowerCase())).not.toContain("authorization");
  });

  test.each(["X-Acting-Role-Assignment-ID", "x-acting-role-assignment-id"])(
    "a citizen request refuses %s and is not sent",
    async (header) => {
      await saveCitizenTokens({ accessToken: "a", refreshToken: "r" });
      const fetch = mockFetch(jsonResponse(200, {}));
      await expect(request("citizenProfile", { headers: { [header]: "some-uuid" } })).rejects.toBeInstanceOf(
        UnmatchedRequestError,
      );
      await expect(
        request("citizenOtpRequest", { headers: { [header]: "some-uuid" } }),
      ).rejects.toBeInstanceOf(UnmatchedRequestError);
      expect(fetch).not.toHaveBeenCalled();
    },
  );

  test("a citizen request without a session is not sent", async () => {
    const fetch = mockFetch(jsonResponse(200, {}));
    await expect(request("citizenProfile")).rejects.toBeInstanceOf(UnmatchedRequestError);
    expect(fetch).not.toHaveBeenCalled();
  });

  test("the bearer token is read from secure storage at request time, not cached", async () => {
    const fetch = mockFetch(jsonResponse(200, {}), jsonResponse(200, {}));
    await saveCitizenTokens({ accessToken: "first", refreshToken: "r" });
    await request("citizenProfile");
    expect(lastRequest(fetch).init.headers.Authorization).toBe("Bearer first");
    await saveCitizenTokens({ accessToken: "second", refreshToken: "r" });
    await request("citizenProfile");
    expect(lastRequest(fetch).init.headers.Authorization).toBe("Bearer second");
  });

  test("the refresh-only route sends the refresh token, never the access token", async () => {
    await saveCitizenTokens({ accessToken: "access", refreshToken: "refresh" });
    const fetch = mockFetch(jsonResponse(200, TOKENS));
    await request("refresh");
    expect(lastRequest(fetch).init.headers.Authorization).toBe("Bearer refresh");
  });

  test("every route declares one transport class", () => {
    for (const route of Object.values(ROUTES)) {
      expect(["public-auth", "refresh-only", "citizen"]).toContain(route.transport);
    }
  });
});

describe("errors and offline behaviour", () => {
  test("no network gives OfflineError and is attempted exactly once (no queueing)", async () => {
    const fetch = mockFetch(new TypeError("Network request failed"));
    await expect(requestCitizenOtp(E164, CONSENT)).rejects.toBeInstanceOf(OfflineError);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  test("the error envelope becomes an ApiError with its client action and details", async () => {
    mockFetch(
      jsonResponse(400, {
        error: { code: "E_OTP_INVALID", message: "The code is wrong or has expired.", attempts_remaining: 3 },
      }),
    );
    const error = await verifyCitizenOtp(E164, "123456").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).action).toBe("show_uniform_otp_error");
    expect((error as ApiError).numberDetail("attempts_remaining")).toBe(3);
    expect(secureStoreContents().size).toBe(0);
  });

  test("every error code of API Contract §11 maps to a client action", () => {
    const contract = [
      "E_RENDERING_SUPERSEDED",
      "E_RENDERING_HASH_MISMATCH",
      "E_RENDERING_NOT_CONFIRMED",
      "E_EVIDENCE_REQUIRED",
      "E_STALE_STATE",
      "E_CAPTURE_INTEGRITY",
      "E_ROLE_ASSIGNMENT_INVALID",
      "E_CONFLICT_EXCLUDED",
      "E_STEP_UP_REQUIRED",
    ];
    for (const code of contract) expect(ERROR_ACTIONS[code]).toBeDefined();
    expect(new ApiError("E_SOMETHING_NEW", 400).action).toBe("generic_error");
  });

  test("release builds refuse plaintext HTTP", () => {
    expect(() => assertTransportAllowed("http://api.example.org", "release")).toThrow("HTTPS");
    expect(() => assertTransportAllowed("https://api.example.org", "release")).not.toThrow();
    expect(() => assertTransportAllowed("http://10.0.2.2:8000", "development")).not.toThrow();
  });
});

describe("citizen auth calls (docs/api/CITIZEN_AUTH_IMPLEMENTATION_NOTES.md §2)", () => {
  test("API-121 sends the number and the consent snapshot in the agreed shape", async () => {
    const fetch = mockFetch(jsonResponse(202, OTP_SENT));
    await requestCitizenOtp(E164, CONSENT);
    const { init } = lastRequest(fetch);
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({
      mobile_number: "+923001234567",
      pending_consent_ref: CONSENT.ref,
      consent_version: "citizen-consent-draft-1",
      locale: "ur",
      consent_selections: {
        account_creation_and_processing: true,
        voice_processing: true,
        sms_notification: false,
      },
    });
  });

  test("API-122 stores the tokens in secure storage only and returns nothing", async () => {
    const fetch = mockFetch(jsonResponse(200, TOKENS));
    await expect(verifyCitizenOtp(E164, "246810")).resolves.toBeUndefined();
    expect(JSON.parse(String(lastRequest(fetch).init.body))).toEqual({ mobile_number: E164, code: "246810" });
    expect([...secureStoreContents().values()].sort()).toEqual(["synthetic-access", "synthetic-refresh"]);
    expect([...secureStoreContents().values()]).not.toContain("246810");
  });

  test("API-004 revokes on the server and clears local tokens even when offline", async () => {
    await saveCitizenTokens({ accessToken: "access", refreshToken: "refresh" });
    const fetch = mockFetch(jsonResponse(204, null));
    await logout();
    expect(lastRequest(fetch).init.headers.Authorization).toBe("Bearer access");
    expect(secureStoreContents().size).toBe(0);

    await saveCitizenTokens({ accessToken: "access", refreshToken: "refresh" });
    mockFetch(new TypeError("Network request failed"));
    await expect(logout()).rejects.toBeInstanceOf(OfflineError);
    expect(secureStoreContents().size).toBe(0);
  });
});
