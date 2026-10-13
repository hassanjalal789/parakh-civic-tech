/**
 * CIT-11. Reached from CIT-10; Submit opens CIT-13 when the server created the report,
 * or CIT-12 while it waits to send. "Change" opens the part's screen, which returns
 * here; the review is then prepared again, from the start.
 */
import { Redirect, router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useCallback, useState } from "react";

import { finishReporting } from "../../src/navigation/reporting";
import { citizenQueue } from "../../src/services/citizenQueue";
import { CitizenStoreStatus } from "../../src/screens/EvidenceScreen";
import { type ReportPart, ReviewScreen } from "../../src/screens/ReviewScreen";
import { useCitizenStore } from "../../src/storage/useCitizenStore";

const ROUTE: Record<ReportPart, "/category" | "/evidence" | "/describe" | "/location"> = {
  category: "/category",
  evidence: "/evidence",
  description: "/describe",
  location: "/location",
};

export default function Cit11() {
  const { draft } = useLocalSearchParams<{ draft?: string }>();
  const store = useCitizenStore();
  const [visit, setVisit] = useState(0);
  // Each return to this screen is a new review of the report as it now is.
  useFocusEffect(useCallback(() => setVisit((v) => v + 1), []));
  if (!draft) return <Redirect href="/home" />;
  if (store.status !== "ready") return <CitizenStoreStatus state={store} />;
  if (visit === 0) return null;
  return (
    <ReviewScreen
      key={visit}
      drafts={store.drafts}
      draftId={draft}
      queue={citizenQueue(store.accountId, store.drafts)}
      onEdit={(part) => router.push({ pathname: ROUTE[part], params: { draft, from: "review" } })}
      onReceived={() => finishReporting(router, { pathname: "/received", params: { draft } })}
      onQueued={() => finishReporting(router, { pathname: "/queued", params: { draft } })}
    />
  );
}
