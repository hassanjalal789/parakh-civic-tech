/** CIT-04 — the only identifier Parakh asks for. Calls API-121; no queueing offline. */
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { requestCitizenOtp } from "../api/auth";
import { ApiError, OfflineError } from "../api/errors";
import { useOnboarding } from "../auth/onboarding";
import { normalisePkMobile } from "../domain/phone";
import { Body, LinkButton, Notice, PrimaryButton, Screen, Title } from "../ui";

type Props = { onCodeSent: () => void; onReviewConsent: () => void; onBack: () => void };

export function PhoneScreen({ onCodeSent, onReviewConsent, onBack }: Props) {
  const { t } = useTranslation();
  const [number, setNumber] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    const e164 = normalisePkMobile(number);
    if (!e164) {
      setError(t("phone.invalid"));
      return;
    }
    const consent = useOnboarding.getState().pendingConsent;
    if (!consent) {
      onReviewConsent();
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await requestCitizenOtp(e164, consent);
      useOnboarding.getState().setNumber(e164, result.resend_after_seconds);
      onCodeSent();
    } catch (e) {
      if (e instanceof OfflineError) setError(t("phone.offline"));
      else if (e instanceof ApiError && e.action === "fix_number") setError(t("phone.invalid"));
      else if (e instanceof ApiError && e.action === "use_test_number")
        setError(t("phone.devTestNumberOnly"));
      else if (e instanceof ApiError && e.code === "E_OTP_COOLDOWN")
        setError(t("phone.wait", { seconds: e.numberDetail("retry_after_seconds") ?? 60 }));
      else if (e instanceof ApiError && e.action === "wait_and_retry") setError(t("phone.rateLimited"));
      else if (e instanceof ApiError && e.action === "review_consent") {
        setError(t("phone.consentChanged"));
        onReviewConsent();
      } else setError(t("common.generic"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen testID="CIT-04">
      <Title>{t("phone.title")}</Title>
      <Body>{t("phone.reminder")}</Body>
      {/* Digits stay left-to-right inside an RTL layout. */}
      <View style={styles.row}>
        <Text style={styles.prefix}>+92</Text>
        <TextInput
          testID="phone-input"
          accessibilityLabel={t("phone.label")}
          value={number}
          onChangeText={(v) => {
            setNumber(v);
            setError(null);
          }}
          placeholder={t("phone.placeholder")}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          autoComplete="tel"
          maxLength={16}
          style={styles.input}
        />
      </View>
      {error ? <Notice>{error}</Notice> : null}
      <PrimaryButton
        label={t("phone.send")}
        onPress={() => void send()}
        busy={busy}
        disabled={!number.trim()}
      />
      <LinkButton label={t("common.back")} onPress={onBack} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, direction: "ltr" },
  prefix: { fontSize: 22, fontWeight: "600" },
  input: {
    flex: 1,
    minHeight: 52,
    fontSize: 22,
    borderWidth: 1,
    borderColor: "#888",
    borderRadius: 8,
    paddingHorizontal: 12,
    writingDirection: "ltr",
    textAlign: "left",
  },
});
