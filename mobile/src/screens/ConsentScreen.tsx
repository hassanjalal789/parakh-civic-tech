/**
 * CIT-03 — three separate decisions, held on the device. Nothing is sent from
 * this screen; the snapshot travels with the OTP request at CIT-04.
 */
import { useTranslation } from "react-i18next";

import { requiredConsentsGiven, useOnboarding } from "../auth/onboarding";
import { Body, Checkbox, LinkButton, Notice, PrimaryButton, Screen, Title } from "../ui";

export function ConsentScreen({ onContinue, onBack }: { onContinue: () => void; onBack: () => void }) {
  const { t } = useTranslation();
  const selections = useOnboarding((s) => s.selections);
  const setSelection = useOnboarding((s) => s.setSelection);
  const ready = requiredConsentsGiven(selections);

  const agree = () => {
    useOnboarding.getState().confirmConsent();
    onContinue();
  };

  return (
    <Screen testID="CIT-03">
      <Title>{t("consent.title")}</Title>
      <Body>{t("consent.intro")}</Body>
      <Checkbox
        testID="consent-account"
        tag={t("consent.required")}
        label={t("consent.account")}
        checked={selections.account_creation_and_processing}
        onChange={(v) => setSelection("account_creation_and_processing", v)}
      />
      <Checkbox
        testID="consent-voice"
        tag={t("consent.required")}
        label={t("consent.voice")}
        checked={selections.voice_processing}
        onChange={(v) => setSelection("voice_processing", v)}
      />
      <Checkbox
        testID="consent-sms"
        tag={t("consent.optional")}
        label={t("consent.sms")}
        checked={selections.sms_notification}
        onChange={(v) => setSelection("sms_notification", v)}
      />
      {ready ? null : <Notice kind="info">{t("consent.requiredMissing")}</Notice>}
      <PrimaryButton label={t("consent.agree")} onPress={agree} disabled={!ready} />
      <LinkButton label={t("common.back")} onPress={onBack} />
    </Screen>
  );
}
