/**
 * CIT-08. The reporting order is fixed: CIT-07 → CIT-08 → CIT-09 (SRS §3.4).
 * CIT-07 starts the draft (T-048, still to be built), so this screen is reached
 * only from the development entry (dev-capture.tsx) for now; Continue opens CIT-09.
 */
import { Redirect, router, useLocalSearchParams } from "expo-router";

import { CitizenStoreStatus, EvidenceScreen } from "../../src/screens/EvidenceScreen";
import { useCitizenStore } from "../../src/storage/useCitizenStore";

export default function Cit08() {
  const { draft } = useLocalSearchParams<{ draft?: string }>();
  const store = useCitizenStore();
  if (!draft) return <Redirect href="/home" />;
  if (store.status !== "ready") return <CitizenStoreStatus state={store} />;
  return (
    <EvidenceScreen
      drafts={store.drafts}
      draftId={draft}
      onContinue={() => router.push({ pathname: "/describe", params: { draft } })}
    />
  );
}
