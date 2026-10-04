import { router } from "expo-router";

import { PhoneScreen } from "../../src/screens/PhoneScreen";

export default function Cit04() {
  return (
    <PhoneScreen
      onCodeSent={() => router.push("/otp")}
      onReviewConsent={() => router.navigate("/consent")}
      onBack={() => router.back()}
    />
  );
}
