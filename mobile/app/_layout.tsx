/** Root: i18n bootstrap and the navigation stack. It mounts the gateway and nothing else (SRS §3.3). */
import "../src/i18n";

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
