/**
 * CIT-09. The reporting order is fixed: CIT-08 → CIT-09 → CIT-10 (SRS §3.4);
 * Continue opens CIT-10. Opened from CIT-11 to change the description, it returns there.
 */
import { Redirect, router, useLocalSearchParams } from "expo-router";

import { DescribeScreen } from "../../src/screens/DescribeScreen";
import { CitizenStoreStatus } from "../../src/screens/EvidenceScreen";
import { useCitizenStore } from "../../src/storage/useCitizenStore";

export default function Cit09() {
  const { draft, from } = useLocalSearchParams<{ draft?: string; from?: string }>();
  const store = useCitizenStore();
  if (!draft) return <Redirect href="/home" />;
  if (store.status !== "ready") return <CitizenStoreStatus state={store} />;
  return (
    <DescribeScreen
      drafts={store.drafts}
      draftId={draft}
      onContinue={() =>
        from === "review" ? router.back() : router.push({ pathname: "/location", params: { draft } })
      }
    />
  );
}
