/**
 * CIT-08. The reporting order is fixed: CIT-07 → CIT-08 → CIT-09 (SRS §3.4).
 * CIT-07 starts the draft and CIT-09 follows; both are still to be built
 * (T-048, T-050), so until then Continue returns to Home with the draft kept,
 * and this screen is reached only from the development entry (dev-capture.tsx).
 */
import { Redirect, router, useLocalSearchParams } from "expo-router";

import { CitizenStoreStatus, EvidenceScreen } from "../../src/screens/EvidenceScreen";
import { useCitizenStore } from "../../src/storage/useCitizenStore";

export default function Cit08() {
  const { draft } = useLocalSearchParams<{ draft?: string }>();
  const store = useCitizenStore();
  if (!draft) return <Redirect href="/home" />;
  if (store.status !== "ready") return <CitizenStoreStatus state={store} />;
  return <EvidenceScreen drafts={store.drafts} draftId={draft} onContinue={() => router.replace("/home")} />;
}
