/**
 * The resolved principal. Only the (auth) gateway and sign-in/sign-out write
 * it (SRS §3.3.1). Staff principals do not exist yet.
 */
import { create } from "zustand";

import { readRefreshToken } from "../services/secureStorage";

export type Principal = { subjectType: "citizen" } | null;

type PrincipalState = {
  resolved: boolean;
  principal: Principal;
  /** Restores a citizen principal when a session is stored on the device. */
  resolve: () => Promise<void>;
  signedInAsCitizen: () => void;
  signedOut: () => void;
};

export const usePrincipal = create<PrincipalState>((set) => ({
  resolved: false,
  principal: null,
  resolve: async () => {
    const refresh = await readRefreshToken();
    set({ resolved: true, principal: refresh ? { subjectType: "citizen" } : null });
  },
  signedInAsCitizen: () => set({ resolved: true, principal: { subjectType: "citizen" } }),
  signedOut: () => set({ resolved: true, principal: null }),
}));
