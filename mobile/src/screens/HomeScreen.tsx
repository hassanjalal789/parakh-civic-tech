/**
 * CIT-06 — five choices, nothing else. Only sign-out works in this build;
 * the other tiles are visibly marked as not yet available.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";

import { logout } from "../api/auth";
import { usePrincipal } from "../auth/principal";
import { LinkButton, Notice, PrimaryButton, Screen, Title } from "../ui";

const TILES = ["home.report", "home.myReports", "home.notifications", "home.help", "home.profile"] as const;

export function HomeScreen() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const signOut = async () => {
    setBusy(true);
    try {
      await logout();
    } catch {
      // Local tokens are already cleared; the server session expires on its own.
    } finally {
      usePrincipal.getState().signedOut();
      setBusy(false);
    }
  };

  return (
    <Screen testID="CIT-06">
      <Title>{t("home.title")}</Title>
      {TILES.map((key) => (
        <PrimaryButton key={key} label={t(key)} onPress={() => undefined} disabled />
      ))}
      <Notice kind="info">{t("home.notYet")}</Notice>
      <LinkButton label={t("home.signOut")} onPress={() => void signOut()} disabled={busy} />
    </Screen>
  );
}
