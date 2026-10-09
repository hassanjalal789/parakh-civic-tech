/**
 * Opens the signed-in citizen's local store for a screen. Drafts are bound to
 * the citizen's own account id (FR-COMMON.25), read from this phone when known,
 * so a screen that captures evidence works offline (UC-CIT-016).
 */
import { useEffect, useState } from "react";

import { ensureCitizenAccountId } from "../api/auth";
import { OfflineError } from "../api/errors";
import type { DraftRepository } from "./drafts";
import { openLocalStore } from "./localStore";

export type CitizenStoreState =
  | { status: "opening" }
  | { status: "ready"; drafts: DraftRepository }
  /** offline: the account id is not on this phone yet and the server cannot be reached. */
  | { status: "failed"; reason: "offline" | "error" };

export function useCitizenStore(): CitizenStoreState {
  const [state, setState] = useState<CitizenStoreState>({ status: "opening" });
  useEffect(() => {
    let live = true;
    void (async () => {
      try {
        const store = await openLocalStore(await ensureCitizenAccountId());
        if (live) setState({ status: "ready", drafts: store.drafts });
      } catch (error) {
        if (live) setState({ status: "failed", reason: error instanceof OfflineError ? "offline" : "error" });
      }
    })();
    return () => {
      live = false;
    };
  }, []);
  return state;
}
