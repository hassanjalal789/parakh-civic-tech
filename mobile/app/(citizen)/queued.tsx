/**
 * CIT-12. A report whose Submit was pressed and that the server has not yet confirmed.
 * Only Retry and Cancel (DG-84); CIT-13 opens when the server confirms.
 */
import { Redirect, router, useLocalSearchParams } from "expo-router";

import { goHome } from "../../src/navigation/reporting";
import { citizenQueue } from "../../src/services/citizenQueue";
import { CitizenStoreStatus } from "../../src/screens/EvidenceScreen";
import { QueuedScreen } from "../../src/screens/QueuedScreen";
import { useCitizenStore } from "../../src/storage/useCitizenStore";

export default function Cit12() {
  const { draft } = useLocalSearchParams<{ draft?: string }>();
  const store = useCitizenStore();
  if (!draft) return <Redirect href="/home" />;
  if (store.status !== "ready") return <CitizenStoreStatus state={store} />;
  return (
    <QueuedScreen
      drafts={store.drafts}
      draftId={draft}
      queue={citizenQueue(store.accountId, store.drafts)}
      onReceived={() => router.replace({ pathname: "/received", params: { draft } })}
      onHome={() => goHome(router)}
    />
  );
}
