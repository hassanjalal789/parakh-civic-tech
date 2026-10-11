/**
 * CIT-12 — waiting to send (T-062; FR-PUB.29, FR-COMMON.12; DG-55, DG-67, DG-84).
 *
 * - Labelled "Waiting to send", announced as "waiting to send, not yet sent". No report
 *   reference appears, and nothing says the authority has received it.
 * - **Only Retry and Cancel** (DG-84, Hassan Jalal, 2026-10-11): there is no Edit, and
 *   nothing in the report can be changed here.
 * - Cancel stops the retries; the phone's copy and the server's temporary copy are
 *   deleted (DG-55). If the report already exists, its reference is shown instead.
 * - The queue keeps trying by itself for 48 hours from the first press of Submit
 *   (DG-67); this screen follows it, and opens CIT-13 when the server confirms.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, StyleSheet, Text, View } from "react-native";

import { receivedReference } from "../services/received";
import type { SubmissionQueue, SubmissionResult } from "../services/submissionQueue";
import type { DraftRepository, DraftRow } from "../storage/drafts";
import { Body, LinkButton, Notice, PrimaryButton, Screen, Title } from "../ui";

type Props = {
  drafts: DraftRepository;
  draftId: string;
  queue: Pick<SubmissionQueue, "retryNow" | "cancel">;
  /** The server created the report: CIT-13. */
  onReceived: (reportReference: string) => void;
  onHome: () => void;
  /** How often the background queue's progress is read; tests shorten it. */
  refreshMs?: number;
};

export function QueuedScreen({ drafts, draftId, queue, onReceived, onHome, refreshMs = 3000 }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<DraftRow | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const [message, setMessage] = useState<{ text: string; kind: "error" | "info" } | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    AccessibilityInfo.announceForAccessibility(t("queued.status"));
    return () => {
      alive.current = false;
    };
    // Once: the state is announced when the screen opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refresh = useCallback(async () => {
    const row = await drafts.get(draftId);
    if (!alive.current) return;
    if (!row) {
      // Gone from the phone: sent by the background queue, or cancelled or ended elsewhere.
      const reference = receivedReference(draftId);
      if (reference) return onReceived(reference);
    }
    setDraft(row);
  }, [drafts, draftId, onReceived]);

  useEffect(() => {
    const tick = () => void refresh();
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, refreshMs);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [refresh, refreshMs]);

  const show = (text: string, kind: "error" | "info" = "info") => {
    setMessage({ text, kind });
    AccessibilityInfo.announceForAccessibility(text);
  };

  const handle = async (result: SubmissionResult) => {
    if (!alive.current) return;
    switch (result.kind) {
      case "submitted":
      case "already_submitted":
        return onReceived(result.reportReference);
      case "cancelled":
        return onHome();
      case "retrying":
        show(t("queued.stillWaiting"));
        break;
      case "needs_action":
        show(t("queued.needsAction", { code: result.code }), "error");
        break;
      case "cancel_pending":
        show(t("queued.cancelPending"));
        break;
      case "removed_unconfirmed":
        show(t("queued.removed"), "error");
        break;
      case "refused":
        show(t(result.reason === "unknown_draft" ? "queued.gone" : "common.generic"), "error");
        break;
    }
    await refresh();
  };

  const retry = async () => {
    setBusy(true);
    show(t("queued.trying"));
    try {
      await handle(await queue.retryNow(draftId));
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  const cancel = async () => {
    setAsking(false);
    setBusy(true);
    try {
      await handle(await queue.cancel(draftId));
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  if (draft === null) {
    return (
      <Screen testID="CIT-12">
        <Title>{t("queued.title")}</Title>
        <Notice>{message?.text ?? t("queued.gone")}</Notice>
        <PrimaryButton label={t("queued.home")} onPress={onHome} />
      </Screen>
    );
  }

  const outcome = draft?.submission_outcome ?? null;
  const cancelling = !!draft?.cancel_requested_at;
  return (
    <Screen testID="CIT-12">
      <Title>{t("queued.title")}</Title>
      <Text accessibilityLabel={t("queued.status")} style={styles.status}>
        {t("queued.status")}
      </Text>
      <Body>{t("queued.body")}</Body>
      <Body>{t("queued.notSent")}</Body>
      {(outcome === "rejected" || outcome === "needs_upload") && !message ? (
        <Notice>{t("queued.needsAction", { code: draft?.last_error ?? outcome })}</Notice>
      ) : null}
      {(outcome === "failed" || outcome === "unknown") && draft?.last_error && !message ? (
        <Notice kind="info">{t("queued.lastError")}</Notice>
      ) : null}
      {cancelling && !message ? <Notice kind="info">{t("queued.cancelPending")}</Notice> : null}
      {message ? <Notice kind={message.kind}>{message.text}</Notice> : null}

      {asking ? (
        <View style={styles.block}>
          <Body>{t("queued.cancelAsk")}</Body>
          <PrimaryButton label={t("queued.cancelYes")} busy={busy} onPress={() => void cancel()} />
          <LinkButton label={t("queued.cancelNo")} onPress={() => setAsking(false)} />
        </View>
      ) : (
        <View style={styles.block}>
          <PrimaryButton
            label={t("queued.retry")}
            busy={busy}
            disabled={draft === undefined || cancelling}
            onPress={() => void retry()}
          />
          <LinkButton
            label={t("queued.cancel")}
            disabled={busy || draft === undefined}
            onPress={() => setAsking(true)}
          />
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  block: { gap: 10 },
  status: { fontSize: 19, fontWeight: "700", color: "#4a4a4a" },
});
