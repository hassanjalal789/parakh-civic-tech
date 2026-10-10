/**
 * CIT-08 — live evidence capture (FR-PUB.4–FR-PUB.8, FR-COMMON.14, FR-COMMON.16,
 * NFR-8; UC-CIT-016, UC-CIT-017).
 *
 * - The in-app camera only: no gallery, file picker, share or import path exists.
 * - 1–3 live photos and at most one live video of up to 60 seconds, which never
 *   counts as a photo (DG-47, DG-54). There is no skip control: Continue stays
 *   disabled, with the reason stated, until a photo exists (FR-PUB.8, Branch A).
 * - The camera's own file is the evidence. ingestCapture hashes it at capture,
 *   then moves it into the draft — never copied, re-encoded or encrypted (DG-63).
 *   Photos are kept small by the camera's own settings (NFR-8).
 * - The capture time is the operative time (FR-PUB.25).
 * - Each permission is explained before Android asks for it; a refusal leads to
 *   a plain explanation and Settings, never to a gallery (FR-COMMON.16, FR-PUB.7).
 *   A video records sound, so it also needs the microphone (DG-54).
 * - A capture that cannot be saved — storage full, a refused item — is named,
 *   and the draft and its earlier items are kept (FR-COMMON.14).
 */
import { CameraView, useCameraPermissions, useMicrophonePermissions } from "expo-camera";
import { Paths } from "expo-file-system";
import { useVideoPlayer, VideoView } from "expo-video";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  AccessibilityInfo,
  AppState,
  Image,
  Linking,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { CAPTURE_SETTINGS, choosePictureSize, roomToCapture, videoMimeType } from "../domain/captureSettings";
import { addRefusal, EVIDENCE_RULES, type EvidenceKind } from "../domain/evidenceRules";
import { useDirection } from "../i18n";
import { ingestCapture } from "../storage/capture";
import { type DraftRepository, EvidenceRefused, type EvidenceRow } from "../storage/drafts";
import { deleteDraftMedia, draftMediaFile } from "../storage/media";
import { withMediaLock } from "../storage/mediaLock";
import type { CitizenStoreState } from "../storage/useCitizenStore";
import { Body, LinkButton, Notice, PrimaryButton, Screen, Title } from "../ui";

type Props = {
  drafts: DraftRepository;
  draftId: string;
  onContinue: () => void;
  /** The capture time source; tests move it. */
  clock?: () => Date;
};

type Mode = "photo" | "video";
type DraftState = "loading" | "editable" | "gone" | "sent";

type Loaded = { state: DraftState; items: EvidenceRow[] };

async function load(drafts: DraftRepository, draftId: string): Promise<Loaded> {
  const draft = await drafts.get(draftId);
  if (!draft) return { state: "gone", items: [] };
  return {
    state: draft.pipeline_state === "LOCAL_DRAFT" ? "editable" : "sent",
    // Only items whose file has reached the draft; one still being moved is finished on the next open.
    items: (await drafts.evidence(draftId)).filter((e) => e.source_uri === null),
  };
}

function freeBytes(): number {
  try {
    return Paths.availableDiskSpace;
  } catch {
    return Number.POSITIVE_INFINITY; // unknown: the capture itself reports a failure
  }
}

function announce(message: string): void {
  AccessibilityInfo.announceForAccessibility(message);
}

export function EvidenceScreen({ drafts, draftId, onContinue, clock = () => new Date() }: Props) {
  const { t } = useTranslation();
  const camera = useRef<CameraView>(null);
  const [cameraPermission, requestCamera, readCamera] = useCameraPermissions();
  const [microphonePermission, requestMicrophone, readMicrophone] = useMicrophonePermissions();
  const [draftState, setDraftState] = useState<DraftState>("loading");
  const [items, setItems] = useState<EvidenceRow[]>([]);
  const [mode, setMode] = useState<Mode>("photo");
  const [ready, setReady] = useState(false);
  const [pictureSize, setPictureSize] = useState<string | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [message, setMessage] = useState<{ text: string; kind: "error" | "info" } | null>(null);
  const [review, setReview] = useState<EvidenceRow | null>(null);

  const apply = useCallback((loaded: Loaded) => {
    setDraftState(loaded.state);
    setItems(loaded.items);
  }, []);

  const refresh = useCallback(async () => apply(await load(drafts, draftId)), [apply, drafts, draftId]);

  useEffect(() => {
    let live = true;
    void load(drafts, draftId).then((loaded) => {
      if (live) apply(loaded);
    });
    return () => {
      live = false;
    };
  }, [apply, drafts, draftId]);

  // A permission allowed in Settings applies as soon as the citizen comes back (FR-PUB.7, finding F-3).
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active") return;
      void readCamera().catch(() => undefined);
      void readMicrophone().catch(() => undefined);
    });
    return () => subscription.remove();
  }, [readCamera, readMicrophone]);

  // The elapsed time while a video records; the camera itself stops at 60 seconds.
  useEffect(() => {
    if (!recording) return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [recording]);

  const counts = useMemo(() => {
    const c: Partial<Record<EvidenceKind, number>> = {};
    for (const e of items) c[e.kind] = (c[e.kind] ?? 0) + 1;
    return c;
  }, [items]);
  const photos = counts.photo ?? 0;
  const videos = counts.video ?? 0;

  const show = (text: string, kind: "error" | "info" = "error") => {
    setMessage({ text, kind });
    if (kind === "info") announce(text);
  };

  const refusalText = (error: unknown): string => {
    if (!(error instanceof EvidenceRefused)) return t("evidence.saveFailed");
    switch (error.reason) {
      case "photo_limit":
        return t("evidence.photoLimit");
      case "video_limit":
        return t("evidence.videoLimit");
      case "video_too_long":
        return t("evidence.videoTooLong");
      case "too_large":
        return t("evidence.tooLarge");
      case "unreadable_video":
        return t("evidence.unreadable");
      case "unknown_draft":
        return t("evidence.draftGone");
      case "not_editable":
        return t("evidence.notEditable");
      default:
        return t("evidence.saveFailed");
    }
  };

  const capturedAfter = async (error: unknown) => {
    show(refusalText(error));
    await refresh();
  };

  const onCameraReady = async () => {
    setReady(true);
    try {
      setPictureSize(choosePictureSize((await camera.current?.getAvailablePictureSizesAsync()) ?? []));
    } catch {
      setPictureSize(undefined); // the camera's default size
    }
  };

  const takePhoto = async () => {
    if (!camera.current || busy) return;
    if (addRefusal("photo", counts)) return show(t("evidence.photoLimit"));
    if (!roomToCapture("photo", freeBytes())) return show(t("evidence.storageFull"));
    setBusy(true);
    setMessage(null);
    const capturedAt = clock().toISOString(); // FR-PUB.25: the moment of capture
    try {
      const picture = await camera.current.takePictureAsync({
        quality: CAPTURE_SETTINGS.photoQuality,
        exif: false,
      });
      await ingestCapture(drafts, draftId, {
        uri: picture.uri,
        kind: "photo",
        mimeType: picture.format === "png" ? "image/png" : "image/jpeg",
        capturedAt,
      });
      await refresh();
      show(t("evidence.photoSaved", { photos: photos + 1 }), "info");
    } catch (error) {
      await capturedAfter(error);
    } finally {
      setBusy(false);
    }
  };

  const toggleRecording = async () => {
    if (!camera.current) return;
    if (recording) {
      camera.current.stopRecording();
      return;
    }
    if (busy) return;
    if (addRefusal("video", counts)) return show(t("evidence.videoLimit"));
    if (!roomToCapture("video", freeBytes())) return show(t("evidence.storageFull"));
    setBusy(true);
    setMessage(null);
    const capturedAt = clock().toISOString();
    setSeconds(0);
    setRecording(true);
    try {
      const result = await camera.current.recordAsync({
        maxDuration: CAPTURE_SETTINGS.videoMaxSeconds,
        maxFileSize: CAPTURE_SETTINGS.videoMaxBytes,
      });
      setRecording(false);
      if (!result?.uri) return show(t("evidence.saveFailed"));
      const row = await ingestCapture(drafts, draftId, {
        uri: result.uri,
        kind: "video",
        mimeType: videoMimeType(result.uri) ?? "video/unknown",
        capturedAt,
      });
      await refresh();
      show(t("evidence.videoSaved", { seconds: Math.round(row.duration_seconds ?? 0) }), "info");
    } catch (error) {
      setRecording(false);
      await capturedAfter(error);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item: EvidenceRow, then?: Mode) => {
    const removed = await drafts.removeEvidence(draftId, item.evidence_id);
    if (removed) await withMediaLock(async () => deleteDraftMedia(removed.file_name));
    setReview(null);
    await refresh();
    if (then) setMode(then);
    show(t("evidence.deleted"), "info");
  };

  if (draftState === "loading") {
    return (
      <Screen testID="CIT-08">
        <Body>{t("evidence.loading")}</Body>
      </Screen>
    );
  }
  if (draftState !== "editable") {
    return (
      <Screen testID="CIT-08">
        <Title>{t("evidence.title")}</Title>
        <Notice>{t(draftState === "gone" ? "evidence.draftGone" : "evidence.notEditable")}</Notice>
      </Screen>
    );
  }

  const needsMicrophone = mode === "video" && !microphonePermission?.granted;

  return (
    <Screen testID="CIT-08">
      <Title>{t("evidence.title")}</Title>
      <Body>{t("evidence.intro")}</Body>

      {!cameraPermission ? null : !cameraPermission.granted ? (
        <PermissionPanel
          why={t(cameraPermission.status === "undetermined" ? "evidence.cameraWhy" : "evidence.cameraDenied")}
          canAsk={cameraPermission.canAskAgain}
          askLabel={t("evidence.allowCamera")}
          settingsHint={t("evidence.cameraSettings")}
          onAsk={() => void requestCamera()}
        />
      ) : (
        <>
          <View style={styles.preview}>
            <CameraView
              ref={camera}
              testID="camera"
              style={StyleSheet.absoluteFill}
              facing="back"
              mode={mode === "photo" ? "picture" : "video"}
              videoQuality={CAPTURE_SETTINGS.videoQuality}
              videoBitrate={CAPTURE_SETTINGS.videoBitrate}
              pictureSize={pictureSize}
              onCameraReady={() => void onCameraReady()}
              onMountError={() => show(t("evidence.cameraUnavailable"))}
            />
          </View>

          <View style={styles.modes}>
            {(["photo", "video"] as const).map((m) => (
              <Pressable
                key={m}
                accessibilityRole="button"
                accessibilityLabel={t(m === "photo" ? "evidence.photoMode" : "evidence.videoMode")}
                accessibilityState={{ selected: mode === m, disabled: recording || busy }}
                disabled={recording || busy}
                onPress={() => setMode(m)}
                style={[styles.mode, mode === m ? styles.modeSelected : null]}
              >
                <Text style={mode === m ? styles.modeTextSelected : styles.modeText}>
                  {t(m === "photo" ? "evidence.photoMode" : "evidence.videoMode")}
                </Text>
              </Pressable>
            ))}
          </View>

          {mode === "photo" ? (
            <PrimaryButton
              label={t("evidence.takePhoto")}
              onPress={() => void takePhoto()}
              disabled={!ready || photos >= EVIDENCE_RULES.photoMax}
              busy={busy}
            />
          ) : needsMicrophone ? (
            microphonePermission ? (
              <PermissionPanel
                why={t(
                  microphonePermission.status === "undetermined" ? "evidence.micWhy" : "evidence.micDenied",
                )}
                canAsk={microphonePermission.canAskAgain}
                askLabel={t("evidence.allowMicrophone")}
                settingsHint={t("evidence.micSettings")}
                onAsk={() => void requestMicrophone()}
              />
            ) : null
          ) : (
            <PrimaryButton
              label={t(recording ? "evidence.stopRecording" : "evidence.startRecording")}
              onPress={() => void toggleRecording()}
              disabled={!ready || (!recording && (busy || videos >= EVIDENCE_RULES.videoMax))}
            />
          )}
          {recording ? <Notice kind="info">{t("evidence.recordingTime", { seconds })}</Notice> : null}
          {mode === "photo" && photos >= EVIDENCE_RULES.photoMax ? (
            <Notice kind="info">{t("evidence.photoLimit")}</Notice>
          ) : null}
          {mode === "video" && !needsMicrophone && videos >= EVIDENCE_RULES.videoMax && !recording ? (
            <Notice kind="info">{t("evidence.videoLimit")}</Notice>
          ) : null}
        </>
      )}

      {message ? <Notice kind={message.kind}>{message.text}</Notice> : null}
      <Body>{t("evidence.counts", { photos, videos })}</Body>
      <Thumbnails items={items} onOpen={setReview} />

      {photos < EVIDENCE_RULES.photoMin ? <Notice kind="info">{t("evidence.needPhoto")}</Notice> : null}
      <PrimaryButton
        label={t("common.continue")}
        onPress={onContinue}
        disabled={photos < EVIDENCE_RULES.photoMin || recording || busy}
      />

      {review ? (
        <Review
          item={review}
          index={items.filter((e) => e.kind === "photo").indexOf(review) + 1}
          onClose={() => setReview(null)}
          onRetake={() => void remove(review, review.kind === "video" ? "video" : "photo")}
          onDelete={() => void remove(review)}
        />
      ) : null}
    </Screen>
  );
}

/** What a reporting route shows while the citizen's drafts open, or why they cannot. */
export function CitizenStoreStatus({ state }: { state: CitizenStoreState }) {
  const { t } = useTranslation();
  return (
    <Screen testID="CIT-08-store">
      {state.status === "failed" ? (
        <Notice>{t(state.reason === "offline" ? "evidence.needConnection" : "evidence.storeFailed")}</Notice>
      ) : (
        <Body>{t("evidence.loading")}</Body>
      )}
    </Screen>
  );
}

/**
 * Explains a permission before Android is asked (FR-COMMON.16). While Android can still ask, the
 * button asks; once it will not, the citizen is sent to Settings with that said plainly (FR-PUB.7).
 */
function PermissionPanel(props: {
  why: string;
  canAsk: boolean;
  askLabel: string;
  settingsHint: string;
  onAsk: () => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.panel}>
      <Notice kind="info">{props.why}</Notice>
      {props.canAsk ? (
        <PrimaryButton label={props.askLabel} onPress={props.onAsk} />
      ) : (
        <>
          <Notice kind="info">{props.settingsHint}</Notice>
          <PrimaryButton label={t("evidence.openSettings")} onPress={() => void Linking.openSettings()} />
        </>
      )}
    </View>
  );
}

function Thumbnails({ items, onOpen }: { items: EvidenceRow[]; onOpen: (item: EvidenceRow) => void }) {
  const { t } = useTranslation();
  const { row } = useDirection();
  let photo = 0;
  return (
    <View style={[styles.thumbs, row]}>
      {items.map((item) => {
        const label =
          item.kind === "photo"
            ? t("evidence.thumbPhoto", { n: ++photo })
            : t("evidence.thumbVideo", { seconds: Math.round(item.duration_seconds ?? 0) });
        return (
          <Pressable
            key={item.evidence_id}
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={() => onOpen(item)}
            style={styles.thumb}
          >
            {item.kind === "photo" ? (
              <Image source={{ uri: draftMediaFile(item.file_name).uri }} style={styles.thumbImage} />
            ) : (
              <Text style={styles.thumbVideo}>{`▶ ${Math.round(item.duration_seconds ?? 0)}s`}</Text>
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

function Review(props: {
  item: EvidenceRow;
  index: number;
  onClose: () => void;
  onRetake: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const uri = draftMediaFile(props.item.file_name).uri;
  const title =
    props.item.kind === "photo"
      ? t("evidence.reviewPhoto", { n: props.index })
      : t("evidence.reviewVideo", { seconds: Math.round(props.item.duration_seconds ?? 0) });
  return (
    <Modal visible animationType="slide" onRequestClose={props.onClose}>
      <Screen testID="CIT-08-review">
        <Title>{title}</Title>
        {props.item.kind === "photo" ? (
          <Image
            source={{ uri }}
            style={styles.reviewImage}
            resizeMode="contain"
            accessibilityLabel={title}
          />
        ) : (
          <VideoReview uri={uri} />
        )}
        <PrimaryButton label={t("evidence.retake")} onPress={props.onRetake} />
        <PrimaryButton label={t("evidence.delete")} onPress={props.onDelete} />
        <LinkButton label={t("evidence.close")} onPress={props.onClose} />
      </Screen>
    </Modal>
  );
}

function VideoReview({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri);
  return <VideoView player={player} nativeControls style={styles.reviewImage} />;
}

const styles = StyleSheet.create({
  preview: { height: 360, borderRadius: 8, overflow: "hidden", backgroundColor: "#000", marginVertical: 12 },
  modes: { flexDirection: "row", gap: 8, marginBottom: 8 },
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
  thumbs: { flexWrap: "wrap", gap: 8, marginVertical: 8 },
  thumb: {
    width: 88,
    height: 88,
    borderRadius: 6,
    overflow: "hidden",
    backgroundColor: "#222",
    alignItems: "center",
    justifyContent: "center",
  },
  thumbImage: { width: "100%", height: "100%" },
  thumbVideo: { color: "#fff", fontSize: 16 },
  reviewImage: { width: "100%", height: 420, backgroundColor: "#000", marginVertical: 12 },
});
