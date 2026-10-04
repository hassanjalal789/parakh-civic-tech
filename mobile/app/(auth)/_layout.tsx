/**
 * The secure authentication gateway (SRS §3.3.1): the only unauthenticated
 * group. It resolves the principal first; a signed-in citizen is sent to
 * (citizen), and nothing else renders before resolution.
 */
import { Redirect, Stack } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator } from "react-native";

import { usePrincipal } from "../../src/auth/principal";

export default function AuthGateway() {
  const { resolved, principal, resolve } = usePrincipal();
  useEffect(() => {
    if (!resolved) void resolve();
  }, [resolved, resolve]);

  if (!resolved) return <ActivityIndicator style={{ flex: 1 }} />;
  if (principal?.subjectType === "citizen") return <Redirect href="/home" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
