/**
 * The resolved principal. Only the (auth) gateway and sign-in/sign-out write
 * it (SRS §3.3.1). Staff principals do not exist yet.
 */
import { create } from "zustand";

import { readRefreshToken } from "../services/secureStorage";
import { onCitizenSessionEnded, type SessionEndReason } from "./session";

export type Principal = { subjectType: "citizen" } | null;

type PrincipalState = {
  resolved: boolean;
  principal: Principal;
  /** Why the citizen is signed out, when sign-in should explain it (FR-AUTH.13). */
  notice: SessionEndReason | null;
  /** Restores a citizen principal when a session is stored on the device. */
  resolve: () => Promise<void>;
  signedInAsCitizen: () => void;
  signedOut: (notice?: SessionEndReason) => void;
};

export const usePrincipal = create<PrincipalState>((set) => ({
  resolved: false,
  principal: null,
  notice: null,
  resolve: async () => {
    const refresh = await readRefreshToken();
    set({ resolved: true, principal: refresh ? { subjectType: "citizen" } : null });
  },
  signedInAsCitizen: () => set({ resolved: true, principal: { subjectType: "citizen" }, notice: null }),
  signedOut: (notice) => set({ resolved: true, principal: null, notice: notice ?? null }),
}));

// An expired or revoked session found by the API client signs the principal out.
onCitizenSessionEnded((reason) => usePrincipal.getState().signedOut(reason));
