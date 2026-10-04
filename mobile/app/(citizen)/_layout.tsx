/** Guard: a citizen principal only. Anything else goes back to the gateway. No acting-role header exists here. */
import { Redirect, Stack } from "expo-router";

import { usePrincipal } from "../../src/auth/principal";

export default function CitizenLayout() {
  const principal = usePrincipal((s) => s.principal);
  if (principal?.subjectType !== "citizen") return <Redirect href="/" />;
  return <Stack screenOptions={{ headerShown: false }} />;
}
