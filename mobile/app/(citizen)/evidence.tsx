/**
 * CIT-08. The reporting order is fixed: CIT-07 → CIT-08 → CIT-09 (SRS §3.4).
 * CIT-07 starts the draft; Continue opens CIT-09. Opened from CIT-11 to change the
 * photos or video, it returns there.
 */
import { Redirect, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";

import { CitizenStoreStatus, EvidenceScreen } from "../../src/screens/EvidenceScreen";
import { useCitizenStore } from "../../src/storage/useCitizenStore";

export default function Cit08() {
  const { draft, from } = useLocalSearchParams<{ draft?: string; from?: string }>();
  const store = useCitizenStore();
  // The camera runs only while this screen is the one in front (the stack keeps covered screens mounted).
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  if (!draft) return <Redirect href="/home" />;
  if (store.status !== "ready") return <CitizenStoreStatus state={store} />;
  return (
    <EvidenceScreen
      drafts={store.drafts}
      draftId={draft}
      active={focused}
      onContinue={() =>
        from === "review" ? router.back() : router.push({ pathname: "/describe", params: { draft } })
      }
    />
  );
}
