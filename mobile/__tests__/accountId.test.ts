/**
 * The signed-in citizen's own account id binds local drafts (FR-COMMON.25). It
 * is kept with the session tokens so capture works offline (UC-CIT-016), read
 * afresh at every sign-in, and goes when the session ends.
 */
import { ensureCitizenAccountId, logout, verifyCitizenOtp } from "../src/api/auth";
import { OfflineError } from "../src/api/errors";
import { clearCitizenTokens, readCitizenAccountId, saveCitizenTokens } from "../src/services/secureStorage";
import { E164, jsonResponse, mockFetch, secureStoreContents, TOKENS } from "./helpers";

const ACCOUNT = "8d0f4c2e-3b1a-4c55-9f00-0123456789ab"; // synthetic
const OTHER = "3a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d"; // synthetic
const KEY = "parakh.citizen.account_id";
const profile = (accountId: string) =>
  jsonResponse(200, {
    account_id: accountId,
    masked_mobile_number: "+92 300 *** 4567",
    preferred_language: "ur",
    status: "active",
    consents: {},
  });

beforeEach(() => secureStoreContents().clear());

test("a sign-in keeps the account id with the tokens, on this device only", async () => {
  const fetch = mockFetch(jsonResponse(200, TOKENS), profile(ACCOUNT));
  await verifyCitizenOtp(E164, "246810");
  expect(fetch).toHaveBeenCalledTimes(2);
  expect(secureStoreContents().get(KEY)).toBe(ACCOUNT);
  const store = jest.requireMock("expo-secure-store");
  expect(store.setItemAsync).toHaveBeenCalledWith(KEY, ACCOUNT, {
    keychainAccessible: "WHEN_UNLOCKED_THIS_DEVICE_ONLY",
  });
});

test("a new sign-in never keeps the previous account's id", async () => {
  secureStoreContents().set(KEY, OTHER);
  mockFetch(jsonResponse(200, TOKENS), profile(ACCOUNT));
  await verifyCitizenOtp(E164, "246810");
  expect(secureStoreContents().get(KEY)).toBe(ACCOUNT);
});

test("if the account cannot be read at sign-in, the sign-in still succeeds and the id is read on first need", async () => {
  mockFetch(jsonResponse(200, TOKENS), new TypeError("Network request failed"));
  await verifyCitizenOtp(E164, "246810");
  expect(secureStoreContents().get(KEY)).toBeUndefined();
  expect(secureStoreContents().get("parakh.citizen.access_token")).toBe(TOKENS.access_token);
  mockFetch(profile(ACCOUNT));
  await expect(ensureCitizenAccountId()).resolves.toBe(ACCOUNT);
  expect(await readCitizenAccountId()).toBe(ACCOUNT);
});

test("once known, the id is read from this phone with no network at all", async () => {
  await saveCitizenTokens({ accessToken: "a", refreshToken: "r" });
  secureStoreContents().set(KEY, ACCOUNT);
  const fetch = mockFetch(new TypeError("Network request failed"));
  await expect(ensureCitizenAccountId()).resolves.toBe(ACCOUNT);
  expect(fetch).not.toHaveBeenCalled();
});

test("unknown and offline: OfflineError, so the screen can say what to do", async () => {
  await saveCitizenTokens({ accessToken: "a", refreshToken: "r" });
  mockFetch(new TypeError("Network request failed"));
  await expect(ensureCitizenAccountId()).rejects.toBeInstanceOf(OfflineError);
});

test("an unexpected id is refused, and none is kept after a sign-out", async () => {
  await saveCitizenTokens({ accessToken: "a", refreshToken: "r" });
  mockFetch(profile("not-an-id"));
  await expect(ensureCitizenAccountId()).rejects.toThrow("unexpected account id");
  expect(secureStoreContents().get(KEY)).toBeUndefined();
  // Signed out while the profile was being read: the answer arrives after the session ended.
  mockFetch().mockImplementationOnce(async () => {
    await clearCitizenTokens();
    return profile(ACCOUNT);
  });
  await expect(ensureCitizenAccountId()).rejects.toThrow("Signed out");
  expect(secureStoreContents().get(KEY)).toBeUndefined();
});

test("sign-out removes the id with the tokens", async () => {
  await saveCitizenTokens({ accessToken: "a", refreshToken: "r" });
  secureStoreContents().set(KEY, ACCOUNT);
  mockFetch(jsonResponse(204, null));
  await logout();
  expect(secureStoreContents().get(KEY)).toBeUndefined();
  expect(secureStoreContents().get("parakh.citizen.refresh_token")).toBeUndefined();
});
