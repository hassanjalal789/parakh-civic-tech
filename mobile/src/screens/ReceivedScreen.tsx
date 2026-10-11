/**
 * CIT-13 — received (T-062; FR-PUB.30; DG-85).
 *
 * Reached only with a reference the server returned (services/received.ts). It shows,
 * for now, only (DG-85, Hassan Jalal, 2026-10-11):
 * - that the report was received successfully;
 * - the `PRK-` reference — large, selectable, announced, and left-to-right inside an
 *   Urdu layout;
 * - "You can track its status in My Reports."
 * No expected response time, resolution time, SLA or other timeframe is shown.
 */
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, StyleSheet, Text } from "react-native";

import { Body, PrimaryButton, Screen, Title } from "../ui";

type Props = { reportReference: string; onHome: () => void };

export function ReceivedScreen({ reportReference, onHome }: Props) {
  const { t } = useTranslation();

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(
      `${t("received.body")} ${t("received.referenceLabel", { reference: reportReference })}`,
    );
  }, [reportReference, t]);

  return (
    <Screen testID="CIT-13">
      <Title>{t("received.title")}</Title>
      <Body>{t("received.body")}</Body>
      <Body>{t("received.reference")}</Body>
      <Text
        selectable
        accessibilityLabel={t("received.referenceLabel", { reference: reportReference })}
        style={styles.reference}
        testID="report-reference"
      >
        {reportReference}
      </Text>
      <Body>{t("received.track")}</Body>
      <PrimaryButton label={t("received.home")} onPress={onHome} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Left-to-right whatever the interface language: a reference is read character by character.
  reference: {
    fontSize: 34,
    fontWeight: "700",
    letterSpacing: 1,
    color: "#1b1b1b",
    writingDirection: "ltr",
    textAlign: "center",
    paddingVertical: 12,
  },
});
