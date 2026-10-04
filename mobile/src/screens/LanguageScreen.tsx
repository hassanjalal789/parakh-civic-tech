/** CIT-01 — choose the interface language before anything else. Works fully offline. */
import { useTranslation } from "react-i18next";

import { useOnboarding } from "../auth/onboarding";
import { type Language, setLanguage } from "../i18n";
import { Body, PrimaryButton, Screen, Title } from "../ui";

export function LanguageScreen({ onChosen }: { onChosen: () => void }) {
  const { t } = useTranslation();
  const choose = async (language: Language) => {
    useOnboarding.getState().setLanguage(language);
    await setLanguage(language);
    onChosen();
  };
  return (
    <Screen testID="CIT-01">
      <Title>{t("language.title")}</Title>
      <Body>{t("language.prompt")}</Body>
      <PrimaryButton label="اردو" onPress={() => void choose("ur")} />
      <PrimaryButton label="English" onPress={() => void choose("en")} />
    </Screen>
  );
}
