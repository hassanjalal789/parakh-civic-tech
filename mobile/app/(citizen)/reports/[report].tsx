/** CIT-15. API-151 is requested only within the citizen-authenticated route group. */
import { router, useLocalSearchParams } from "expo-router";
import { useTranslation } from "react-i18next";

import { ReportDetailScreen } from "../../../src/screens/ReportDetailScreen";

export default function Cit15() {
  const { report } = useLocalSearchParams<{ report: string }>();
  const { i18n } = useTranslation();
  return (
    <ReportDetailScreen
      reportId={report}
      language={i18n.language}
      onBack={() => router.replace("/my-reports")}
    />
  );
}
