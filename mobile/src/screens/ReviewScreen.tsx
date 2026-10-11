/**
 * CIT-11 — check the report, confirm its texts, then Submit (T-062; FR-PUB.14–FR-PUB.22,
 * FR-PUB.26, FR-PUB.27; DG-62, DG-65).
 *
 * - Every stage is named and announced, never a bare spinner (FR-PUB.15): waiting for
 *   connection, uploading, processing, check the text, a question about one detail,
 *   corrected, out of date, ready to send, something went wrong.
 * - The texts come from the server only (FR-PUB.14). Each AI-produced text carries an
 *   AI-generated marker, seen and heard, until confirmed (FR-PUB.17); the transcription is
 *   never called the reporter's exact words. A development build says the AI is simulated.
 * - A low-confidence field is marked and asked about, with the recording replayable, and is
 *   never guessed (FR-PUB.18). A correction is a new version, checked again (FR-PUB.19).
 * - Failure keeps everything and invents nothing; retry or record again (FR-PUB.20).
 * - "These texts are correct" confirms the exact version shown (FR-PUB.21); a version that
 *   changed is fetched again and shown as out of date, never confirmed blindly (FR-PUB.22).
 * - The whole summary is shown and can be read aloud by the screen reader (FR-PUB.26).
 * - Nothing is submitted until Submit is pressed (DG-65). A reference exists only once the
 *   server has created the report (FR-PUB.27); otherwise the report waits to send (CIT-12).
 */
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import { AccessibilityInfo, Image, StyleSheet, Text, TextInput, View } from "react-native";

import type { Rendering, TextKey } from "../api/reporting";
import { descriptionOf, type Missing } from "../domain/report";
import { accuracyText, isAdjusted, locationUnverified } from "../domain/location";
import { useDirection } from "../i18n";
import {
  checkRendering,
  confirmReviewed,
  correctTexts,
  newConfirmationKey,
  PIPELINE_API,
  type PipelineApi,
  type Preparation,
  prepareForReview,
  submitConfirmed,
} from "../services/reportPipeline";
import type { SubmissionQueue } from "../services/submissionQueue";
import { type DraftRepository, type DraftRow, type EvidenceRow, locationOf } from "../storage/drafts";
import { draftMediaFile } from "../storage/media";
import { Body, LinkButton, Notice, PrimaryButton, Screen, Title } from "../ui";

export type ReportPart = "category" | "evidence" | "description" | "location";
const PART_OF: Record<Missing, ReportPart> = {
  category: "category",
  photo: "evidence",
  description: "description",
  location: "location",
};
const TEXT_KEYS: TextKey[] = ["transcription", "ur", "en"];

type Props = {
  drafts: DraftRepository;
  draftId: string;
  queue: Pick<SubmissionQueue, "requestSubmission">;
  /** Opens one part of the report to change it; this screen prepares again on return. */
  onEdit: (part: ReportPart) => void;
  /** The server created the report: CIT-13. */
  onReceived: (reportReference: string) => void;
  /** Submit was pressed and the report waits to send: CIT-12. */
  onQueued: () => void;
  api?: PipelineApi;
  /** How often processing is checked, and a lost connection retried; tests shorten them. */
  pollMs?: number;
  retryMs?: number;
};

type Phase =
  | { name: "loading" }
  | { name: "missing"; missing: Missing[] }
  | { name: "waiting" }
  | { name: "uploading"; percent: number | null }
  | { name: "processing" }
  | { name: "review"; rendering: Rendering; note: "corrected" | "outdated" | null }
  | { name: "ready"; rendering: Rendering }
  | { name: "held" }
  | { name: "failed" }
  | { name: "problem"; message: string };

type Summary = { draft: DraftRow; evidence: EvidenceRow[] };

const texts = (r: Rendering): Record<TextKey, string | null> => ({
  transcription: r.transcription,
  ur: r.urdu_civic_rendering,
  en: r.english_rendering,
});

export function ReviewScreen({
  drafts,
  draftId,
  queue,
  onEdit,
  onReceived,
  onQueued,
  api = PIPELINE_API,
  pollMs = 2000,
  retryMs = 10000,
}: Props) {
  const { t } = useTranslation();
  const [phase, setPhase] = useState<Phase>({ name: "loading" });
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ key: TextKey; value: string } | null>(null);
  const alive = useRef(true);
  const confirmationKey = useRef<{ version: number; key: string } | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const loadSummary = useCallback(async () => {
    const draft = await drafts.get(draftId);
    const evidence = draft ? (await drafts.evidence(draftId)).filter((e) => e.source_uri === null) : [];
    if (alive.current) setSummary(draft ? { draft, evidence } : null);
    return draft;
  }, [drafts, draftId]);

  const apply = useCallback(
    (result: Preparation, note: "corrected" | "outdated" | null = null) => {
      if (!alive.current) return;
      switch (result.kind) {
        case "missing":
          return setPhase({ name: "missing", missing: result.missing });
        case "offline":
          return setPhase({ name: "waiting" });
        case "processing":
          return setPhase({ name: "processing" });
        case "review":
          return setPhase({ name: "review", rendering: result.rendering, note });
        case "held":
          return setPhase({ name: "held" });
        case "failed":
          return setPhase({ name: "failed" });
        case "upload_problem": {
          const upload = result.upload;
          const local = ["evidence_missing", "evidence_changed", "integrity_failed"].includes(upload.kind);
          const code = upload.kind === "refused" ? upload.code : upload.kind;
          return setPhase({
            name: "problem",
            message: local ? t("review.problem.evidence") : t("review.problem.refused", { code }),
          });
        }
        case "refused":
          if (result.code === "E_DRAFT_NOT_EDITABLE") return onQueued(); // Submit was already pressed
          return setPhase({
            name: "problem",
            message:
              result.code === "E_NOT_FOUND"
                ? t("review.problem.gone")
                : t("review.problem.refused", { code: result.field ?? result.code }),
          });
      }
    },
    [onQueued, t],
  );

  const prepare = useCallback(async () => {
    setMessage(null);
    setPhase({ name: "uploading", percent: null });
    let result: Preparation;
    try {
      result = await prepareForReview(drafts, draftId, api, (p) => {
        if (alive.current && p.totalBytes > 0) {
          setPhase({ name: "uploading", percent: Math.floor((100 * p.sentBytes) / p.totalBytes) });
        }
      });
    } catch {
      if (alive.current) setPhase({ name: "problem", message: t("common.generic") });
      return;
    }
    await loadSummary();
    apply(result);
  }, [api, apply, drafts, draftId, loadSummary, t]);

  useEffect(() => {
    void loadSummary().then((draft) => {
      if (draft) void prepare();
      else if (alive.current) setPhase({ name: "problem", message: t("review.problem.gone") });
    });
    // Once, when the screen opens; the route opens it again after a change (onEdit).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Processing is checked until the texts arrive; a lost connection is tried again by itself.
  useEffect(() => {
    if (phase.name === "processing") {
      const timer = setTimeout(() => void checkRendering(draftId, api).then((r) => apply(r)), pollMs);
      return () => clearTimeout(timer);
    }
    if (phase.name === "waiting") {
      const timer = setTimeout(() => void prepare(), retryMs);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [phase, api, apply, draftId, pollMs, prepare, retryMs]);

  const typed = summary ? descriptionOf(summary.draft, summary.evidence) === "typed" : false;
  const state = stateName(phase, typed, t);
  useEffect(() => {
    if (state) AccessibilityInfo.announceForAccessibility(state);
  }, [state]);

  const refetch = async (note: "outdated" | "corrected") => {
    const result = await checkRendering(draftId, api);
    apply(result, result.kind === "review" ? note : null);
  };

  const correct = async (
    rendering: Rendering,
    change: { texts?: Partial<Record<TextKey, string>>; checkedFields?: string[] },
  ) => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await correctTexts(drafts, draftId, rendering, change, api);
      if (!alive.current) return;
      if (result.kind === "corrected") {
        setEditing(null);
        apply(
          result.rendering.processing_status === "COMPLETED"
            ? { kind: "review", rendering: result.rendering }
            : { kind: "processing" },
          "corrected",
        );
      } else if (result.kind === "changed") {
        setEditing(null);
        await refetch("outdated");
      } else if (result.kind === "offline") {
        setMessage(t("review.offlineAction"));
      } else {
        setMessage(t("review.problem.refused", { code: result.field ?? result.code }));
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  const confirm = async (rendering: Rendering) => {
    setBusy(true);
    setMessage(null);
    // One key per version: a retry of the same confirmation is the same request.
    if (confirmationKey.current?.version !== rendering.rendering_version) {
      confirmationKey.current = { version: rendering.rendering_version, key: newConfirmationKey() };
    }
    try {
      const result = await confirmReviewed(drafts, draftId, rendering, confirmationKey.current.key, api);
      if (!alive.current) return;
      if (result.kind === "confirmed") {
        setPhase({ name: "ready", rendering });
        AccessibilityInfo.announceForAccessibility(t("review.confirmed"));
      } else if (result.kind === "changed") {
        await refetch("outdated");
      } else if (result.kind === "offline") {
        setMessage(t("review.offlineAction"));
      } else {
        setMessage(t("review.problem.refused", { code: result.code }));
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const result = await submitConfirmed(drafts, draftId, queue);
      if (!alive.current) return;
      switch (result.kind) {
        case "submitted":
        case "already_submitted":
          return onReceived(result.reportReference);
        case "retrying":
        case "needs_action":
        case "cancel_pending":
          return onQueued();
        case "refused":
          if (result.reason === "not_ready") {
            setMessage(t("review.notReady"));
            return await refetch("outdated");
          }
          return setMessage(t("common.generic"));
        default:
          return setMessage(t("common.generic"));
      }
    } finally {
      if (alive.current) setBusy(false);
    }
  };

  const voice = summary?.evidence.find((e) => e.kind === "voice_original") ?? null;

  return (
    <Screen testID="CIT-11">
      <Title>{t("review.title")}</Title>
      {state ? (
        <Text accessibilityRole="header" style={styles.state} testID="review-state">
          {state}
        </Text>
      ) : null}

      {phase.name === "missing" ? (
        <View style={styles.block}>
          <Body>{t("review.missingBody")}</Body>
          {phase.missing.map((part) => (
            <PrimaryButton
              key={part}
              label={t("review.add", { part: t(`review.missing.${part}`) })}
              onPress={() => onEdit(PART_OF[part])}
            />
          ))}
        </View>
      ) : null}

      {phase.name === "waiting" ? (
        <View style={styles.block}>
          <Body>{t("review.waitingBody")}</Body>
          <PrimaryButton label={t("review.tryAgain")} onPress={() => void prepare()} />
        </View>
      ) : null}

      {phase.name === "processing" ? <Body>{t("review.processingBody")}</Body> : null}

      {phase.name === "held" || phase.name === "failed" ? (
        <View style={styles.block}>
          <Body>{t(phase.name === "held" ? "review.heldBody" : "review.failedBody")}</Body>
          <PrimaryButton label={t("review.tryAgain")} onPress={() => void prepare()} />
          <LinkButton
            label={t(typed ? "review.editTyped" : "review.reRecord")}
            onPress={() => onEdit("description")}
          />
        </View>
      ) : null}

      {phase.name === "problem" ? (
        <View style={styles.block}>
          <Notice>{phase.message}</Notice>
          <PrimaryButton label={t("review.tryAgain")} onPress={() => void prepare()} />
        </View>
      ) : null}

      {phase.name === "review" || phase.name === "ready" ? (
        <RenderingView
          rendering={phase.rendering}
          note={phase.name === "review" ? phase.note : null}
          confirmed={phase.name === "ready"}
          typed={typed}
          voice={voice}
          busy={busy}
          editing={editing}
          onEditing={setEditing}
          onCorrect={(change) => void correct(phase.rendering, change)}
          onRecordAgain={() => onEdit("description")}
        />
      ) : null}

      {summary && (phase.name === "review" || phase.name === "ready") ? (
        <ReportSummary summary={summary} rendering={phase.rendering} onEdit={busy ? undefined : onEdit} />
      ) : null}

      {message ? <Notice>{message}</Notice> : null}

      {phase.name === "review" ? (
        <PrimaryButton
          label={t("review.confirm")}
          busy={busy}
          disabled={editing !== null}
          onPress={() => void confirm(phase.rendering)}
        />
      ) : null}

      {phase.name === "ready" ? (
        <View style={styles.block}>
          <Notice kind="info">{t("review.confirmed")}</Notice>
          <Body>{t("review.submitIntro")}</Body>
          <PrimaryButton label={t("review.submit")} busy={busy} onPress={() => void submit()} />
        </View>
      ) : null}
    </Screen>
  );
}

function stateName(phase: Phase, typed: boolean, t: TFunction): string | null {
  switch (phase.name) {
    case "waiting":
      return t("review.state.waiting");
    case "uploading":
      return phase.percent === null
        ? t("review.state.uploading")
        : t("review.state.uploadingPercent", { percent: phase.percent });
    case "processing":
      return t(typed ? "review.state.processingTyped" : "review.state.processing");
    case "review":
      if (phase.note === "corrected") return t("review.state.corrected");
      if (phase.note === "outdated") return t("review.state.outdated");
      return phase.rendering.fields?.some((f) => f.low_confidence)
        ? t("review.state.question")
        : t("review.state.check");
    case "ready":
      return t("review.state.ready");
    case "held":
      return t("review.state.held");
    case "failed":
    case "problem":
      return t("review.state.failed");
    default:
      return null;
  }
}

/** The three texts, their markers, the version, and the targeted questions. */
function RenderingView(props: {
  rendering: Rendering;
  note: "corrected" | "outdated" | null;
  confirmed: boolean;
  typed: boolean;
  voice: EvidenceRow | null;
  busy: boolean;
  editing: { key: TextKey; value: string } | null;
  onEditing: (editing: { key: TextKey; value: string } | null) => void;
  onCorrect: (change: { texts?: Partial<Record<TextKey, string>>; checkedFields?: string[] }) => void;
  onRecordAgain: () => void;
}) {
  const { t } = useTranslation();
  const { text } = useDirection();
  const { rendering, editing } = props;
  const values = texts(rendering);
  const questions = (rendering.fields ?? []).filter((f) => f.low_confidence);
  const previous = rendering.supersedes_rendering_version;

  return (
    <View style={styles.block}>
      {props.note ? (
        <Notice kind="info">
          {t(props.note === "corrected" ? "review.correctedBody" : "review.outdatedBody")}
        </Notice>
      ) : null}
      {rendering.simulated ? <Notice kind="info">{t("review.simulated")}</Notice> : null}
      <Text style={[styles.meta, text]} testID="review-version">
        {previous
          ? t("review.versionReplaces", { version: rendering.rendering_version, previous })
          : t("review.version", { version: rendering.rendering_version })}
      </Text>

      {questions.length > 0 && !props.confirmed ? (
        <View style={styles.question} testID="review-question">
          <Body>{t("review.questionIntro")}</Body>
          {questions.map((field) => (
            <View key={field.key} style={styles.block}>
              <Text style={[styles.marked, text]}>
                {t("review.questionAsk", {
                  field: t(`review.field.${field.key}`, { defaultValue: field.key }),
                  value: field.value,
                })}
              </Text>
              {props.voice ? <PlayButton evidence={props.voice} /> : null}
              <PrimaryButton
                label={t("review.yesRight")}
                busy={props.busy}
                onPress={() => props.onCorrect({ checkedFields: [field.key] })}
              />
              <LinkButton
                label={t("review.noCorrect")}
                disabled={props.busy}
                onPress={() =>
                  props.onEditing({
                    key: props.typed ? "ur" : "transcription",
                    value: values[props.typed ? "ur" : "transcription"] ?? "",
                  })
                }
              />
            </View>
          ))}
        </View>
      ) : null}

      {TEXT_KEYS.map((key) => {
        const ai = rendering.ai_generated_texts?.[key] !== false;
        const label = t(
          key === "transcription"
            ? props.typed
              ? "review.transcriptionTyped"
              : "review.transcription"
            : `review.${key}`,
        );
        const marker = ai ? t("review.aiGenerated") : t("review.yours");
        const value = values[key] ?? "";
        const isEditing = editing?.key === key;
        // A typed report's transcription is the typed text itself: it is changed on CIT-09.
        const correctable = !props.confirmed && !(props.typed && key === "transcription");
        return (
          <View key={key} style={styles.textBlock} testID={`review-text-${key}`}>
            <Text style={[styles.label, text]}>{label}</Text>
            <Text style={[ai ? styles.aiMarker : styles.ownMarker, text]} testID={`review-marker-${key}`}>
              {marker}
            </Text>
            {isEditing ? (
              <View style={styles.block}>
                <TextInput
                  accessibilityLabel={t("review.correctLabel", { text: label })}
                  multiline
                  value={editing.value}
                  onChangeText={(v) => props.onEditing({ key, value: v })}
                  style={[styles.input, key === "en" ? styles.ltr : text]}
                  testID={`review-input-${key}`}
                />
                {editing.value.trim() === "" ? <Notice>{t("review.emptyCorrection")}</Notice> : null}
                <PrimaryButton
                  label={t("review.saveCorrection")}
                  busy={props.busy}
                  disabled={editing.value.trim() === ""}
                  onPress={() => props.onCorrect({ texts: { [key]: editing.value } })}
                />
                <LinkButton label={t("review.cancelCorrection")} onPress={() => props.onEditing(null)} />
              </View>
            ) : (
              <Text
                selectable
                accessibilityLabel={`${marker}. ${label}: ${value}`}
                style={[styles.value, key === "en" ? styles.ltr : text]}
              >
                {value}
              </Text>
            )}
            {correctable && !isEditing ? (
              <LinkButton
                label={t("review.correct")}
                disabled={props.busy || editing !== null}
                onPress={() => props.onEditing({ key, value })}
              />
            ) : null}
          </View>
        );
      })}

      {props.voice ? (
        <View style={styles.row}>
          <PlayButton evidence={props.voice} />
          {!props.confirmed ? (
            <LinkButton label={t("review.reRecord")} onPress={props.onRecordAgain} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Plays one recording kept with the draft: the original as recorded, never a copy (FR-PUB.10). */
function PlayButton({ evidence }: { evidence: EvidenceRow }) {
  const { t } = useTranslation();
  const source = useMemo(() => ({ uri: draftMediaFile(evidence.file_name).uri }), [evidence.file_name]);
  const player = useAudioPlayer(source);
  const status = useAudioPlayerStatus(player);
  const playing = status?.playing ?? false;
  return (
    <LinkButton
      label={t(playing ? "review.pause" : "review.playOriginal")}
      onPress={() => {
        if (playing) return player.pause();
        if (status?.didJustFinish || (status?.duration && status.currentTime >= status.duration)) {
          void player.seekTo(0);
        }
        player.play();
      }}
    />
  );
}

/** Category, photos and video, and the location, each with a way to change it; read aloud on request. */
function ReportSummary(props: {
  summary: Summary;
  rendering: Rendering;
  onEdit?: (part: ReportPart) => void;
}) {
  const { t } = useTranslation();
  const { text } = useDirection();
  const { draft, evidence } = props.summary;
  const photos = evidence.filter((e) => e.kind === "photo");
  const video = evidence.find((e) => e.kind === "video");
  const locationVoice = evidence.find((e) => e.kind === "location_voice") ?? null;
  const category = draft.category ? t(`category.${draft.category}`) : "";
  const location = locationLines(draft, t);

  const readAloud = () => {
    const values = texts(props.rendering);
    const marker = (key: TextKey) =>
      props.rendering.ai_generated_texts?.[key] !== false ? t("review.aiGenerated") : t("review.yours");
    const parts = [
      `${t("review.category")}: ${category}`,
      ...TEXT_KEYS.map(
        (key) =>
          `${marker(key)}. ${t(key === "transcription" ? "review.transcription" : `review.${key}`)}: ${values[key] ?? ""}`,
      ),
      `${t("review.photos")}: ${photos.length}${video ? `, ${t("review.video", { seconds: Math.round(video.duration_seconds ?? 0) })}` : ""}`,
      `${t("review.location")}: ${location.join(". ")}`,
      t("review.version", { version: props.rendering.rendering_version }),
    ];
    AccessibilityInfo.announceForAccessibility(parts.join(". "));
  };

  const change = (part: ReportPart, name: string) =>
    props.onEdit ? (
      <LinkButton label={t("review.changeLabel", { part: name })} onPress={() => props.onEdit?.(part)} />
    ) : null;

  return (
    <View style={styles.block} testID="review-summary">
      <View style={styles.textBlock}>
        <Text style={[styles.label, text]}>{t("review.category")}</Text>
        <Text style={[styles.value, text]}>{category}</Text>
        {change("category", t("review.category"))}
      </View>
      <View style={styles.textBlock}>
        <Text style={[styles.label, text]}>{t("review.photos")}</Text>
        <View style={styles.thumbs}>
          {photos.map((photo, i) => (
            <Image
              key={photo.evidence_id}
              accessibilityLabel={t("review.photoAlt", { n: i + 1 })}
              source={{ uri: draftMediaFile(photo.file_name).uri }}
              style={styles.thumb}
            />
          ))}
        </View>
        {video ? (
          <Text style={[styles.value, text]}>
            {t("review.video", { seconds: Math.round(video.duration_seconds ?? 0) })}
          </Text>
        ) : null}
        {change("evidence", t("review.photos"))}
      </View>
      <View style={styles.textBlock}>
        <Text style={[styles.label, text]}>{t("review.location")}</Text>
        {location.map((line) => (
          <Text key={line} style={[styles.value, text]}>
            {line}
          </Text>
        ))}
        {locationVoice ? <PlayButton evidence={locationVoice} /> : null}
        {change("location", t("review.location"))}
      </View>
      <LinkButton label={t("review.readAloud")} onPress={readAloud} />
    </View>
  );
}

function locationLines(draft: DraftRow, t: TFunction): string[] {
  const location = locationOf(draft);
  if (!location) return [];
  if (location.kind === "description") return [location.description, t("review.locationUnverified")];
  if (location.kind === "spoken") return [t("review.locationSpoken"), t("review.locationUnverified")];
  const lines = [
    t("review.locationCoordinates", {
      latitude: location.reported.latitude.toFixed(6),
      longitude: location.reported.longitude.toFixed(6),
    }),
  ];
  if (location.measured.accuracyM !== null && !isAdjusted(location)) {
    lines.push(t("review.locationAccuracy", { metres: accuracyText(location.measured.accuracyM) }));
  }
  if (locationUnverified(location)) lines.push(t("review.locationUnverified"));
  return lines;
}

const styles = StyleSheet.create({
  block: { gap: 10 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  state: { fontSize: 19, fontWeight: "700", color: "#0b5d3b" },
  meta: { fontSize: 15, color: "#4a4a4a" },
  textBlock: { gap: 6, borderTopWidth: 1, borderTopColor: "#c8c8c8", paddingTop: 10 },
  label: { fontSize: 16, fontWeight: "700", color: "#1b1b1b" },
  value: { fontSize: 17, lineHeight: 26, color: "#1b1b1b" },
  ltr: { writingDirection: "ltr", textAlign: "left" },
  aiMarker: {
    alignSelf: "flex-start",
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
    backgroundColor: "#5a3e8c",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  ownMarker: {
    alignSelf: "flex-start",
    fontSize: 14,
    fontWeight: "700",
    color: "#0b5d3b",
    borderColor: "#0b5d3b",
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  question: { gap: 10, borderWidth: 2, borderColor: "#a4161a", borderRadius: 10, padding: 12 },
  marked: { fontSize: 17, fontWeight: "700", color: "#a4161a" },
  input: {
    minHeight: 96,
    borderWidth: 1,
    borderColor: "#1b1b1b",
    borderRadius: 8,
    padding: 10,
    fontSize: 17,
    textAlignVertical: "top",
  },
  thumbs: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  thumb: { width: 96, height: 96, borderRadius: 8, backgroundColor: "#eeeeee" },
});
