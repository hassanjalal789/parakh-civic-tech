/**
 * Recording a voice item into a draft (FR-PUB.10; DG-74): the recorder's own file is
 * hashed and moved into the draft by ingestCapture, never re-encoded or trimmed. The
 * recorder stops itself at the 3-minute limit and the recording is kept, as a press
 * of Stop would keep it. Android also reports a finish after Stop is pressed;
 * `active` makes that second report a no-op.
 *
 * Used for the spoken location description on CIT-10 (`location_voice`, DG-77).
 */
import { RecordingPresets, setAudioModeAsync, useAudioRecorder, useAudioRecorderState } from "expo-audio";
import { Paths } from "expo-file-system";
import { useCallback, useEffect, useRef, useState } from "react";

import { MAX_RECORDING_SECONDS, RECORDING_SETTINGS } from "../domain/recordingSettings";
import { ingestCapture } from "../storage/capture";
import { type DraftRepository, EvidenceRefused, type EvidenceRow } from "../storage/drafts";

/** AAC in MPEG-4, one channel, 64 kbit/s (DG-74); the rest as expo-audio's high-quality preset. */
export const RECORDING_OPTIONS = {
  ...RecordingPresets.HIGH_QUALITY,
  extension: RECORDING_SETTINGS.extension,
  sampleRate: RECORDING_SETTINGS.sampleRate,
  numberOfChannels: RECORDING_SETTINGS.channels,
  bitRate: RECORDING_SETTINGS.bitRate,
};

export type RecorderFailure = "unreadable" | "too_long" | "storage_full" | "failed";

type Options = {
  drafts: DraftRepository;
  draftId: string;
  kind: "voice_original" | "location_voice";
  clock: () => Date;
  onSaved: (row: EvidenceRow, atLimit: boolean) => void | Promise<void>;
  onFailed: (reason: RecorderFailure) => void;
};

function freeBytes(): number {
  try {
    return Paths.availableDiskSpace;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export function useVoiceRecorder({ drafts, draftId, kind, clock, onSaved, onFailed }: Options) {
  const active = useRef(false);
  const onFinished = useRef<(atLimit: boolean) => void>(() => undefined);
  const recorder = useAudioRecorder(RECORDING_OPTIONS, (status) => {
    if (status.isFinished && active.current) onFinished.current(!status.hasError);
  });
  const state = useAudioRecorderState(recorder, 500);
  const [isRecording, setIsRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const startedAt = useRef<string | null>(null);
  const callbacks = useRef({ onSaved, onFailed });
  useEffect(() => {
    callbacks.current = { onSaved, onFailed };
  }, [onSaved, onFailed]);

  const finish = useCallback(
    async (atLimit: boolean) => {
      if (!active.current) return;
      active.current = false;
      try {
        await recorder.stop();
        setIsRecording(false);
        const uri = recorder.uri;
        if (!uri || !startedAt.current) return callbacks.current.onFailed("failed");
        const row = await ingestCapture(drafts, draftId, {
          uri,
          kind,
          mimeType: RECORDING_SETTINGS.mimeType,
          capturedAt: startedAt.current, // FR-PUB.25: the moment the recording began
        });
        await callbacks.current.onSaved(row, atLimit);
      } catch (error) {
        setIsRecording(false);
        const reason = error instanceof EvidenceRefused ? error.reason : null;
        callbacks.current.onFailed(
          reason === "unreadable_recording"
            ? "unreadable"
            : reason === "recording_too_long"
              ? "too_long"
              : "failed",
        );
      } finally {
        setBusy(false);
      }
    },
    [recorder, drafts, draftId, kind],
  );

  useEffect(() => {
    onFinished.current = (atLimit) => void finish(atLimit);
  }, [finish]);

  const start = async () => {
    if (busy) return;
    if (freeBytes() < RECORDING_SETTINGS.minFreeBytes) return callbacks.current.onFailed("storage_full");
    setBusy(true);
    try {
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      startedAt.current = clock().toISOString();
      recorder.record({ forDuration: MAX_RECORDING_SECONDS });
      active.current = true;
      setIsRecording(true);
    } catch {
      setBusy(false);
      callbacks.current.onFailed("failed");
    }
  };

  return {
    start,
    stop: () => finish(false),
    isRecording,
    busy,
    elapsedSeconds: state.durationMillis / 1000,
  };
}
