/**
 * CIT-13. Shows only a reference the server returned in this app session
 * (services/received.ts), never one taken from the URL; anything else goes Home.
 */
import { Redirect, router, useLocalSearchParams } from "expo-router";

import { ReceivedScreen } from "../../src/screens/ReceivedScreen";
import { receivedReference } from "../../src/services/received";

export default function Cit13() {
  const { draft } = useLocalSearchParams<{ draft?: string }>();
  const reference = draft ? receivedReference(draft) : null;
  if (!reference) return <Redirect href="/home" />;
  return <ReceivedScreen reportReference={reference} onHome={() => router.replace("/home")} />;
}
