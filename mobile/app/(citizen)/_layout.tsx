/**
 * Guard: a citizen principal only. Anything else goes back to the gateway. No acting-role header exists here.
 * The submission queue runs for the whole signed-in session, from the moment the local store opens,
 * so a report waiting to send is retried whichever screen is open (T-052).
 */
import { Redirect, Stack } from "expo-router";
import { useEffect } from "react";

import { usePrincipal } from "../../src/auth/principal";
import { citizenQueue } from "../../src/services/citizenQueue";
import { useCitizenStore } from "../../src/storage/useCitizenStore";

function SubmissionQueueRunner() {
  const store = useCitizenStore();
  useEffect(() => {
    if (store.status === "ready") citizenQueue(store.accountId, store.drafts);
  }, [store]);
  return null;
}

export default function CitizenLayout() {
  const principal = usePrincipal((s) => s.principal);
  if (principal?.subjectType !== "citizen") return <Redirect href="/" />;
  return (
    <>
      <SubmissionQueueRunner />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
