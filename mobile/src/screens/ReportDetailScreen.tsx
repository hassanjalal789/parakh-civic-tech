/** CIT-15: an owned report's public projection (FR-PUB.32, API-151).
 * Only explicit API-151 fields are rendered. Media use authenticated, no-store sources;
 * staff notes, officer identity, audit internals and intermediate ASR are never displayed.
 */
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Image, Share, StyleSheet, Text, View } from "react-native";

import { ApiError, OfflineError } from "../api/errors";
import {
  citizenEvidenceSource,
  fetchReportDetail,
  type ReportDetail,
  type ReportEvidence,
} from "../api/reporting";
import { civicStatus } from "../domain/myReports";
import { useDirection } from "../i18n";
import { Body, LinkButton, Notice, PrimaryButton, Screen, Title } from "../ui";

type MediaSource = { uri: string; headers: Record<string, string> };
type Props = {
  reportId: string;
  onBack: () => void;
  fetchDetail?: (id: string) => Promise<ReportDetail>;
  sourceForEvidence?: (reportId: string, evidenceId: string) => Promise<MediaSource>;
  language?: string;
};

type Load =
  | { kind: "loading" }
  | { kind: "ready"; detail: ReportDetail; media: Record<string, MediaSource> }
  | { kind: "not_found" | "offline" | "failed" };

const VISIBLE_KINDS = new Set(["photo", "video", "voice_original", "location_voice"]);

export function ReportDetailScreen({
  reportId,
  onBack,
  fetchDetail = fetchReportDetail,
  sourceForEvidence = citizenEvidenceSource,
  language = "en",
}: Props) {
  const { t } = useTranslation();
  const { text } = useDirection();
  const alive = useRef(true);
  const [load, setLoad] = useState<Load>({ kind: "loading" });
  const [shareFailed, setShareFailed] = useState(false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    setLoad({ kind: "loading" });
    try {
      const detail = await fetchDetail(reportId);
      // Only the server's already-filtered original citizen evidence may become a media source.
      const entries = await Promise.all(
        detail.evidence
          .filter((item) => VISIBLE_KINDS.has(item.kind))
          .map(
            async (item) => [item.evidence_id, await sourceForEvidence(reportId, item.evidence_id)] as const,
          ),
      );
      if (alive.current) setLoad({ kind: "ready", detail, media: Object.fromEntries(entries) });
    } catch (error) {
      if (!alive.current) return;
      setLoad({
        kind:
          error instanceof ApiError && error.code === "E_NOT_FOUND"
            ? "not_found"
            : error instanceof OfflineError
              ? "offline"
              : "failed",
      });
    }
  }, [fetchDetail, reportId, sourceForEvidence]);

  useEffect(() => {
    const first = setTimeout(() => void refresh(), 0);
    return () => clearTimeout(first);
  }, [refresh]);

  const formatDate = (iso: string) =>
    new Intl.DateTimeFormat(language === "ur" ? "ur-PK" : "en-GB", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));

  return (
    <Screen testID="CIT-15">
      <Title>{t("reportDetail.title")}</Title>
      {load.kind === "loading" ? <Body>{t("reportDetail.loading")}</Body> : null}
      {load.kind === "not_found" ? <Notice>{t("reportDetail.notFound")}</Notice> : null}
      {load.kind === "offline" ? <Notice>{t("reportDetail.offline")}</Notice> : null}
      {load.kind === "failed" ? <Notice>{t("reportDetail.failed")}</Notice> : null}

      {load.kind === "ready" ? (
        <>
          <Text style={[styles.reference, text]} selectable>
            {t("myReports.reference", { reference: load.detail.report_reference })}
          </Text>
          <Body>{t("myReports.category", { category: t(`category.${load.detail.category}`) })}</Body>
          <Body>{t("myReports.date", { date: formatDate(load.detail.created_at) })}</Body>
          <Body>
            {civicStatus(load.detail.state).icon}{" "}
            {t(`myReports.status.${civicStatus(load.detail.state).label}`)}
          </Body>
          <LinkButton
            label={t("reportDetail.shareReference")}
            onPress={() => {
              setShareFailed(false);
              void Share.share({ message: load.detail.report_reference }).catch(() => setShareFailed(true));
            }}
          />
          {shareFailed ? <Notice>{t("reportDetail.shareFailed")}</Notice> : null}

          <Section title={t("reportDetail.statement")}>
            <Body>
              {load.detail.description.typed_description ||
                load.detail.description.transcription ||
                t("reportDetail.originalUnavailable")}
            </Body>
          </Section>
          <Section title={t("reportDetail.urduRendering")}>
            <Body>{load.detail.description.urdu_civic_rendering}</Body>
          </Section>
          {load.detail.description.english_rendering ? (
            <Section title={t("reportDetail.englishRendering")}>
              <Body>{load.detail.description.english_rendering}</Body>
            </Section>
          ) : null}

          <Section title={t("reportDetail.location")}>
            <LocationLines location={load.detail.location} />
          </Section>

          <Section title={t("reportDetail.evidence")}>
            {load.detail.evidence.filter((item) => VISIBLE_KINDS.has(item.kind)).length === 0 ? (
              <Body>{t("reportDetail.noEvidence")}</Body>
            ) : (
              load.detail.evidence
                .filter((item) => VISIBLE_KINDS.has(item.kind))
                .map((item) => (
                  <EvidenceItem
                    key={item.evidence_id}
                    evidence={item}
                    source={load.media[item.evidence_id]}
                  />
                ))
            )}
          </Section>

          <Section title={t("reportDetail.timeline")}>
            {load.detail.timeline.map((event, index) => {
              const status = civicStatus(event.state);
              return (
                <View key={`${event.occurred_at}-${index}`} style={styles.event}>
                  <Body>
                    {status.icon} {t(`myReports.status.${status.label}`)}
                  </Body>
                  <Body>{formatDate(event.occurred_at)}</Body>
                </View>
              );
            })}
          </Section>
        </>
      ) : null}

      {load.kind !== "loading" ? (
        <LinkButton label={t("reportDetail.refresh")} onPress={() => void refresh()} />
      ) : null}
      <PrimaryButton label={t("reportDetail.back")} onPress={onBack} />
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { text } = useDirection();
  return (
    <View style={styles.section}>
      <Text accessibilityRole="header" style={[styles.heading, text]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function LocationLines({ location }: { location: ReportDetail["location"] }) {
  const { t } = useTranslation();
  if (location.reported) {
    const selected = `${location.reported.latitude.toFixed(6)}, ${location.reported.longitude.toFixed(6)}`;
    const measured = location.measured
      ? `${location.measured.latitude.toFixed(6)}, ${location.measured.longitude.toFixed(6)}`
      : null;
    return (
      <>
        <Body>{t("reportDetail.reportedPosition", { coordinates: selected })}</Body>
        {measured ? <Body>{t("reportDetail.measuredPosition", { coordinates: measured })}</Body> : null}
        {location.unverified ? <Notice kind="info">{t("reportDetail.locationUnverified")}</Notice> : null}
      </>
    );
  }
  if (location.description) return <Body>{location.description}</Body>;
  if (location.spoken_description) return <Body>{t("reportDetail.spokenLocation")}</Body>;
  return <Body>{t("reportDetail.locationUnavailable")}</Body>;
}

function EvidenceItem({ evidence, source }: { evidence: ReportEvidence; source?: MediaSource }) {
  const { t } = useTranslation();
  const { text } = useDirection();
  if (!source) return <Notice>{t("reportDetail.mediaUnavailable")}</Notice>;
  return (
    <View style={styles.mediaCard}>
      <Text style={[styles.mediaLabel, text]}>{t(`reportDetail.kind.${evidence.kind}`)}</Text>
      {evidence.kind === "photo" ? (
        <Image
          source={source}
          resizeMode="contain"
          style={styles.media}
          accessibilityLabel={t("reportDetail.kind.photo")}
        />
      ) : null}
      {evidence.kind === "video" ? <ReportVideo source={source} /> : null}
      {evidence.kind === "voice_original" || evidence.kind === "location_voice" ? (
        <ReportAudio source={source} />
      ) : null}
    </View>
  );
}

function ReportAudio({ source }: { source: MediaSource }) {
  const { t } = useTranslation();
  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);
  return (
    <LinkButton
      label={t(status?.playing ? "reportDetail.pause" : "reportDetail.play")}
      onPress={() => {
        if (status?.playing) return player.pause();
        if (status?.didJustFinish || (status?.duration && status.currentTime >= status.duration)) {
          void player.seekTo(0);
        }
        player.play();
      }}
    />
  );
}

function ReportVideo({ source }: { source: MediaSource }) {
  const player = useVideoPlayer({ ...source, useCaching: false });
  return <VideoView player={player} nativeControls style={styles.media} />;
}

const styles = StyleSheet.create({
  reference: { fontSize: 21, fontWeight: "700", color: "#1b1b1b" },
  section: { gap: 8, marginTop: 18 },
  heading: { fontSize: 19, fontWeight: "700", color: "#0b5d3b" },
  event: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#c8c8c8" },
  mediaCard: { gap: 8, padding: 8, borderWidth: 1, borderColor: "#c8c8c8", borderRadius: 8 },
  mediaLabel: { fontSize: 17, fontWeight: "600", color: "#1b1b1b" },
  media: { width: "100%", height: 240, backgroundColor: "#111" },
});
