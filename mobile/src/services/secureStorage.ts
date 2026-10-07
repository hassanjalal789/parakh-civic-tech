import * as SecureStore from "expo-secure-store";

/**
 * LDS-1: small secrets only — session tokens. Never media, never an OTP,
 * never the phone number. Nothing here is mirrored to AsyncStorage or logs.
 *
 * On iOS the tokens never leave this phone: a backup restored to another
 * device does not carry them, so the citizen signs in again there (DG-59).
 * Android keeps them out of backups through the app's backup rules.
 */
const KEYS = {
  access: "parakh.citizen.access_token",
  refresh: "parakh.citizen.refresh_token",
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

export async function clearCitizenTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(KEYS.access);
  await SecureStore.deleteItemAsync(KEYS.refresh);
}
