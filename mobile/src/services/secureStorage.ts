import * as SecureStore from "expo-secure-store";

/**
 * LDS-1: small secrets only — session tokens. Never media, never an OTP,
 * never the phone number. Nothing here is mirrored to AsyncStorage or logs.
 */
const KEYS = {
  access: "parakh.citizen.access_token",
  refresh: "parakh.citizen.refresh_token",
} as const;

export type TokenPair = { accessToken: string; refreshToken: string };

export async function saveCitizenTokens(tokens: TokenPair): Promise<void> {
  await SecureStore.setItemAsync(KEYS.access, tokens.accessToken);
  await SecureStore.setItemAsync(KEYS.refresh, tokens.refreshToken);
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
