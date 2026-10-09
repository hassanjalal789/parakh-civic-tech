/**
 * Development builds only: opens CIT-08 on the signed-in citizen's newest local
 * draft, or a new one, until CIT-07 (T-048) starts drafts in the real order.
 * Opened with parakh://dev-capture while signed in. A release build goes Home.
 */
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";

import { config } from "../../src/config";
import { CitizenStoreStatus } from "../../src/screens/EvidenceScreen";
import { useCitizenStore } from "../../src/storage/useCitizenStore";

export default function DevCapture() {
  if (config.variant !== "development" || !__DEV__) return <Redirect href="/home" />;
  return <OpenNewestDraft />;
}

function OpenNewestDraft() {
  const store = useCitizenStore();
  const [draftId, setDraftId] = useState<string | null>(null);
  useEffect(() => {
    if (store.status !== "ready") return;
    void (async () => {
      const local = (await store.drafts.list()).find((d) => d.pipeline_state === "LOCAL_DRAFT");
      setDraftId((local ?? (await store.drafts.create())).client_submission_id);
    })();
  }, [store]);
  if (draftId) return <Redirect href={{ pathname: "/evidence", params: { draft: draftId } }} />;
  return <CitizenStoreStatus state={store} />;
}
