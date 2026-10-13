/**
 * CIT-14 — My Reports (T-063; FR-PUB.31).
 *
 * - Lists every report this account submitted, and the submissions and drafts still on this phone, in
 *   three kinds that are always told apart: sent reports (with a reference and a civic status),
 *   submissions *waiting to send* (no reference, "not sent yet"), and drafts not finished.
 * - Each row gives the reference (or "waiting to send"), the category, a plain-language status and the date.
 *   Status is a word and a picture, never colour alone. No state code is ever shown (SRS §4.1.4).
 * - With no connection it shows the last list this phone saw, held in memory only, plus what is waiting
 *   here. A waiting submission opens CIT-12; an unfinished draft goes on at CIT-08. The detail of a sent
 *   report is CIT-15 (not built yet), so a sent report is not opened from here.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, Pressable, StyleSheet, Text, View } from "react-native";

import { OfflineError } from "../api/errors";
import { fetchMyReports, type ReportSummary } from "../api/reporting";
import { buildRows, type Row } from "../domain/myReports";
import { useDirection } from "../i18n";
import { cachedReports, rememberReports } from "../services/reportsCache";
import type { DraftRepository, DraftRow } from "../storage/drafts";
import { Body, LinkButton, Notice, PrimaryButton, Screen, Title } from "../ui";

type Props = {
  drafts: DraftRepository;
  accountId: string;
  /** A submission waiting to send: its CIT-12 screen. */
  onOpenWaiting: (draftId: string) => void;
  /** An unfinished draft: go on where it stopped. */
  onContinueDraft: (draftId: string) => void;
  onHome: () => void;
  fetchReports?: () => Promise<ReportSummary[]>;
  language?: string;
};

type Load =
  | { name: "loading" }
  | { name: "live" }
  /** No connection: the remembered list, or none. */
  | { name: "offline"; remembered: boolean }
  | { name: "failed" };

export function MyReportsScreen({
  drafts,
  accountId,
  onOpenWaiting,
  onContinueDraft,
  onHome,
  fetchReports = fetchMyReports,
  language = "en",
}: Props) {
  const { t } = useTranslation();
  const { text } = useDirection();
  const [reports, setReports] = useState<ReportSummary[]>(() => cachedReports(accountId)?.reports ?? []);
  const [local, setLocal] = useState<DraftRow[]>([]);
  const [load, setLoad] = useState<Load>({ name: "loading" });
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoad({ name: "loading" });
    const mine = await drafts.list(); // always local: it works with no connection
    if (alive.current) setLocal(mine);
    try {
      const fresh = await fetchReports();
      rememberReports(accountId, fresh);
      if (!alive.current) return;
      setReports(fresh);
      setLoad({ name: "live" });
    } catch (error) {
      if (!alive.current) return;
      const remembered = cachedReports(accountId);
      if (error instanceof OfflineError) {
        setReports(remembered?.reports ?? []);
        setLoad({ name: "offline", remembered: remembered !== null });
        AccessibilityInfo.announceForAccessibility(t("myReports.offline"));
      } else {
        setLoad({ name: "failed" });
      }
    }
  }, [accountId, drafts, fetchReports, t]);

  useEffect(() => {
    const first = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(first);
  }, [refresh]);

  const rows = buildRows(reports, local);
  const waiting = rows.filter((r) => r.kind === "pending");
  const unfinished = rows.filter((r) => r.kind === "draft");
  const sent = rows.filter((r) => r.kind === "report");
  const date = (iso: string) =>
    new Intl.DateTimeFormat(language === "ur" ? "ur-PK" : "en-GB", { dateStyle: "medium" }).format(
      new Date(iso),
    );
  const categoryOf = (key: string | null) => (key ? t(`category.${key}`, { defaultValue: key }) : "—");

  return (
    <Screen testID="CIT-14">
      <Title>{t("myReports.title")}</Title>
      <Body>{t("myReports.intro")}</Body>

      {load.name === "loading" && rows.length === 0 ? <Body>{t("myReports.loading")}</Body> : null}
      {load.name === "offline" ? (
        <Notice kind="info">
          {t(load.remembered || rows.length > 0 ? "myReports.offline" : "myReports.offlineNothing")}
        </Notice>
      ) : null}
      {load.name === "failed" ? <Notice>{t("myReports.failed")}</Notice> : null}

      {waiting.length > 0 ? (
        <Section title={t("myReports.waitingHeading")}>
          {waiting.map((row) => (
            <RowView
              key={row.id}
              row={row}
              icon="⏳"
              status={rowStatus(row, t)}
              meaning={row.kind === "pending" && row.cancelling ? undefined : t("myReports.waitingMeaning")}
              reference={t("myReports.noReference")}
              category={t("myReports.category", { category: categoryOf(row.category) })}
              date={t("myReports.date", { date: date(row.at) })}
              action={t("myReports.open")}
              onPress={() => onOpenWaiting(row.id)}
              textStyle={text}
            />
          ))}
        </Section>
      ) : null}

      {unfinished.length > 0 ? (
        <Section title={t("myReports.draftHeading")}>
          {unfinished.map((row) => (
            <RowView
              key={row.id}
              row={row}
              icon="✏️"
              status={t("myReports.draft")}
              meaning={t("myReports.draftMeaning")}
              reference={t("myReports.noReference")}
              category={t("myReports.category", { category: categoryOf(row.category) })}
              date={t("myReports.date", { date: date(row.at) })}
              action={t("myReports.continue")}
              onPress={() => onContinueDraft(row.id)}
              textStyle={text}
            />
          ))}
        </Section>
      ) : null}

      {sent.length > 0 ? (
        <Section title={t("myReports.reportsHeading")}>
          {sent.map((row) =>
            row.kind === "report" ? (
              <RowView
                key={row.id}
                row={row}
                icon={row.icon}
                status={t(`myReports.status.${row.label}`)}
                reference={t("myReports.reference", { reference: row.reference })}
                category={t("myReports.category", { category: categoryOf(row.category) })}
                date={t("myReports.date", { date: date(row.at) })}
                textStyle={text}
              />
            ) : null,
          )}
        </Section>
      ) : null}

      {rows.length === 0 && load.name === "live" ? <Body>{t("myReports.empty")}</Body> : null}

      <LinkButton label={t("myReports.refresh")} onPress={() => void refresh()} />
      <PrimaryButton label={t("myReports.back")} onPress={onHome} />
    </Screen>
  );
}

function rowStatus(row: Row, t: (key: string) => string): string {
  if (row.kind !== "pending") return t("myReports.waiting");
  if (row.cancelling) return t("myReports.cancelling");
  return row.needsReporter ? t("myReports.notSentTryAgain") : t("myReports.waiting");
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={styles.heading}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function RowView(props: {
  row: Row;
  icon: string;
  status: string;
  meaning?: string;
  reference: string;
  category: string;
  date: string;
  action?: string;
  onPress?: () => void;
  textStyle: object;
}) {
  const label = [props.status, props.reference, props.category, props.date, props.meaning]
    .filter(Boolean)
    .join(". ");
  const body = (
    <>
      <Text style={styles.icon} accessibilityElementsHidden importantForAccessibility="no">
        {props.icon}
      </Text>
      <View style={styles.rowText}>
        <Text style={[styles.status, props.textStyle]}>{props.status}</Text>
        <Text style={[styles.line, props.textStyle, styles.reference]}>{props.reference}</Text>
        <Text style={[styles.line, props.textStyle]}>{props.category}</Text>
        <Text style={[styles.line, props.textStyle]}>{props.date}</Text>
        {props.meaning ? <Text style={[styles.line, props.textStyle]}>{props.meaning}</Text> : null}
        {props.action ? <Text style={styles.action}>{props.action}</Text> : null}
      </View>
    </>
  );
  return props.onPress ? (
    <Pressable
      testID={`row-${props.row.kind}`}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${props.action ?? ""}`}
      onPress={props.onPress}
      style={styles.row}
    >
      {body}
    </Pressable>
  ) : (
    <View testID={`row-${props.row.kind}`} accessible accessibilityLabel={label} style={styles.row}>
      {body}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8, marginTop: 8 },
  heading: { fontSize: 19, fontWeight: "700", color: "#0b5d3b" },
  row: {
    flexDirection: "row",
    gap: 12,
    borderWidth: 1,
    borderColor: "#c8c8c8",
    borderRadius: 12,
    padding: 12,
    minHeight: 64,
  },
  icon: { fontSize: 28 },
  rowText: { flex: 1, gap: 2 },
  status: { fontSize: 18, fontWeight: "700", color: "#1b1b1b" },
  line: { fontSize: 16, color: "#1b1b1b" },
  reference: { fontWeight: "600" },
  action: { fontSize: 16, color: "#0b5d3b", textDecorationLine: "underline", marginTop: 4 },
});
