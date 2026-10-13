import { router } from "expo-router";

import { HomeScreen } from "../../src/screens/HomeScreen";

export default function Cit06() {
  return (
    <HomeScreen onReport={() => router.push("/category")} onMyReports={() => router.push("/my-reports")} />
  );
}
