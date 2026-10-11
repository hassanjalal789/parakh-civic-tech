/**
 * CIT-06 — five choices, nothing else (FR-PUB.1). Report an Issue, the primary
 * action, starts a report (CIT-07); the other tiles are visibly marked as not
 * yet available in this build.
 */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text } from "react-native";

import { logout } from "../api/auth";
import { usePrincipal } from "../auth/principal";
import { LinkButton, Notice, Screen, Title } from "../ui";

/** The five choices of FR-PUB.1; placeholder pictures until the icon set exists, each with its text label. */
const TILES = [
  ["home.report", "📝"],
  ["home.myReports", "📋"],
  ["home.notifications", "🔔"],
  ["home.help", "❔"],
  ["home.profile", "⚙️"],
] as const;

function Tile(props: { label: string; picture: string; onPress?: () => void; primary?: boolean }) {
  const disabled = !props.onPress;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={props.onPress}
      style={[styles.tile, props.primary ? styles.primary : null, disabled ? styles.disabled : null]}
    >
      <Text style={styles.picture} accessibilityElementsHidden importantForAccessibility="no">
        {props.picture}
      </Text>
      <Text style={[styles.label, props.primary ? styles.primaryLabel : null]}>{props.label}</Text>
    </Pressable>
  );
}

export function HomeScreen({ onReport }: { onReport: () => void }) {
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
      {TILES.map(([key, picture]) =>
        key === "home.report" ? (
          <Tile key={key} label={t(key)} picture={picture} onPress={onReport} primary />
        ) : (
          <Tile key={key} label={t(key)} picture={picture} />
        ),
      )}
      <Notice kind="info">{t("home.notYet")}</Notice>
      <LinkButton label={t("home.signOut")} onPress={() => void signOut()} disabled={busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 64,
    borderWidth: 1,
    borderColor: "#0b5d3b",
    borderRadius: 12,
    paddingHorizontal: 16,
    marginVertical: 6,
  },
  primary: { backgroundColor: "#0b5d3b", minHeight: 80 },
  disabled: { borderColor: "#c8c8c8" },
  picture: { fontSize: 28, marginEnd: 12 },
  label: { fontSize: 18, fontWeight: "600", color: "#1b1b1b" },
  primaryLabel: { color: "#fff" },
});
