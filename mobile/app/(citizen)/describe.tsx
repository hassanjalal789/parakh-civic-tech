/**
 * CIT-09. The reporting order is fixed: CIT-08 → CIT-09 → CIT-10 (SRS §3.4).
 * CIT-10 (T-051) is still to be built, so until then Continue returns to Home
 * with the draft kept.
 */
import { Redirect, router, useLocalSearchParams } from "expo-router";

import { DescribeScreen } from "../../src/screens/DescribeScreen";
import { CitizenStoreStatus } from "../../src/screens/EvidenceScreen";
import { useCitizenStore } from "../../src/storage/useCitizenStore";

export default function Cit09() {
  const { draft } = useLocalSearchParams<{ draft?: string }>();
  const store = useCitizenStore();
  if (!draft) return <Redirect href="/home" />;
  if (store.status !== "ready") return <CitizenStoreStatus state={store} />;
  return <DescribeScreen drafts={store.drafts} draftId={draft} onContinue={() => router.replace("/home")} />;
}
