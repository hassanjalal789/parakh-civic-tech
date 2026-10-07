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
      // Location is read only while the citizen places the issue (FR-PUB.24), never in the background.
      "android.permission.ACCESS_BACKGROUND_LOCATION",
      // The template's "display over other apps"; Parakh never draws over other apps.
      // (React Native's debug-only manifest still adds it to debug builds for the developer overlay.)
      "android.permission.SYSTEM_ALERT_WINDOW",
      // Added by androidx.biometric through expo-secure-store. Device biometric unlock is
      // not implemented (SRS §3.3, SRC-CR61 §3.3) and no stored item requires authentication.
      "android.permission.USE_BIOMETRIC",
      "android.permission.USE_FINGERPRINT",
    ],
    predictiveBackGestureEnabled: false,
    // No backup or transfer of any Parakh data (DG-59): see plugins/withNoDeviceBackup.js.
    allowBackup: false,
  },
  plugins: [
    "expo-router",
    // Its own backup rules only keep its preferences out; Parakh's rules exclude everything.
    ["expo-secure-store", { configureAndroidBackup: false }],
    "expo-localization",
    // SQLCipher only to move the 5 October encrypted drafts once (T-128); drafts are plain SQLite (DG-63).
    ["expo-sqlite", { useSQLCipher: true }],
    [
      "expo-camera", // live photos and the optional 60-second video (FR-PUB.4, DG-54)
      {
        cameraPermission:
          "Parakh uses the camera to take live photos and a short video of the issue you report.",
        microphonePermission: "Parakh records sound with a short video of the issue you report.",
        recordAudioAndroid: true,
      },
    ],
    [
      "expo-audio", // the spoken description (FR-PUB.9)
      {
        microphonePermission: "Parakh records your voice when you describe an issue.",
        enableBackgroundPlayback: false, // no background audio: no foreground-service permissions
        enableBackgroundRecording: false,
      },
    ],
    [
      "expo-location", // the issue's position with its accuracy (FR-PUB.24)
      {
        locationWhenInUsePermission:
          "Parakh records where the issue is, so the report reaches the right office.",
        isAndroidBackgroundLocationEnabled: false,
        isIosBackgroundLocationEnabled: false,
      },
    ],
    ["expo-video", { supportsBackgroundPlayback: false, supportsPictureInPicture: false }],
    "./plugins/withUniformNdk", // one NDK for every native module; no silent SDK downloads
    "./plugins/withNoDeviceBackup", // no backup or transfer of Parakh data (DG-59)
  ],
  experiments: { typedRoutes: false },
  extra: { variant, apiBaseUrl },
});
