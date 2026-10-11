/**
 * CIT-08. The reporting order is fixed: CIT-07 → CIT-08 → CIT-09 (SRS §3.4).
 * CIT-07 starts the draft; Continue opens CIT-09. Opened from CIT-11 to change the
 * photos or video, it returns there.
 */
import { Redirect, router, useLocalSearchParams } from "expo-router";

import { CitizenStoreStatus, EvidenceScreen } from "../../src/screens/EvidenceScreen";
import { useCitizenStore } from "../../src/storage/useCitizenStore";

export default function Cit08() {
  const { draft, from } = useLocalSearchParams<{ draft?: string; from?: string }>();
  const store = useCitizenStore();
  if (!draft) return <Redirect href="/home" />;
  if (store.status !== "ready") return <CitizenStoreStatus state={store} />;
  return (
    <EvidenceScreen
      drafts={store.drafts}
      draftId={draft}
      onContinue={() =>
        from === "review" ? router.back() : router.push({ pathname: "/describe", params: { draft } })
      }
    />
  );
}
