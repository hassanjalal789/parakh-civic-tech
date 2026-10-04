/**
 * Pre-authentication state for CIT-01…CIT-05, held in memory on the device.
 *
 * Nothing here is sent before CIT-04. The consent choices travel with the OTP
 * request as a snapshot; if the citizen abandons the flow, `reset()` discards
 * them and no account or consent record exists on the server (FR-AUTH.4).
 * Not persisted: encrypted local storage (LDS-3) arrives with T-047.
 */
import * as Crypto from "expo-crypto";
import { create } from "zustand";

import type { ConsentSelections, PendingConsent } from "../api/auth";
import { config } from "../config";
import type { Language } from "../i18n";

const NO_CONSENT: ConsentSelections = {
  account_creation_and_processing: false,
  voice_processing: false,
  sms_notification: false,
};

type OnboardingState = {
  language: Language | null;
  selections: ConsentSelections;
  pendingConsent: PendingConsent | null;
  e164: string | null;
  resendAfterSeconds: number;
  setLanguage: (language: Language) => void;
  setSelection: (key: keyof ConsentSelections, value: boolean) => void;
  /** Freezes the current choices into a snapshot. A changed selection yields a new ref. */
  confirmConsent: () => PendingConsent;
  setNumber: (e164: string, resendAfterSeconds: number) => void;
  reset: () => void;
};

export const requiredConsentsGiven = (s: ConsentSelections): boolean =>
  s.account_creation_and_processing && s.voice_processing;

export const useOnboarding = create<OnboardingState>((set, get) => ({
  language: null,
  selections: NO_CONSENT,
  pendingConsent: null,
  e164: null,
  resendAfterSeconds: 0,
  setLanguage: (language) => set({ language }),
  setSelection: (key, value) => set((s) => ({ selections: { ...s.selections, [key]: value } })),
  confirmConsent: () => {
    const { selections, pendingConsent, language } = get();
    if (!requiredConsentsGiven(selections)) {
      throw new Error("Both required consents are needed");
    }
    const unchanged =
      pendingConsent !== null &&
      pendingConsent.locale === (language ?? "ur") &&
      JSON.stringify(pendingConsent.selections) === JSON.stringify(selections);
    const snapshot: PendingConsent = unchanged
      ? pendingConsent
      : { ref: Crypto.randomUUID(), version: config.consentVersion, locale: language ?? "ur", selections };
    set({ pendingConsent: snapshot });
    return snapshot;
  },
  setNumber: (e164, resendAfterSeconds) => set({ e164, resendAfterSeconds }),
  reset: () =>
    set({
      language: get().language,
      selections: NO_CONSENT,
      pendingConsent: null,
      e164: null,
      resendAfterSeconds: 0,
    }),
}));
