/**
 * A test double for expo-audio: a recorder that writes a synthetic file where expo-audio
 * would (the cache) and, as on Android, reports a finish after Stop; a player that only
 * counts; and the microphone permission. `__control` sets and reads them.
 */
import * as React from "react";

import { File, Paths } from "./fileSystem";

const GRANTED = { granted: true, status: "granted", canAskAgain: true, expires: "never" };
const listeners = new Set<() => void>();

export const __control = {
  permission: GRANTED as Record<string, unknown>,
  onRequest: null as null | (() => Record<string, unknown>),
  requests: 0,
  recording: null as Uint8Array | null,
  statusListener: null as null | ((status: Record<string, unknown>) => void),
  records: [] as unknown[],
  stops: 0,
  count: 0,
  playerSource: null as unknown,
  plays: 0,
  pauses: 0,
  playing: false,
};

const notify = () => listeners.forEach((l) => l());

const recorder = {
  uri: null as string | null,
  prepareToRecordAsync: async () => undefined,
  record: (options: unknown) => {
    __control.records.push(options);
  },
  stop: async () => {
    __control.stops++;
    const file = new File(Paths.cache, `recording-${++__control.count}.m4a`);
    file.write(__control.recording ?? new Uint8Array());
    recorder.uri = file.uri;
    __control.statusListener?.({ isFinished: true, hasError: false });
  },
};

const player = {
  play: () => {
    __control.plays++;
    __control.playing = true;
    notify();
  },
  pause: () => {
    __control.pauses++;
    __control.playing = false;
    notify();
  },
  seekTo: async () => undefined,
};

export function resetExpoAudio(recording: Uint8Array | null = null) {
  Object.assign(__control, {
    permission: GRANTED,
    onRequest: null,
    requests: 0,
    recording,
    statusListener: null,
    records: [],
    stops: 0,
    count: 0,
    playerSource: null,
    plays: 0,
    pauses: 0,
    playing: false,
  });
}

export const RecordingPresets = {
  HIGH_QUALITY: { extension: ".m4a", sampleRate: 44100, numberOfChannels: 2, bitRate: 128000 },
};

export function useAudioRecorder(_options: unknown, listener: (status: Record<string, unknown>) => void) {
  __control.statusListener = listener;
  return recorder;
}

export const useAudioRecorderState = () => ({ isRecording: false, durationMillis: 0, canRecord: true });

export function useAudioPlayer(source: unknown) {
  __control.playerSource = source;
  return player;
}

export function useAudioPlayerStatus() {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const listener = () => setTick((n) => n + 1);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return { playing: __control.playing, currentTime: 0, duration: 9, didJustFinish: false };
}

export const getRecordingPermissionsAsync = async () => __control.permission;

export async function requestRecordingPermissionsAsync() {
  __control.requests++;
  if (__control.onRequest) __control.permission = __control.onRequest();
  return __control.permission;
}

export const setAudioModeAsync = async () => undefined;
