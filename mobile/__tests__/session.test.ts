/** T-044: refresh on 401, rotation, and expiry back to sign-in (FR-AUTH.10, FR-AUTH.13). */
import { fetchCitizenProfile } from "../src/api/auth";
import { ApiError, OfflineError } from "../src/api/errors";
import { usePrincipal } from "../src/auth/principal";
import { readAccessToken, readRefreshToken, saveCitizenTokens } from "../src/services/secureStorage";
import { jsonResponse, secureStoreContents } from "./helpers";

const PROFILE = {
  account_id: "8d0f4c2e-3b1a-4c55-9f00-0123456789ab",
  masked_mobile_number: "+92 300 *** 4567",
  preferred_language: "ur",
  status: "active",
  consents: {},
};
const UNAUTHENTICATED = { error: { code: "E_UNAUTHENTICATED", message: "Please sign in again." } };
const REFRESH_INVALID = { error: { code: "E_REFRESH_INVALID", message: "Please sign in again." } };

type Init = { method: string; headers: Record<string, string> };

/**
 * A fake backend: the access token "valid-<n>" is accepted, anything else
 * gets 401. Each refresh call rotates to the next pair unless told to fail.
 */
function fakeBackend(
  options: { refresh?: "rotate" | "invalid" | "offline"; acceptAfterRefresh?: boolean } = {},
) {
  const calls: { path: string; auth: string }[] = [];
  let generation = 0;
  const fn = jest.fn(async (url: string, init: Init) => {
    const path = url.replace(/^https?:\/\/[^/]+/, "");
    const auth = init.headers.Authorization ?? "";
    calls.push({ path, auth });
    if (path === "/auth/refresh") {
      if (options.refresh === "offline") throw new TypeError("Network request failed");
      if (options.refresh === "invalid") return jsonResponse(401, REFRESH_INVALID);
      generation += 1;
      return jsonResponse(200, {
        access_token: `valid-${generation}`,
        access_expires_at: "2026-10-04T10:00:00+00:00",
        refresh_token: `refresh-${generation}`,
        token_type: "Bearer",
        subject_type: "citizen",
      });
    }
    const accepted = options.acceptAfterRefresh !== false && auth === `Bearer valid-${generation}`;
    return accepted ? jsonResponse(200, PROFILE) : jsonResponse(401, UNAUTHENTICATED);
  });
  global.fetch = fn as unknown as typeof fetch;
  return { calls, refreshCalls: () => calls.filter((c) => c.path === "/auth/refresh") };
}

beforeEach(async () => {
  secureStoreContents().clear();
  usePrincipal.getState().signedInAsCitizen();
  await saveCitizenTokens({ accessToken: "expired-access", refreshToken: "refresh-0" });
});

test("a 401 refreshes once with the refresh token, rotates both tokens and retries the request once", async () => {
  const backend = fakeBackend();
  await expect(fetchCitizenProfile()).resolves.toEqual(PROFILE);

  expect(backend.calls.map((c) => c.path)).toEqual(["/citizen/profile", "/auth/refresh", "/citizen/profile"]);
  expect(backend.refreshCalls()[0]?.auth).toBe("Bearer refresh-0");
  expect(backend.calls[2]?.auth).toBe("Bearer valid-1");
  expect(await readAccessToken()).toBe("valid-1");
  expect(await readRefreshToken()).toBe("refresh-1");
  expect(usePrincipal.getState().principal).toEqual({ subjectType: "citizen" });
});

test("concurrent 401s share one refresh call, so the rotated token is never replayed", async () => {
  const backend = fakeBackend();
  const results = await Promise.all([fetchCitizenProfile(), fetchCitizenProfile(), fetchCitizenProfile()]);
  expect(results).toEqual([PROFILE, PROFILE, PROFILE]);
  expect(backend.refreshCalls()).toHaveLength(1);
});

test("a 401 for a token another call has already replaced is retried without a second refresh", async () => {
  const backend = fakeBackend();
  const realFetch = global.fetch;
  // While the first request is on the wire, another call finishes a refresh and stores "valid-0".
  global.fetch = jest.fn(async (url: string, init: Init) => {
    if (init.headers.Authorization === "Bearer expired-access") {
      await saveCitizenTokens({ accessToken: "valid-0", refreshToken: "refresh-0b" });
    }
    return (realFetch as unknown as (u: string, i: Init) => Promise<unknown>)(url, init);
  }) as unknown as typeof fetch;

  await expect(fetchCitizenProfile()).resolves.toEqual(PROFILE);
  expect(backend.refreshCalls()).toHaveLength(0);
  expect(backend.calls.map((c) => c.auth)).toEqual(["Bearer expired-access", "Bearer valid-0"]);
});

test("E_REFRESH_INVALID clears the tokens and returns to sign-in with an explanation; nothing else is wiped", async () => {
  secureStoreContents().set("parakh.unrelated", "kept");
  const backend = fakeBackend({ refresh: "invalid" });

  const error = await fetchCitizenProfile().catch((e: unknown) => e);
  expect(error).toBeInstanceOf(ApiError);
  expect((error as ApiError).code).toBe("E_REFRESH_INVALID");
  expect((error as ApiError).action).toBe("sign_in_again");

  expect(backend.calls.map((c) => c.path)).toEqual(["/citizen/profile", "/auth/refresh"]); // no retry
  expect(await readAccessToken()).toBeNull();
  expect(await readRefreshToken()).toBeNull();
  expect(secureStoreContents().get("parakh.unrelated")).toBe("kept");
  expect(usePrincipal.getState().principal).toBeNull();
  expect(usePrincipal.getState().notice).toBe("session_expired");
});

test("a second 401 after a successful refresh ends the session without another refresh", async () => {
  const backend = fakeBackend({ acceptAfterRefresh: false });
  const error = await fetchCitizenProfile().catch((e: unknown) => e);
  expect((error as ApiError).code).toBe("E_UNAUTHENTICATED");
  expect(backend.refreshCalls()).toHaveLength(1);
  expect(backend.calls).toHaveLength(3);
  expect(await readRefreshToken()).toBeNull();
  expect(usePrincipal.getState().notice).toBe("session_expired");
});

test("no network during refresh keeps the session and reports offline", async () => {
  fakeBackend({ refresh: "offline" });
  await expect(fetchCitizenProfile()).rejects.toBeInstanceOf(OfflineError);
  expect(await readRefreshToken()).toBe("refresh-0");
  expect(usePrincipal.getState().principal).toEqual({ subjectType: "citizen" });
  expect(usePrincipal.getState().notice).toBeNull();
});

test("a later sign-in clears the expiry notice", async () => {
  fakeBackend({ refresh: "invalid" });
  await fetchCitizenProfile().catch(() => undefined);
  expect(usePrincipal.getState().notice).toBe("session_expired");
  usePrincipal.getState().signedInAsCitizen();
  expect(usePrincipal.getState().notice).toBeNull();
});
