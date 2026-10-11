/**
 * CIT-10 — where the issue is (FR-PUB.24, FR-COMMON.16; DG-30, DG-73 — Hassan Jalal, 2026-10-11).
 *
 * - First the phone's current GPS position; failing that, its last known position;
 *   failing both — or with location refused — the reporter describes the place in
 *   words, and is told that the report will say precise coordinates were not
 *   available. No predetermined starting coordinate.
 * - Latitude, longitude and the reported accuracy are shown; directional buttons
 *   move the position. **What the phone measured is kept unchanged beside the
 *   position the reporter confirms** (M3), and both are shown when they differ.
 * - No map, no map provider, no address lookup (DG-30). Location is asked for
 *   only here, in the foreground, after an explanation (FR-COMMON.16).
 * - Every change is saved to the draft as it is made, in one step (setLocation).
 */
import * as Location from "expo-location";
import { useCallback, useEffect, useRef, useState } from "react";
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
  ADJUST_STEP_M,
  type Direction,
  distanceMetres,
  isAdjusted,
  LOCATION_DESCRIPTION_MAX,
  type MeasuredPosition,
  moved,
  type ReportLocation,
} from "../domain/location";
import { useDirection } from "../i18n";
import { type DraftRepository, locationOf } from "../storage/drafts";
import { Body, LinkButton, Notice, PrimaryButton, Screen, Title } from "../ui";

type Props = {
  drafts: DraftRepository;
  draftId: string;
  onContinue: () => void;
  /** The time source for the age of a last known position; tests move it. */
  clock?: () => Date;
};

type DraftState = "loading" | "editable" | "gone" | "sent";

/** How long to wait for a current fix before using the last known position. A routine choice. */
export const CURRENT_FIX_TIMEOUT_MS = 20_000;

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
  const [permission, setPermission] = useState<Location.LocationPermissionResponse | null>(null);
  const [finding, setFinding] = useState(false);
  const [noFix, setNoFix] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const tried = useRef(false);
  const refused = permission !== null && !permission.granted && permission.status !== "undetermined";
  const describing = location?.kind !== "coordinates" && (noFix || refused);

  useEffect(() => {
    let live = true;
    void drafts.get(draftId).then((draft) => {
      if (!live) return;
      if (!draft) return setDraftState("gone");
      const saved = locationOf(draft);
      setLocation(saved);
      if (saved?.kind === "description") {
        setDescription(saved.description);
        setNoFix(true);
      }
      setDraftState(draft.pipeline_state === "LOCAL_DRAFT" ? "editable" : "sent");
    });
    return () => {
      live = false;
    };
  }, [drafts, draftId]);

  // Location permission now, and again whenever the reporter returns from Settings (finding F-3).
  useEffect(() => {
    const read = () => void Location.getForegroundPermissionsAsync().then(setPermission, () => undefined);
    read();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") read();
    });
    return () => subscription.remove();
  }, []);

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

  const locate = useCallback(async () => {
    setFinding(true);
    setMessage(null);
    const current = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      CURRENT_FIX_TIMEOUT_MS,
    );
    let measured = current ? measuredFrom(current, "current") : null;
    if (!measured) {
      const last = await Location.getLastKnownPositionAsync().catch(() => null);
      measured = last ? measuredFrom(last, "last_known") : null;
    }
    if (measured) {
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
    } else {
      setNoFix(true);
    }
    setFinding(false);
  }, [save, t, clock]);

  // The first visit with location allowed and nothing saved yet: find the position at once.
  useEffect(() => {
    if (draftState !== "editable" || !permission?.granted || location || tried.current) return;
    tried.current = true;
    void locate();
  }, [draftState, permission, location, locate]);

  // A written description is saved as it is written, exactly as written; an emptied one clears it.
  useEffect(() => {
    if (draftState !== "editable" || !describing) return;
    const saved = location?.kind === "description" ? location.description : null;
    if (description === (saved ?? "")) return; // nothing new to save
    const timer = setTimeout(() => {
      if (description.trim()) void save({ kind: "description", description });
      else if (saved !== null) void drafts.clearLocation(draftId).then(() => setLocation(null));
    }, 400);
    return () => clearTimeout(timer);
  }, [description, describing, draftState, location, save, drafts, draftId]);

  const allow = async () => {
    const answer = await Location.requestForegroundPermissionsAsync();
    setPermission(answer);
    if (answer.granted) {
      tried.current = true;
      await locate();
    }
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
    if (describing && description.trim()) {
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
  const ready = !!coordinates || (describing && description.trim().length > 0);
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
              : t("location.accuracy", { metres: Math.round(coordinates.measured.accuracyM) })}
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

      {describing ? (
        <View style={styles.panel}>
          <Notice kind="info">{t("location.noCoordinates")}</Notice>
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
          <Body>{t("location.noCoordinatesSaved")}</Body>
          {left <= 100 ? <Notice kind="info">{t("location.charactersLeft", { count: left })}</Notice> : null}
        </View>
      ) : null}

      {permission?.granted && !finding && (coordinates || describing) ? (
        <LinkButton label={t("location.tryAgain")} onPress={() => void locate()} />
      ) : null}

      {message ? <Notice>{message}</Notice> : null}
      {!ready ? <Notice kind="info">{t("location.need")}</Notice> : null}
      <PrimaryButton
        label={t("common.continue")}
        onPress={() => void finish()}
        disabled={!ready || finding}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  panel: { marginVertical: 12 },
  coordinates: { fontSize: 18, fontWeight: "600", marginVertical: 6, writingDirection: "ltr" },
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
