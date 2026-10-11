/**
 * CIT-09 — speak or type the report text (FR-PUB.9–FR-PUB.13, FR-COMMON.14,
 * FR-COMMON.16; DG-61, DG-62; UC-CIT-018–UC-CIT-021).
 *
 * - Speaking and typing are two equal ways; neither is a fallback and neither is
 *   required (FR-PUB.9). A draft holds one of them: a recording, or typed text
 *   (the server accepts one description modality per draft).
 * - The recorder's own file is the recording: ingestCapture hashes it and moves it
 *   into the draft; it is never re-encoded, trimmed or replaced after capture
 *   (FR-PUB.10). Play, pause, delete and re-record before submission (FR-PUB.11).
 * - Typed text is kept exactly as written (FR-PUB.12); its Urdu and English
 *   versions are produced on the server and confirmed later (DG-62).
 * - No spoken-language selector, and "Roman Urdu" is never offered (FR-PUB.13).
 * - The microphone is explained before Android asks; refused, typing stays
 *   available and the way to grant it is kept (FR-PUB.12, FR-COMMON.16).
 * - Switching between speaking and typing never discards a recording or text
 *   silently: the citizen confirms first (FR-COMMON.14).
 */
import {
  getRecordingPermissionsAsync,
  type PermissionResponse,
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import { Paths } from "expo-file-system";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AccessibilityInfo,
  AppState,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { MAX_RECORDING_SECONDS, MAX_TYPED_CHARACTERS, RECORDING_SETTINGS } from "../domain/recordingSettings";
import { useDirection } from "../i18n";
import { ingestCapture } from "../storage/capture";
import { type DraftRepository, EvidenceRefused, type EvidenceRow } from "../storage/drafts";
import { deleteDraftMedia, draftMediaFile } from "../storage/media";
import { withMediaLock } from "../storage/mediaLock";
import { Body, LinkButton, Notice, PrimaryButton, Screen, Title } from "../ui";

/** AAC in MPEG-4, one channel, 64 kbit/s (DG-74, proposed); the rest as expo-audio's high-quality preset. */
const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  extension: RECORDING_SETTINGS.extension,
  sampleRate: RECORDING_SETTINGS.sampleRate,
  numberOfChannels: RECORDING_SETTINGS.channels,
  bitRate: RECORDING_SETTINGS.bitRate,
};

type Props = {
  drafts: DraftRepository;
  draftId: string;
  onContinue: () => void;
  /** The capture time source; tests move it. */
  clock?: () => Date;
};

type Mode = "voice" | "typed";
type DraftState = "loading" | "editable" | "gone" | "sent";
type Loaded = { state: DraftState; mode: Mode | null; recording: EvidenceRow | null; typed: string };

async function load(drafts: DraftRepository, draftId: string): Promise<Loaded> {
  const draft = await drafts.get(draftId);
  if (!draft) return { state: "gone", mode: null, recording: null, typed: "" };
  const recording =
    (await drafts.evidence(draftId)).find((e) => e.kind === "voice_original" && e.source_uri === null) ??
    null;
  const typed = draft.typed_description ?? "";
  const hasText = typed.trim().length > 0;
  // The stored mode defaults to "voice" for every new draft, so only what the draft holds shows
  // a choice: a new draft opens with neither way selected (FR-PUB.9).
  const mode = recording && hasText ? draft.description_mode : recording ? "voice" : hasText ? "typed" : null;
  return {
    state: draft.pipeline_state === "LOCAL_DRAFT" ? "editable" : "sent",
    mode,
    recording,
    typed,
  };
}

function freeBytes(): number {
  try {
    return Paths.availableDiskSpace;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function clockText(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function DescribeScreen({ drafts, draftId, onContinue, clock = () => new Date() }: Props) {
  const { t } = useTranslation();
  const { text: textDirection } = useDirection();
  // The recorder stops itself at the cap that keeps a recording under the server's limit;
  // its status listener then finishes the recording as a press of Stop would. Android also
  // reports a finish after Stop is pressed; `active` makes the second report a no-op.
  const active = useRef(false);
  const onRecorderFinished = useRef<() => void>(() => undefined);
  const recorder = useAudioRecorder(RECORDING_OPTIONS, (status) => {
    if (status.isFinished && active.current) onRecorderFinished.current();
  });
  const recorderState = useAudioRecorderState(recorder, 500);
  const [draftState, setDraftState] = useState<DraftState>("loading");
  const [mode, setMode] = useState<Mode | null>(null);
  const [recording, setRecording] = useState<EvidenceRow | null>(null);
  const [typed, setTyped] = useState("");
  const [microphone, setMicrophone] = useState<PermissionResponse | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<"toTyped" | "toVoice" | "replace" | null>(null);
  const [message, setMessage] = useState<{ text: string; kind: "error" | "info" } | null>(null);
  const startedAt = useRef<string | null>(null);

  const playerSource = useMemo(
    () => (recording ? { uri: draftMediaFile(recording.file_name).uri } : null),
    [recording],
  );
  const player = useAudioPlayer(playerSource);
  const playback = useAudioPlayerStatus(player);

  const apply = useCallback((loaded: Loaded) => {
    setDraftState(loaded.state);
    setMode(loaded.mode);
    setRecording(loaded.recording);
    setTyped(loaded.typed);
  }, []);

  useEffect(() => {
    let live = true;
    void load(drafts, draftId).then((loaded) => {
      if (live) apply(loaded);
    });
    return () => {
      live = false;
    };
  }, [apply, drafts, draftId]);

  // The microphone's state now, and again whenever the citizen returns from Settings (finding F-3).
  useEffect(() => {
    const read = () => void getRecordingPermissionsAsync().then(setMicrophone, () => undefined);
    read();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") read();
    });
    return () => subscription.remove();
  }, []);

  const show = (text: string, kind: "error" | "info" = "error") => {
    setMessage({ text, kind });
    if (kind === "info") AccessibilityInfo.announceForAccessibility(text);
  };

  const saveTyped = useCallback(
    (value: string) => drafts.update(draftId, { description_mode: "typed", typed_description: value }),
    [drafts, draftId],
  );

  // Typed text is saved as it is written, so closing the app loses nothing; exactly as typed (FR-PUB.12).
  useEffect(() => {
    if (mode !== "typed" || draftState !== "editable") return;
    const timer = setTimeout(() => void saveTyped(typed), 400);
    return () => clearTimeout(timer);
  }, [typed, mode, draftState, saveTyped]);

  const removeRecording = async (row: EvidenceRow) => {
    const removed = await drafts.removeEvidence(draftId, row.evidence_id);
    if (removed) await withMediaLock(async () => deleteDraftMedia(removed.file_name));
    setRecording(null);
  };

  const finishRecording = useCallback(async () => {
    if (!active.current) return;
    active.current = false;
    try {
      await recorder.stop();
      setIsRecording(false);
      const uri = recorder.uri;
      if (!uri || !startedAt.current) {
        show(t("describe.saveFailed"));
        return;
      }
      const row = await ingestCapture(drafts, draftId, {
        uri,
        kind: "voice_original",
        mimeType: RECORDING_SETTINGS.mimeType,
        capturedAt: startedAt.current, // FR-PUB.25: the moment the recording began
      });
      await drafts.update(draftId, { description_mode: "voice", typed_description: null });
      setRecording(row);
      show(t("describe.saved", { seconds: Math.round(row.duration_seconds ?? 0) }), "info");
    } catch (error) {
      setIsRecording(false);
      show(
        error instanceof EvidenceRefused && error.reason === "unreadable_recording"
          ? t("describe.unreadable")
          : t("describe.saveFailed"),
      );
    } finally {
      setBusy(false);
    }
    // show and t are stable for the screen's purpose; the recorder and the draft are the inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorder, drafts, draftId]);

  useEffect(() => {
    onRecorderFinished.current = () => void finishRecording();
  }, [finishRecording]);

  const startRecording = async () => {
    if (busy) return;
    if (freeBytes() < RECORDING_SETTINGS.minFreeBytes) return show(t("describe.storageFull"));
    setBusy(true);
    setMessage(null);
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      startedAt.current = clock().toISOString();
      recorder.record({ forDuration: MAX_RECORDING_SECONDS });
      active.current = true;
      setIsRecording(true);
    } catch {
      setBusy(false);
      show(t("describe.saveFailed"));
    }
  };

  const choose = (next: Mode) => {
    if (next === mode || isRecording) return;
    setMessage(null);
    if (next === "typed" && recording) return setConfirm("toTyped");
    if (next === "voice" && typed.trim()) return setConfirm("toVoice");
    // Nothing is stored for a choice alone: typed text is saved as it is written, and a
    // recording, when it is kept, records the voice mode with it.
    setMode(next);
  };

  const confirmSwitch = async () => {
    if (confirm === "toTyped" && recording) {
      await removeRecording(recording);
      setMode("typed");
      await drafts.update(draftId, { description_mode: "typed", typed_description: typed });
    } else if (confirm === "toVoice") {
      setTyped("");
      setMode("voice");
      await drafts.update(draftId, { description_mode: "voice", typed_description: null });
    } else if (confirm === "replace" && recording) {
      await removeRecording(recording);
      setConfirm(null);
      await startRecording();
      return;
    }
    setConfirm(null);
    show(t("describe.deleted"), "info");
  };

  const deleteRecording = async () => {
    if (!recording) return;
    player.pause();
    await removeRecording(recording);
    show(t("describe.deleted"), "info");
  };

  const togglePlayback = () => {
    if (playback.playing) return player.pause();
    if (playback.didJustFinish || (playback.duration > 0 && playback.currentTime >= playback.duration))
      void player.seekTo(0);
    player.play();
  };

  const finish = async () => {
    if (mode === "typed") await saveTyped(typed);
    onContinue();
  };

  if (draftState === "loading") {
    return (
      <Screen testID="CIT-09">
        <Body>{t("evidence.loading")}</Body>
      </Screen>
    );
  }
  if (draftState !== "editable") {
    return (
      <Screen testID="CIT-09">
        <Title>{t("describe.title")}</Title>
        <Notice>{t(draftState === "gone" ? "evidence.draftGone" : "describe.notEditable")}</Notice>
      </Screen>
    );
  }

  const ready =
    mode === "voice" ? !!recording && !isRecording : mode === "typed" ? typed.trim().length > 0 : false;
  const left = MAX_TYPED_CHARACTERS - typed.length;

  return (
    <Screen testID="CIT-09">
      <Title>{t("describe.title")}</Title>
      <Body>{t("describe.intro")}</Body>

      <View style={styles.modes}>
        {(["voice", "typed"] as const).map((m) => (
          <Pressable
            key={m}
            accessibilityRole="button"
            accessibilityLabel={t(m === "voice" ? "describe.speak" : "describe.type")}
            accessibilityState={{ selected: mode === m, disabled: isRecording || busy }}
            disabled={isRecording || busy}
            onPress={() => choose(m)}
            style={[styles.mode, mode === m ? styles.modeSelected : null]}
          >
            <Text style={mode === m ? styles.modeTextSelected : styles.modeText}>
              {t(m === "voice" ? "describe.speak" : "describe.type")}
            </Text>
          </Pressable>
        ))}
      </View>

      {confirm ? (
        <View style={styles.panel}>
          <Notice kind="info">
            {t(
              confirm === "toTyped"
                ? "describe.toTypedWarning"
                : confirm === "toVoice"
                  ? "describe.toVoiceWarning"
                  : "describe.replaceWarning",
            )}
          </Notice>
          <PrimaryButton
            label={t(
              confirm === "toTyped"
                ? "describe.toTypedConfirm"
                : confirm === "toVoice"
                  ? "describe.toVoiceConfirm"
                  : "describe.replaceConfirm",
            )}
            onPress={() => void confirmSwitch()}
          />
          <LinkButton label={t("describe.keep")} onPress={() => setConfirm(null)} />
        </View>
      ) : null}

      {mode === "voice" && !confirm ? (
        !microphone ? null : !microphone.granted ? (
          <View style={styles.panel}>
            <Notice kind="info">
              {t(microphone.status === "undetermined" ? "describe.micWhy" : "describe.micDenied")}
            </Notice>
            {microphone.canAskAgain ? (
              <PrimaryButton
                label={t("describe.allowMicrophone")}
                onPress={() => void requestRecordingPermissionsAsync().then(setMicrophone)}
              />
            ) : (
              <>
                <Notice kind="info">{t("describe.micSettings")}</Notice>
                <PrimaryButton
                  label={t("evidence.openSettings")}
                  onPress={() => void Linking.openSettings()}
                />
              </>
            )}
          </View>
        ) : recording && !isRecording ? (
          <View style={styles.panel}>
            <Body>{t("describe.recordingLabel", { time: clockText(recording.duration_seconds ?? 0) })}</Body>
            <PrimaryButton
              label={t(playback.playing ? "describe.pause" : "describe.play")}
              onPress={togglePlayback}
            />
            <PrimaryButton label={t("describe.reRecord")} onPress={() => setConfirm("replace")} />
            <LinkButton label={t("describe.delete")} onPress={() => void deleteRecording()} />
          </View>
        ) : (
          <View style={styles.panel}>
            {/* The named states Ready to record and Recording (SRS §3.6.2). */}
            {!isRecording ? <Body>{t("describe.ready")}</Body> : null}
            <PrimaryButton
              label={t(isRecording ? "describe.stopRecording" : "describe.startRecording")}
              onPress={() => void (isRecording ? finishRecording() : startRecording())}
              disabled={busy && !isRecording}
            />
            {isRecording ? (
              <Notice kind="info">
                {t("describe.recordingTime", { time: clockText(recorderState.durationMillis / 1000) })}
              </Notice>
            ) : null}
          </View>
        )
      ) : null}

      {mode === "typed" && !confirm ? (
        <View style={styles.panel}>
          <TextInput
            testID="typed-description"
            accessibilityLabel={t("describe.typeLabel")}
            placeholder={t("describe.typeLabel")}
            value={typed}
            onChangeText={setTyped}
            multiline
            maxLength={MAX_TYPED_CHARACTERS}
            style={[styles.input, textDirection]}
          />
          <Body>{t("describe.typedNote")}</Body>
          {left <= 500 ? <Notice kind="info">{t("describe.charactersLeft", { count: left })}</Notice> : null}
        </View>
      ) : null}

      {message ? <Notice kind={message.kind}>{message.text}</Notice> : null}
      <Notice kind="info">{t("describe.connectionNote")}</Notice>
      {!ready ? <Notice kind="info">{t("describe.needText")}</Notice> : null}
      <PrimaryButton label={t("common.continue")} onPress={() => void finish()} disabled={!ready || busy} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  modes: { flexDirection: "row", gap: 8, marginVertical: 12 },
  mode: {
    flex: 1,
    minHeight: 48,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#0b5d3b",
    borderRadius: 8,
  },
  modeSelected: { backgroundColor: "#0b5d3b" },
  modeText: { color: "#0b5d3b", fontSize: 16 },
  modeTextSelected: { color: "#fff", fontSize: 16, fontWeight: "600" },
  panel: { marginVertical: 12 },
  input: {
    minHeight: 160,
    borderWidth: 1,
    borderColor: "#c8c8c8",
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    textAlignVertical: "top",
  },
});
