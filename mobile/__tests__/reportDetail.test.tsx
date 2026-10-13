/** CIT-15 privacy and navigation behavior, with synthetic API-151 data. */
import { render, userEvent, waitFor } from "@testing-library/react-native";
import { Share } from "react-native";

import { ApiError, OfflineError } from "../src/api/errors";
import type { ReportDetail } from "../src/api/reporting";
import i18n, { setLanguage } from "../src/i18n";
import { ReportDetailScreen } from "../src/screens/ReportDetailScreen";
import { __control as audio, resetExpoAudio } from "./fakes/expoAudio";

jest.mock("expo-audio", () => jest.requireActual("./fakes/expoAudio"));
jest.mock("expo-video", () => {
  const React = jest.requireActual("react");
  const { View } = jest.requireActual("react-native");
  return {
    useVideoPlayer: () => ({}),
    VideoView: () => React.createElement(View, { testID: "report-video" }),
  };
});

const REPORT_ID = "11111111-1111-4111-8111-111111111111";
const VOICE_ID = "22222222-2222-4222-8222-222222222222";
const PHOTO_ID = "33333333-3333-4333-8333-333333333333";
const DETAIL: ReportDetail = {
  report_id: REPORT_ID,
  report_reference: "PRK-TEST-ABCD",
  category: "road",
  state: "IN_PROGRESS",
  state_version: 3,
  created_at: "2026-10-13T09:00:00.000Z",
  captured_at: "2026-10-13T08:50:00.000Z",
  description: {
    mode: "voice",
    bilingual: true,
    transcription: "The road is damaged",
    urdu_civic_rendering: "سڑک خراب ہے",
    english_rendering: "The road needs repair",
  },
  location: {
    source: "adjusted",
    unverified: true,
    measured: { latitude: 31.5204, longitude: 74.3587 },
    reported: { latitude: 31.521, longitude: 74.359 },
    description: null,
    spoken_description: false,
  },
  evidence: [
    {
      evidence_id: PHOTO_ID,
      kind: "photo",
      mime_type: "image/jpeg",
      captured_at: "2026-10-13T08:50:00.000Z",
      duration_seconds: null,
    },
    {
      evidence_id: VOICE_ID,
      kind: "voice_original",
      mime_type: "audio/mp4",
      captured_at: "2026-10-13T08:51:00.000Z",
      duration_seconds: 30,
    },
  ],
  timeline: [
    { state: "SUBMITTED", occurred_at: "2026-10-13T09:00:00.000Z" },
    { state: "IN_PROGRESS", occurred_at: "2026-10-13T10:00:00.000Z" },
  ],
};

beforeEach(async () => {
  await setLanguage("en");
  resetExpoAudio();
});

test("shows only the owned report projection, distinct location provenance and original media", async () => {
  const fetchDetail = jest.fn(async () => ({
    ...DETAIL,
    staff_notes: "PRIVATE STAFF NOTE",
    officer_phone: "PRIVATE STAFF PHONE",
    source_asr_text: "UNCONFIRMED ASR",
    timeline: [
      ...DETAIL.timeline,
      { state: "UNKNOWN_INTERNAL_STATE", occurred_at: "2026-10-13T11:00:00.000Z" },
    ],
  }));
  const sourceForEvidence = jest.fn(async (_report: string, evidence: string) => ({
    uri: `https://example.test/media/${evidence}`,
    headers: { Authorization: "Bearer synthetic-test-token" },
  }));
  const view = await render(
    <ReportDetailScreen
      reportId={REPORT_ID}
      onBack={jest.fn()}
      fetchDetail={fetchDetail}
      sourceForEvidence={sourceForEvidence}
    />,
  );
  expect(await view.findByText("The road is damaged")).toBeTruthy();
  expect(view.getByText("The road needs repair")).toBeTruthy();
  expect(view.getByText(/31\.521000, 74\.359000/)).toBeTruthy();
  expect(view.getByText(/31\.520400, 74\.358700/)).toBeTruthy();
  expect(view.getByText(i18n.t("reportDetail.locationUnverified"))).toBeTruthy();
  expect(view.getByText(i18n.t("reportDetail.kind.photo"))).toBeTruthy();
  expect(view.getByText(i18n.t("reportDetail.kind.voice_original"))).toBeTruthy();
  expect(sourceForEvidence).toHaveBeenCalledWith(REPORT_ID, PHOTO_ID);
  expect(sourceForEvidence).toHaveBeenCalledWith(REPORT_ID, VOICE_ID);
  expect(audio.playerSource).toMatchObject({ headers: { Authorization: "Bearer synthetic-test-token" } });
  expect(view.queryByText(/PRIVATE|UNCONFIRMED|UNKNOWN_INTERNAL_STATE/)).toBeNull();
  const user = userEvent.setup();
  await user.press(view.getByRole("button", { name: i18n.t("reportDetail.play") }));
  expect(audio.plays).toBe(1);
});

test("missing and foreign report IDs produce the same screen message", async () => {
  const fetchDetail = jest.fn(async () => {
    throw new ApiError("E_NOT_FOUND", 404);
  });
  const view = await render(
    <ReportDetailScreen reportId={REPORT_ID} onBack={jest.fn()} fetchDetail={fetchDetail} />,
  );
  expect(await view.findByText(i18n.t("reportDetail.notFound"))).toBeTruthy();
  expect(view.queryByText(/PRK-TEST/)).toBeNull();
});

test("offline detail is not fabricated from the list; sharing sends only the reference", async () => {
  const share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
  const fetchDetail = jest.fn().mockRejectedValueOnce(new OfflineError()).mockResolvedValue(DETAIL);
  const view = await render(
    <ReportDetailScreen
      reportId={REPORT_ID}
      onBack={jest.fn()}
      fetchDetail={fetchDetail}
      sourceForEvidence={async () => ({ uri: "https://example.test/media", headers: {} })}
    />,
  );
  expect(await view.findByText(i18n.t("reportDetail.offline"))).toBeTruthy();
  expect(view.queryByText(/PRK-TEST/)).toBeNull();
  const user = userEvent.setup();
  await user.press(view.getByRole("button", { name: i18n.t("reportDetail.refresh") }));
  await view.findByText(i18n.t("myReports.reference", { reference: DETAIL.report_reference }));
  await user.press(view.getByRole("button", { name: i18n.t("reportDetail.shareReference") }));
  await waitFor(() => expect(share).toHaveBeenCalledWith({ message: DETAIL.report_reference }));
  share.mockRestore();
});
