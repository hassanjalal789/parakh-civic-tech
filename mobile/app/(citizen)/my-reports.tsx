/**
 * CIT-14. Opened from Home. A waiting submission opens CIT-12; an unfinished draft goes on at CIT-08.
 */
import { router } from "expo-router";
import { useTranslation } from "react-i18next";

import { CitizenStoreStatus } from "../../src/screens/EvidenceScreen";
import { MyReportsScreen } from "../../src/screens/MyReportsScreen";
import { useCitizenStore } from "../../src/storage/useCitizenStore";

export default function Cit14() {
  const store = useCitizenStore();
  const { i18n } = useTranslation();
  if (store.status !== "ready") return <CitizenStoreStatus state={store} />;
  return (
    <MyReportsScreen
      drafts={store.drafts}
      accountId={store.accountId}
      language={i18n.language}
      onOpenWaiting={(draft) => router.push({ pathname: "/queued", params: { draft } })}
      onContinueDraft={(draft) => router.push({ pathname: "/evidence", params: { draft } })}
      onHome={() => router.replace("/home")}
    />
  );
}
