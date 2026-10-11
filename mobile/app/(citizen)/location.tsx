/**
 * CIT-10. The reporting order is fixed: CIT-08 → CIT-09 → CIT-10 → CIT-11 (SRS §3.4).
 * CIT-11 (review and submit, T-062) is still to be built, so until then Continue
 * returns to Home with the draft kept.
 */
import { Redirect, router, useLocalSearchParams } from "expo-router";

import { CitizenStoreStatus } from "../../src/screens/EvidenceScreen";
import { LocationScreen } from "../../src/screens/LocationScreen";
import { useCitizenStore } from "../../src/storage/useCitizenStore";

export default function Cit10() {
  const { draft } = useLocalSearchParams<{ draft?: string }>();
  const store = useCitizenStore();
  if (!draft) return <Redirect href="/home" />;
  if (store.status !== "ready") return <CitizenStoreStatus state={store} />;
  return <LocationScreen drafts={store.drafts} draftId={draft} onContinue={() => router.replace("/home")} />;
}
