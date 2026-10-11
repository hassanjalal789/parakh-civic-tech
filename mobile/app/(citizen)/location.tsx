/**
 * CIT-10. The reporting order is fixed: CIT-08 → CIT-09 → CIT-10 → CIT-11 (SRS §3.4);
 * Continue opens CIT-11. Opened from CIT-11 to change the location, it returns there.
 */
import { Redirect, router, useLocalSearchParams } from "expo-router";

import { CitizenStoreStatus } from "../../src/screens/EvidenceScreen";
import { LocationScreen } from "../../src/screens/LocationScreen";
import { useCitizenStore } from "../../src/storage/useCitizenStore";

export default function Cit10() {
  const { draft, from } = useLocalSearchParams<{ draft?: string; from?: string }>();
  const store = useCitizenStore();
  if (!draft) return <Redirect href="/home" />;
  if (store.status !== "ready") return <CitizenStoreStatus state={store} />;
  return (
    <LocationScreen
      drafts={store.drafts}
      draftId={draft}
      onContinue={() =>
        from === "review" ? router.back() : router.push({ pathname: "/review", params: { draft } })
      }
    />
  );
}
