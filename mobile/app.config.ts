import type { ConfigContext, ExpoConfig } from "expo/config";

/**
 * Parakh mobile — Expo SDK 57 / React Native 0.86 (DR-19, DR-24, DR-25).
 *
 * APP_VARIANT: "development" (default) or "release". A release build must
 * talk to the backend over HTTPS; plaintext HTTP is allowed only in
 * development, for the local backend (T-033).
 */
const variant = process.env.APP_VARIANT ?? "development";
const apiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL ?? "http://10.0.2.2:8000";

if (variant === "release" && !apiBaseUrl.startsWith("https://")) {
  throw new Error("A release build requires an https:// EXPO_PUBLIC_API_BASE_URL");
}

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Parakh",
  slug: "parakh",
  scheme: "parakh",
  version: "0.1.0",
  orientation: "portrait",
  userInterfaceStyle: "light",
  ios: {
    bundleIdentifier: "io.github.hassanjalal789.parakh",
    deploymentTarget: "16.4", // DR-24
    supportsTablet: false,
  },
  android: {
    package: "io.github.hassanjalal789.parakh",
    // Android 7.0+ is React Native 0.86's default minSdk (24).
    // Evidence comes from the live camera only; the photo gallery is never offered (BR-002).
    blockedPermissions: [
      "android.permission.READ_MEDIA_IMAGES",
      "android.permission.READ_MEDIA_VIDEO",
      "android.permission.READ_MEDIA_VISUAL_USER_SELECTED",
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
    ],
    predictiveBackGestureEnabled: false,
  },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-localization",
    ["expo-sqlite", { useSQLCipher: true }], // DR-23; device verification outstanding (DEP-08)
  ],
  experiments: { typedRoutes: false },
  extra: { variant, apiBaseUrl },
});
