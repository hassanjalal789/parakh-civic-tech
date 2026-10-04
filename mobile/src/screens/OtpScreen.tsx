/**
 * CIT-05 — verify ownership of the number. Calls API-122. The code is never
 * stored for later verification; a wrong or expired code gets one uniform
 * message, and the remaining attempts are announced to screen readers.
 */
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, StyleSheet, TextInput } from "react-native";

import { requestCitizenOtp, verifyCitizenOtp } from "../api/auth";
import { ApiError, OfflineError } from "../api/errors";
import { useOnboarding } from "../auth/onboarding";
import { usePrincipal } from "../auth/principal";
import { config } from "../config";
import { maskE164 } from "../domain/phone";
import { Body, LinkButton, Notice, PrimaryButton, Screen, Title } from "../ui";

type Props = { onSignedIn: () => void; onEditNumber: () => void; onReviewConsent: () => void };

export function OtpScreen({ onSignedIn, onEditNumber, onReviewConsent }: Props) {
  const { t } = useTranslation();
  const e164 = useOnboarding((s) => s.e164);
  const initialWait = useOnboarding((s) => s.resendAfterSeconds);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(initialWait);

  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  if (!e164) {
    return (
      <Screen testID="CIT-05">
        <LinkButton label={t("otp.editNumber")} onPress={onEditNumber} />
      </Screen>
    );
  }

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      await verifyCitizenOtp(e164, code);
      useOnboarding.getState().reset(); // the device consent payload is discarded once bound
      usePrincipal.getState().signedInAsCitizen();
      onSignedIn();
    } catch (e) {
      setCode("");
      if (e instanceof OfflineError) setError(t("otp.offline"));
      else if (e instanceof ApiError && e.action === "show_uniform_otp_error") {
        const left = e.numberDetail("attempts_remaining") ?? 0;
        setAttempts(left);
        setError(t("otp.wrong"));
        AccessibilityInfo.announceForAccessibility(
          `${t("otp.wrong")} ${left > 0 ? t("otp.attemptsRemaining", { count: left }) : t("otp.noAttempts")}`,
        );
      } else if (e instanceof ApiError && e.action === "review_consent") {
        setError(t("otp.consentRequired"));
        onReviewConsent();
      } else if (e instanceof ApiError && e.action === "contact_support") setError(t("otp.unavailable"));
      else setError(t("common.generic"));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    const consent = useOnboarding.getState().pendingConsent;
    if (!consent) return onReviewConsent();
    setError(null);
    try {
      const result = await requestCitizenOtp(e164, consent);
      setAttempts(null);
      setWait(result.resend_after_seconds);
    } catch (e) {
      if (e instanceof OfflineError) setError(t("otp.offline"));
      else if (e instanceof ApiError && e.code === "E_OTP_COOLDOWN")
        setWait(e.numberDetail("retry_after_seconds") ?? 60);
      else if (e instanceof ApiError && e.action === "wait_and_retry") setError(t("phone.rateLimited"));
      else setError(t("common.generic"));
    }
  };

  return (
    <Screen testID="CIT-05">
      <Title>{t("otp.title")}</Title>
      <Body>{t("otp.sentTo", { number: maskE164(e164) })}</Body>
      <TextInput
        testID="otp-input"
        accessibilityLabel={t("otp.label")}
        value={code}
        onChangeText={(v) => setCode(v.replace(/\D/g, "").slice(0, config.otpLength))}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        maxLength={config.otpLength}
        style={styles.input}
      />
      {error ? <Notice>{error}</Notice> : null}
      {attempts !== null ? (
        <Notice kind="info">
          {attempts > 0 ? t("otp.attemptsRemaining", { count: attempts }) : t("otp.noAttempts")}
        </Notice>
      ) : null}
      <PrimaryButton
        label={t("otp.verify")}
        onPress={() => void verify()}
        busy={busy}
        disabled={code.length !== config.otpLength || attempts === 0}
      />
      {wait > 0 ? (
        <Body>{t("otp.resendIn", { seconds: wait })}</Body>
      ) : (
        <LinkButton label={t("otp.resend")} onPress={() => void resend()} />
      )}
      <LinkButton label={t("otp.editNumber")} onPress={onEditNumber} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  input: {
    minHeight: 56,
    fontSize: 28,
    letterSpacing: 8,
    borderWidth: 1,
    borderColor: "#888",
    borderRadius: 8,
    paddingHorizontal: 12,
    writingDirection: "ltr",
    textAlign: "center",
  },
});
