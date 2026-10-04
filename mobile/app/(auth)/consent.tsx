import { router } from "expo-router";

import { ConsentScreen } from "../../src/screens/ConsentScreen";

export default function Cit03() {
  return <ConsentScreen onContinue={() => router.push("/phone")} onBack={() => router.back()} />;
}
