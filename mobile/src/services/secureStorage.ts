import * as SecureStore from "expo-secure-store";

/**
 * LDS-1: small secrets only — the session tokens, and the signed-in citizen's
 * own account id, which binds local drafts to the account (FR-COMMON.25) and is
 * kept here so capture works offline. Never media, never an OTP, never the
 * phone number. Nothing here is mirrored to AsyncStorage or logs.
 *
 * On iOS the tokens never leave this phone: a backup restored to another
 * device does not carry them, so the citizen signs in again there (DG-59).
 * Android keeps them out of backups through the app's backup rules.
 */
const KEYS = {
  access: "parakh.citizen.access_token",
  refresh: "parakh.citizen.refresh_token",
  account: "parakh.citizen.account_id",
} as const;

const THIS_DEVICE_ONLY = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export type TokenPair = { accessToken: string; refreshToken: string };

export async function saveCitizenTokens(tokens: TokenPair): Promise<void> {
  await SecureStore.setItemAsync(KEYS.access, tokens.accessToken, THIS_DEVICE_ONLY);
  await SecureStore.setItemAsync(KEYS.refresh, tokens.refreshToken, THIS_DEVICE_ONLY);
}

export async function readAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.access);
}

export async function readRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.refresh);
}

/** Ends the session on this phone: the tokens and the account id go together. */
export async function clearCitizenTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.access);
  await SecureStore.deleteItemAsync(KEYS.refresh);
  await SecureStore.deleteItemAsync(KEYS.account);
}

export async function saveCitizenAccountId(accountId: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.account, accountId, THIS_DEVICE_ONLY);
}

export async function readCitizenAccountId(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.account);
}

export async function forgetCitizenAccountId(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.account);
}
