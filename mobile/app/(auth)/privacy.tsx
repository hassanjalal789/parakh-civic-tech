import { router } from "expo-router";

import { PrivacyScreen } from "../../src/screens/PrivacyScreen";

export default function Cit02() {
  return <PrivacyScreen onContinue={() => router.push("/consent")} onBack={() => router.back()} />;
}
