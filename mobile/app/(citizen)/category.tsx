/**
 * CIT-07. The reporting order is fixed: CIT-06 → CIT-07 → CIT-08 → CIT-09 → CIT-10 (SRS §3.4).
 * Choosing a category starts the draft and opens CIT-08.
 */
import { router } from "expo-router";

import { CategoryScreen } from "../../src/screens/CategoryScreen";
import { CitizenStoreStatus } from "../../src/screens/EvidenceScreen";
import { useCitizenStore } from "../../src/storage/useCitizenStore";

export default function Cit07() {
  const store = useCitizenStore();
  if (store.status !== "ready") return <CitizenStoreStatus state={store} />;
  return (
    <CategoryScreen
      drafts={store.drafts}
      onChosen={(draft) => router.push({ pathname: "/evidence", params: { draft } })}
    />
  );
}
