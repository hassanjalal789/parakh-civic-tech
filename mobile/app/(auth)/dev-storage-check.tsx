/** Development builds only (DEP-08 evidence). A release build redirects to the gateway's first screen. */
import { Redirect } from "expo-router";

import { config } from "../../src/config";
import { StorageCheckScreen } from "../../src/screens/dev/StorageCheckScreen";

export default function DevStorageCheck() {
  if (config.variant !== "development" || !__DEV__) return <Redirect href="/" />;
  return <StorageCheckScreen />;
}
