/**
 * CIT-10 — where the issue is (FR-PUB.24, FR-COMMON.16; DG-30, DG-73, DG-77 — Hassan Jalal, 2026-10-11).
 *
 * - First the phone's current GPS position, requested at the highest accuracy the
 *   platform offers; failing that, its last known position; failing both — or with
 *   location refused — the reporter describes the place **by voice or in writing**.
 *   Typing is never required (DG-77; NFR-28). The report says that precise GPS
 *   coordinates were not available. No predetermined starting coordinate.
 * - A spoken description is a `location_voice` recording kept as evidence; nothing
 *   is transcribed or inferred from it (DG-77).
 * - Latitude, longitude and the accuracy the phone reports are shown, never a greater
 *   precision; directional buttons move the position 5 m. **What the phone measured
 *   is kept unchanged beside the position the reporter confirms** (M3), and both are
 *   shown when they differ.
 * - No map, no map provider, no address lookup (DG-30). Location is asked for only
 *   here, in the foreground, after an explanation (FR-COMMON.16).
 * - Every change is saved to the draft as it is made, in one step. Nothing the
 *   reporter gave is deleted without their confirmation (FR-COMMON.14).
 */
import {
  getRecordingPermissionsAsync,
  type PermissionResponse,
  requestRecordingPermissionsAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import * as Location from "expo-location";
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

import {
  accuracyText,
  ADJUST_STEP_M,
  type Direction,
  distanceMetres,
  isAdjusted,
  LAST_KNOWN_MAX_AGE_MS,
  lastKnownUsable,
  LOCATION_DESCRIPTION_MAX,
  type MeasuredPosition,
  moved,
  type ReportLocation,
} from "../domain/location";
import { MAX_LOCATION_RECORDING_SECONDS } from "../domain/recordingSettings";
import { useDirection } from "../i18n";
import { type DraftRepository, type EvidenceRow, locationOf } from "../storage/drafts";
import { deleteDraftMedia, draftMediaFile } from "../storage/media";
import { withMediaLock } from "../storage/mediaLock";
import { Body, LinkButton, Notice, PrimaryButton, Screen, Title } from "../ui";
import { type RecorderFailure, useVoiceRecorder } from "./useVoiceRecorder";

type Props = {
  drafts: DraftRepository;
  draftId: string;
  onContinue: () => void;
  /** The time source for the age of a last known position, and for capture times; tests move it. */
  clock?: () => Date;
};

type DraftState = "loading" | "editable" | "gone" | "sent";
type How = "spoken" | "written";
type Confirm = "toWritten" | "toSpoken" | "useFix";

/** How long to wait for a current fix before using the last known position (approved, 2026-10-11). */
export const CURRENT_FIX_TIMEOUT_MS = 20_000;

/** The best practical accuracy (approved, 2026-10-11). On Android, High and above use the same high-accuracy mode. */
export const FIX_ACCURACY = Location.Accuracy.Highest;

const DIRECTIONS: readonly Direction[] = ["north", "west", "east", "south"];

export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(null), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      () => {
        clearTimeout(timer);
        resolve(null);
      },
    );
  });
}

function measuredFrom(position: Location.LocationObject, fix: MeasuredPosition["fix"]): MeasuredPosition {
  const accuracy = position.coords.accuracy;
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracyM: typeof accuracy === "number" && accuracy >= 0 && accuracy <= 100_000 ? accuracy : null,
    fix,
    measuredAt: new Date(position.timestamp).toISOString(),
  };
}

const sixPlaces = (degrees: number) => degrees.toFixed(6);

export { accuracyText };

function clockText(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** How long ago a reading was taken, in the reporter's language. */
function ageText(
  t: (key: string, options?: Record<string, unknown>) => string,
  measuredAt: string,
  now: Date,
) {
  const minutes = Math.max(0, Math.round((now.getTime() - Date.parse(measuredAt)) / 60_000));
  if (minutes < 120) return t("location.agoMinutes", { count: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 48) return t("location.agoHours", { count: hours });
  return t("location.agoDays", { count: Math.round(hours / 24) });
}

export function LocationScreen({ drafts, draftId, onContinue, clock = () => new Date() }: Props) {
  const { t } = useTranslation();
  const { text: textDirection } = useDirection();
  const [draftState, setDraftState] = useState<DraftState>("loading");
  const [location, setLocation] = useState<ReportLocation | null>(null);
  const [description, setDescription] = useState("");
  const [recording, setRecording] = useState<EvidenceRow | null>(null);
  const [how, setHow] = useState<How | null>(null);
  const [permission, setPermission] = useState<Location.LocationPermissionResponse | null>(null);
  const [microphone, setMicrophone] = useState<PermissionResponse | null>(null);
  const [finding, setFinding] = useState(false);
  const [noFix, setNoFix] = useState(false);
  const [confirm, setConfirm] = useState<Confirm | null>(null);
  const [pendingFix, setPendingFix] = useState<MeasuredPosition | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const tried = useRef(false);
  const refused = permission !== null && !permission.granted && permission.status !== "undetermined";
  const describing = location?.kind !== "coordinates" && (noFix || refused);

  useEffect(() => {
    let live = true;
    void (async () => {
      const draft = await drafts.get(draftId);
      if (!live) return;
      if (!draft) return setDraftState("gone");
      const saved = locationOf(draft);
      const spoken =
        (await drafts.evidence(draftId)).find((e) => e.kind === "location_voice" && e.source_uri === null) ??
        null;
      if (!live) return;
      setLocation(saved);
      setRecording(spoken);
      if (saved?.kind === "description") {
        setDescription(saved.description);
        setHow("written");
        setNoFix(true);
      }
      if (saved?.kind === "spoken") {
        setHow("spoken");
        setNoFix(true);
      }
      setDraftState(draft.pipeline_state === "LOCAL_DRAFT" ? "editable" : "sent");
    })();
    return () => {
      live = false;
    };
  }, [drafts, draftId]);

  // Location and microphone permissions now, and again on return from Settings (finding F-3).
  useEffect(() => {
    const read = () => {
      void Location.getForegroundPermissionsAsync().then(setPermission, () => undefined);
      void getRecordingPermissionsAsync().then(setMicrophone, () => undefined);
    };
    read();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") read();
    });
    return () => subscription.remove();
  }, []);

  const show = (text: string, kind: "error" | "info" = "error") => {
    setMessage(text);
    if (kind === "info") AccessibilityInfo.announceForAccessibility(text);
  };

  const save = useCallback(
    async (next: ReportLocation) => {
      try {
        await drafts.setLocation(draftId, next);
        setLocation(next);
      } catch {
        setMessage(t("location.saveFailed"));
      }
    },
    [drafts, draftId, t],
  );

  const removeRecording = useCallback(async () => {
    if (!recording) return;
    const removed = await drafts.removeEvidence(draftId, recording.evidence_id);
    if (removed) await withMediaLock(async () => deleteDraftMedia(removed.file_name));
    setRecording(null);
  }, [drafts, draftId, recording]);

  const adoptMeasured = useCallback(
    async (measured: MeasuredPosition) => {
      setNoFix(false);
      await save({
        kind: "coordinates",
        measured,
        reported: { latitude: measured.latitude, longitude: measured.longitude },
      });
      AccessibilityInfo.announceForAccessibility(
        measured.fix === "current"
          ? t("location.current")
          : t("location.lastKnown", { age: ageText(t, measured.measuredAt, clock()) }),
      );
    },
    [save, t, clock],
  );

  const locate = useCallback(async () => {
    setFinding(true);
    setMessage(null);
    const current = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: FIX_ACCURACY }),
      CURRENT_FIX_TIMEOUT_MS,
    );
    let measured = current ? measuredFrom(current, "current") : null;
    let tooOld = false;
    if (!measured) {
      // Only a reading at most 30 minutes old is used (approved 2026-10-11); an older one is not a fallback.
      const last = await Location.getLastKnownPositionAsync({ maxAge: LAST_KNOWN_MAX_AGE_MS }).catch(
        () => null,
      );
      const candidate = last ? measuredFrom(last, "last_known") : null;
      if (candidate && lastKnownUsable(candidate.measuredAt, clock())) measured = candidate;
      else tooOld = candidate !== null;
    }
    if (!measured) {
      setNoFix(true);
      if (tooOld) show(t("location.lastKnownTooOld", { minutes: LAST_KNOWN_MAX_AGE_MS / 60_000 }), "info");
    } else if (location?.kind === "description" || location?.kind === "spoken") {
      // A description the reporter gave is replaced only with their confirmation (FR-COMMON.14).
      setPendingFix(measured);
      setConfirm("useFix");
    } else {
      await adoptMeasured(measured);
    }
    setFinding(false);
  }, [location, adoptMeasured, clock, t]);

  // The first visit with location allowed and nothing saved yet: find the position at once.
  useEffect(() => {
    if (draftState !== "editable" || !permission?.granted || location || tried.current) return;
    tried.current = true;
    void locate();
  }, [draftState, permission, location, locate]);

  // A written description is saved as it is written, exactly as written; an emptied one clears it.
  useEffect(() => {
    if (draftState !== "editable" || !describing || how !== "written") return;
    const saved = location?.kind === "description" ? location.description : null;
    if (description === (saved ?? "")) return; // nothing new to save
    const timer = setTimeout(() => {
      if (description.trim()) void save({ kind: "description", description });
      else if (saved !== null) void drafts.clearLocation(draftId).then(() => setLocation(null));
    }, 400);
    return () => clearTimeout(timer);
  }, [description, describing, how, draftState, location, save, drafts, draftId]);

  const recorder = useVoiceRecorder({
    drafts,
    draftId,
    kind: "location_voice",
    clock,
    onSaved: async (row, atLimit) => {
      setRecording(row);
      await save({ kind: "spoken" });
      show(
        atLimit
          ? t("describe.savedAtLimit", { max: clockText(MAX_LOCATION_RECORDING_SECONDS) })
          : t("location.spokenSaved"),
        "info",
      );
    },
    onFailed: (reason: RecorderFailure) =>
      show(
        reason === "unreadable"
          ? t("describe.unreadable")
          : reason === "too_long"
            ? t("location.tooLong", { seconds: MAX_LOCATION_RECORDING_SECONDS })
            : reason === "storage_full"
              ? t("describe.storageFull")
              : t("describe.saveFailed"),
      ),
  });

  const playerSource = useMemo(
    () => (recording ? { uri: draftMediaFile(recording.file_name).uri } : null),
    [recording],
  );
  const player = useAudioPlayer(playerSource);
  const playback = useAudioPlayerStatus(player);

  const allow = async () => {
    const answer = await Location.requestForegroundPermissionsAsync();
    setPermission(answer);
    if (answer.granted) {
      tried.current = true;
      await locate();
    }
  };

  const choose = (next: How) => {
    if (next === how || recorder.isRecording) return;
    setMessage(null);
    if (next === "written" && recording) return setConfirm("toWritten");
    if (next === "spoken" && description.trim()) return setConfirm("toSpoken");
    setHow(next);
  };

  const confirmed = async () => {
    if (confirm === "toWritten") {
      player.pause();
      await removeRecording();
      await drafts.clearLocation(draftId);
      setLocation(null);
      setHow("written");
    } else if (confirm === "toSpoken") {
      setDescription("");
      await drafts.clearLocation(draftId);
      setLocation(null);
      setHow("spoken");
    } else if (confirm === "useFix" && pendingFix) {
      player.pause();
      await removeRecording();
      setDescription("");
      setHow(null);
      await adoptMeasured(pendingFix);
      setPendingFix(null);
    }
    setConfirm(null);
  };

  const deleteSpoken = async () => {
    player.pause();
    await removeRecording();
    await drafts.clearLocation(draftId);
    setLocation(null);
    show(t("describe.deleted"), "info");
  };

  const togglePlayback = () => {
    if (playback.playing) return player.pause();
    if (playback.didJustFinish || (playback.duration > 0 && playback.currentTime >= playback.duration))
      void player.seekTo(0);
    player.play();
  };

  const move = (direction: Direction) => {
    if (location?.kind !== "coordinates") return;
    void save({ ...location, reported: moved(location.reported, direction) });
    AccessibilityInfo.announceForAccessibility(
      t("location.moved", { metres: ADJUST_STEP_M, direction: t(`location.${direction}`) }),
    );
  };

  const reset = () => {
    if (location?.kind !== "coordinates") return;
    const { latitude, longitude } = location.measured;
    void save({ ...location, reported: { latitude, longitude } });
  };

  const finish = async () => {
    if (describing && how === "written" && description.trim()) {
      await save({ kind: "description", description });
    }
    onContinue();
  };

  if (draftState === "loading") {
    return (
      <Screen testID="CIT-10">
        <Body>{t("evidence.loading")}</Body>
      </Screen>
    );
  }
  if (draftState !== "editable") {
    return (
      <Screen testID="CIT-10">
        <Title>{t("location.title")}</Title>
        <Notice>{t(draftState === "gone" ? "evidence.draftGone" : "location.notEditable")}</Notice>
      </Screen>
    );
  }

  const coordinates = location?.kind === "coordinates" ? location : null;
  const spokenReady = how === "spoken" && !!recording && location?.kind === "spoken" && !recorder.isRecording;
  const writtenReady = how === "written" && description.trim().length > 0;
  const ready = !!coordinates || (describing && (spokenReady || writtenReady));
  const left = LOCATION_DESCRIPTION_MAX - description.length;

  return (
    <Screen testID="CIT-10">
      <Title>{t("location.title")}</Title>
      <Body>{t("location.intro")}</Body>

      {permission && !permission.granted && !coordinates ? (
        <View style={styles.panel}>
          <Notice kind="info">
            {t(permission.status === "undetermined" ? "location.why" : "location.denied")}
          </Notice>
          {permission.canAskAgain ? (
            <PrimaryButton label={t("location.allow")} onPress={() => void allow()} />
          ) : (
            <>
              <Notice kind="info">{t("location.settings")}</Notice>
              <PrimaryButton label={t("evidence.openSettings")} onPress={() => void Linking.openSettings()} />
            </>
          )}
        </View>
      ) : null}

      {finding ? <Notice kind="info">{t("location.finding")}</Notice> : null}

      {confirm ? (
        <View style={styles.panel}>
          <Notice kind="info">
            {t(
              confirm === "toWritten"
                ? "location.toWrittenWarning"
                : confirm === "toSpoken"
                  ? "location.toSpokenWarning"
                  : "location.useFix",
            )}
          </Notice>
          <PrimaryButton
            label={t(
              confirm === "toWritten"
                ? "location.toWrittenConfirm"
                : confirm === "toSpoken"
                  ? "location.toSpokenConfirm"
                  : "location.useFixConfirm",
            )}
            onPress={() => void confirmed()}
          />
          <LinkButton
            label={t("describe.keep")}
            onPress={() => {
              setConfirm(null);
              setPendingFix(null);
            }}
          />
        </View>
      ) : null}

      {coordinates ? (
        <View style={styles.panel}>
          <Body>
            {coordinates.measured.fix === "current"
              ? t("location.current")
              : t("location.lastKnown", { age: ageText(t, coordinates.measured.measuredAt, clock()) })}
          </Body>
          <Text testID="reported-coordinates" style={styles.coordinates}>
            {t("location.coordinates", {
              latitude: sixPlaces(coordinates.reported.latitude),
              longitude: sixPlaces(coordinates.reported.longitude),
            })}
          </Text>
          <Body>
            {coordinates.measured.accuracyM === null
              ? t("location.accuracyUnknown")
              : t("location.accuracy", { metres: accuracyText(coordinates.measured.accuracyM) })}
          </Body>
          {isAdjusted(coordinates) ? (
            <View style={styles.panel}>
              <Notice kind="info">
                {t("location.adjusted", {
                  metres: Math.round(distanceMetres(coordinates.measured, coordinates.reported)),
                })}
              </Notice>
              <Body>
                {t("location.measured", {
                  latitude: sixPlaces(coordinates.measured.latitude),
                  longitude: sixPlaces(coordinates.measured.longitude),
                })}
              </Body>
              <LinkButton label={t("location.reset")} onPress={reset} />
            </View>
          ) : null}
          <Body>{t("location.adjustIntro", { metres: ADJUST_STEP_M })}</Body>
          {/* A compass cross, the same in either reading direction: north is up, east is right. */}
          <View style={styles.cross}>
            {DIRECTIONS.map((direction) => (
              <Pressable
                key={direction}
                accessibilityRole="button"
                accessibilityLabel={t("location.moveLabel", {
                  direction: t(`location.${direction}`),
                  metres: ADJUST_STEP_M,
                })}
                onPress={() => move(direction)}
                style={[styles.arrow, styles[direction]]}
              >
                <Text style={styles.arrowText}>{t(`location.${direction}`)}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      {describing && !confirm ? (
        <View style={styles.panel}>
          <Notice kind="info">{t("location.noCoordinates")}</Notice>
          {/* Two equal ways; neither is required and neither is chosen for the reporter (DG-77). */}
          <View style={styles.modes}>
            {(["spoken", "written"] as const).map((m) => (
              <Pressable
                key={m}
                accessibilityRole="button"
                accessibilityLabel={t(m === "spoken" ? "location.speak" : "location.type")}
                accessibilityState={{ selected: how === m, disabled: recorder.isRecording }}
                disabled={recorder.isRecording}
                onPress={() => choose(m)}
                style={[styles.mode, how === m ? styles.modeSelected : null]}
              >
                <Text style={how === m ? styles.modeTextSelected : styles.modeText}>
                  {t(m === "spoken" ? "location.speak" : "location.type")}
                </Text>
              </Pressable>
            ))}
          </View>

          {how === "spoken" ? (
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
            ) : recording && !recorder.isRecording ? (
              <View style={styles.panel}>
                <Body>{t("location.recorded", { time: clockText(recording.duration_seconds ?? 0) })}</Body>
                <PrimaryButton
                  label={t(playback.playing ? "describe.pause" : "describe.play")}
                  onPress={togglePlayback}
                />
                <LinkButton label={t("describe.delete")} onPress={() => void deleteSpoken()} />
              </View>
            ) : (
              <View style={styles.panel}>
                {!recorder.isRecording ? (
                  <>
                    <Body>{t("location.speakHint")}</Body>
                    <Body>{t("location.limit", { seconds: MAX_LOCATION_RECORDING_SECONDS })}</Body>
                  </>
                ) : null}
                <PrimaryButton
                  label={t(recorder.isRecording ? "describe.stopRecording" : "describe.startRecording")}
                  onPress={() => void (recorder.isRecording ? recorder.stop() : recorder.start())}
                  disabled={recorder.busy && !recorder.isRecording}
                />
                {recorder.isRecording ? (
                  <Notice kind="info">
                    {t("describe.recordingTime", {
                      time: clockText(recorder.elapsedSeconds),
                      max: clockText(MAX_LOCATION_RECORDING_SECONDS),
                    })}
                  </Notice>
                ) : null}
              </View>
            )
          ) : null}

          {how === "written" ? (
            <View style={styles.panel}>
              <TextInput
                testID="location-description"
                accessibilityLabel={t("location.describeLabel")}
                placeholder={t("location.describeLabel")}
                value={description}
                onChangeText={setDescription}
                multiline
                maxLength={LOCATION_DESCRIPTION_MAX}
                style={[styles.input, textDirection]}
              />
              {left <= 100 ? (
                <Notice kind="info">{t("location.charactersLeft", { count: left })}</Notice>
              ) : null}
            </View>
          ) : null}
          <Body>{t("location.noCoordinatesSaved")}</Body>
        </View>
      ) : null}

      {permission?.granted && !finding && !confirm && (coordinates || describing) ? (
        <LinkButton label={t("location.tryAgain")} onPress={() => void locate()} />
      ) : null}

      {message ? <Notice>{message}</Notice> : null}
      {!ready ? <Notice kind="info">{t("location.need")}</Notice> : null}
      <PrimaryButton
        label={t("common.continue")}
        onPress={() => void finish()}
        disabled={!ready || finding || recorder.isRecording}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  panel: { marginVertical: 12 },
  coordinates: { fontSize: 18, fontWeight: "600", marginVertical: 6, writingDirection: "ltr" },
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
  cross: {
    direction: "ltr",
    width: 240,
    height: 180,
    alignSelf: "center",
    marginVertical: 12,
  },
  arrow: {
    position: "absolute",
    width: 96,
    minHeight: 56,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#0b5d3b",
    borderRadius: 8,
  },
  arrowText: { color: "#0b5d3b", fontSize: 16, fontWeight: "600" },
  north: { top: 0, left: 72 },
  south: { bottom: 0, left: 72 },
  west: { top: 62, left: 0 },
  east: { top: 62, right: 0 },
  input: {
    minHeight: 120,
    borderWidth: 1,
    borderColor: "#c8c8c8",
    borderRadius: 8,
    padding: 12,
    fontSize: 18,
    textAlignVertical: "top",
  },
});
