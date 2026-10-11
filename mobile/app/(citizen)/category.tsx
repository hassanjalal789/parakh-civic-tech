/**
 * CIT-07. The reporting order is fixed: CIT-06 → CIT-07 → CIT-08 → CIT-09 → CIT-10 (SRS §3.4).
 * Choosing a category starts the draft and opens CIT-08. Opened from CIT-11 with the
 * draft, choosing changes its category and returns there.
 */
import { router, useLocalSearchParams } from "expo-router";

import { CategoryScreen } from "../../src/screens/CategoryScreen";
import { CitizenStoreStatus } from "../../src/screens/EvidenceScreen";
import { useCitizenStore } from "../../src/storage/useCitizenStore";

export default function Cit07() {
  const { draft: existing, from } = useLocalSearchParams<{ draft?: string; from?: string }>();
  const store = useCitizenStore();
  if (store.status !== "ready") return <CitizenStoreStatus state={store} />;
  return (
    <CategoryScreen
      drafts={store.drafts}
      draftId={existing}
      onChosen={(draft) =>
        from === "review" ? router.back() : router.push({ pathname: "/evidence", params: { draft } })
      }
    />
  );
}
