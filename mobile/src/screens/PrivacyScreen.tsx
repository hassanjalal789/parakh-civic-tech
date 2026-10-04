/**
 * CIT-02 — why we need the number and the voice, explained before collecting
 * either. Every disclosure point in the Screen Inventory is shown.
 */
import { useTranslation } from "react-i18next";

import { Body, LinkButton, PrimaryButton, Screen, Title } from "../ui";

export const DISCLOSURE_KEYS = [
  "privacy.numberRequired",
  "privacy.notAnonymous",
  "privacy.numberForSignIn",
  "privacy.staffNeverSee",
  "privacy.voiceStored",
  "privacy.aiErrors",
  "privacy.aiProvider",
  "privacy.reviewBeforeSend",
  "privacy.smsOptional",
  "privacy.withdraw",
] as const;

export function PrivacyScreen({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  const { t } = useTranslation();
  return (
    <Screen testID="CIT-02">
      <Title>{t("privacy.title")}</Title>
      {DISCLOSURE_KEYS.map((key) => (
        <Body key={key}>• {t(key)}</Body>
      ))}
      <PrimaryButton label={t("common.continue")} onPress={onContinue} />
      <LinkButton label={t("common.changeLanguage")} onPress={onBack} />
    </Screen>
  );
}
