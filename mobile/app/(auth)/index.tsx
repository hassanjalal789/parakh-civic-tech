import { router } from "expo-router";

import { LanguageScreen } from "../../src/screens/LanguageScreen";

export default function Cit01() {
  return <LanguageScreen onChosen={() => router.push("/privacy")} />;
}
