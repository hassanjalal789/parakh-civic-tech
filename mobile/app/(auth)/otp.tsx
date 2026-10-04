import { router } from "expo-router";

import { OtpScreen } from "../../src/screens/OtpScreen";

export default function Cit05() {
  return (
    <OtpScreen
      onSignedIn={() => router.replace("/home")}
      onEditNumber={() => router.navigate("/phone")}
      onReviewConsent={() => router.navigate("/consent")}
    />
  );
}
