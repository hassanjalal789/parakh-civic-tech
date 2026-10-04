/** CIT-01 — choose the interface language before anything else. Works fully offline. */
import { useTranslation } from "react-i18next";

import { useOnboarding } from "../auth/onboarding";
import { usePrincipal } from "../auth/principal";
import { type Language, setLanguage } from "../i18n";
import { Body, Notice, PrimaryButton, Screen, Title } from "../ui";

export function LanguageScreen({ onChosen }: { onChosen: () => void }) {
  const { t } = useTranslation();
  const notice = usePrincipal((s) => s.notice);
  const choose = async (language: Language) => {
    useOnboarding.getState().setLanguage(language);
    await setLanguage(language);
    onChosen();
  };
  return (
    <Screen testID="CIT-01">
      <Title>{t("language.title")}</Title>
      {/* FR-AUTH.13: a plain explanation when an expired session brought the citizen back here. */}
      {notice === "session_expired" ? <Notice kind="info">{t("session.expired")}</Notice> : null}
      <Body>{t("language.prompt")}</Body>
      <PrimaryButton label="اردو" onPress={() => void choose("ur")} />
      <PrimaryButton label="English" onPress={() => void choose("en")} />
    </Screen>
  );
}
