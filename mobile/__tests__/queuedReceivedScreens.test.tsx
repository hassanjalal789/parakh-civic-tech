/**
 * T-062 — CIT-12, waiting to send (FR-PUB.29; DG-55, DG-84), and CIT-13, received
 * (FR-PUB.30; DG-85). The draft store is the fake SQLite; the server is a stand-in.
 */
import { render, screen, userEvent, waitFor } from "@testing-library/react-native";
import { AccessibilityInfo } from "react-native";

import i18n, { setLanguage } from "../src/i18n";
import { QueuedScreen } from "../src/screens/QueuedScreen";
import { ReceivedScreen } from "../src/screens/ReceivedScreen";
import { receivedReference, rememberReceived } from "../src/services/received";
import { submissionQueue, type SubmissionResult } from "../src/services/submissionQueue";
import { draftRepository, type DraftRepository } from "../src/storage/drafts";
import { migrate } from "../src/storage/schema";
import { resetFileSystem } from "./fakes/fileSystem";
import { memoryDatabase, resetSqlite } from "./fakes/sqlite";

jest.mock("expo-file-system", () => jest.requireActual("./fakes/fileSystem"));
jest.mock("expo-sqlite", () => jest.requireActual("./fakes/sqlite"));

const ACCOUNT = "11111111-1111-4111-8111-111111111111"; // synthetic
const REFERENCE = "PRK-7Q4M-2KX9"; // synthetic
const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);

let drafts: DraftRepository;
let id: string;
let announce: jest.SpyInstance;
let queue: { retryNow: jest.Mock; cancel: jest.Mock };
let onReceived: jest.Mock;
let onHome: jest.Mock;

const result = (r: SubmissionResult) => jest.fn(async () => r);

beforeEach(async () => {
  await setLanguage("en");
  resetFileSystem();
  resetSqlite();
  const db = memoryDatabase();
  await migrate(db);
  drafts = draftRepository(db, ACCOUNT);
  id = (await drafts.create()).client_submission_id;
  await drafts.update(id, { pipeline_state: "READY_TO_SUBMIT" });
  await drafts.recordSubmit(id, "44444444-4444-4444-8444-444444444444");
  await drafts.update(id, { submission_outcome: "unknown", last_error: "E_OFFLINE" });
  queue = { retryNow: jest.fn(), cancel: jest.fn() };
  onReceived = jest.fn();
  onHome = jest.fn();
  announce = jest.spyOn(AccessibilityInfo, "announceForAccessibility").mockImplementation(() => undefined);
});

afterEach(() => jest.restoreAllMocks());

const showQueued = () =>
  render(
    <QueuedScreen
      drafts={drafts}
      draftId={id}
      queue={queue}
      onReceived={onReceived}
      onHome={onHome}
      refreshMs={20}
    />,
  );

describe("CIT-12: waiting to send (FR-PUB.29)", () => {
  test("named and announced; no reference anywhere; no claim of receipt", async () => {
    await showQueued();
    await waitFor(() => expect(screen.getByText(t("queued.lastError"))).toBeTruthy());
    expect(screen.getByText(t("queued.title"))).toBeTruthy();
    expect(announce).toHaveBeenCalledWith(t("queued.status"));
    expect(screen.queryByText(/PRK-/)).toBeNull();
    expect(screen.getByText(t("queued.notSent"))).toBeTruthy();
  });

  test("only Retry and Cancel — there is no Edit (DG-84)", async () => {
    await showQueued();
    await waitFor(() => expect(screen.getByRole("button", { name: t("queued.retry") })).toBeEnabled());
    expect(screen.getAllByRole("button").map((b) => b.props.accessibilityLabel)).toEqual([
      t("queued.retry"),
      t("queued.cancel"),
    ]);
    expect(screen.queryByText(/edit|change/i)).toBeNull();
    expect(screen.queryByRole("textbox")).toBeNull();
  });

  test("Retry: when the server creates the report, CIT-13 opens with its reference", async () => {
    queue.retryNow = result({ kind: "submitted", reportId: "r-1", reportReference: REFERENCE });
    await showQueued();
    await waitFor(() => expect(screen.getByRole("button", { name: t("queued.retry") })).toBeEnabled());
    await userEvent.setup().press(screen.getByRole("button", { name: t("queued.retry") }));
    await waitFor(() => expect(onReceived).toHaveBeenCalledWith(REFERENCE));
    expect(queue.retryNow).toHaveBeenCalledWith(id);
  });

  test("Retry still not sent: said so, and still no reference", async () => {
    queue.retryNow = result({
      kind: "retrying",
      outcome: "unknown",
      code: "E_OFFLINE",
      nextAttemptAt: new Date().toISOString(),
    });
    await showQueued();
    await waitFor(() => expect(screen.getByRole("button", { name: t("queued.retry") })).toBeEnabled());
    await userEvent.setup().press(screen.getByRole("button", { name: t("queued.retry") }));
    await waitFor(() => expect(screen.getByText(t("queued.stillWaiting"))).toBeTruthy());
    expect(onReceived).not.toHaveBeenCalled();
    expect(screen.queryByText(/PRK-/)).toBeNull();
  });

  test("Cancel asks first; confirmed, the report is cancelled and Home opens", async () => {
    queue.cancel = result({ kind: "cancelled" });
    await showQueued();
    await waitFor(() => expect(screen.getByRole("button", { name: t("queued.cancel") })).toBeEnabled());
    const user = userEvent.setup();
    await user.press(screen.getByRole("button", { name: t("queued.cancel") }));
    expect(screen.getByText(t("queued.cancelAsk"))).toBeTruthy();
    expect(queue.cancel).not.toHaveBeenCalled();
    await user.press(screen.getByRole("button", { name: t("queued.cancelYes") }));
    await waitFor(() => expect(onHome).toHaveBeenCalled());
    expect(queue.cancel).toHaveBeenCalledWith(id);
  });

  test("Cancel after the report exists shows its reference instead of a cancellation (DG-55)", async () => {
    queue.cancel = result({ kind: "already_submitted", reportId: "r-1", reportReference: REFERENCE });
    await showQueued();
    await waitFor(() => expect(screen.getByRole("button", { name: t("queued.cancel") })).toBeEnabled());
    const user = userEvent.setup();
    await user.press(screen.getByRole("button", { name: t("queued.cancel") }));
    await user.press(screen.getByRole("button", { name: t("queued.cancelYes") }));
    await waitFor(() => expect(onReceived).toHaveBeenCalledWith(REFERENCE));
    expect(onHome).not.toHaveBeenCalled();
  });

  test("sent by the background queue while open: CIT-13 opens with the server's reference", async () => {
    const api = {
      fetchDraftStatus: jest.fn(async () => "active" as const),
      submitReport: jest.fn(async () => ({ report_id: "r-2", report_reference: REFERENCE })),
      cancelDraftOnServer: jest.fn(),
    };
    const real = submissionQueue(drafts, api as never);
    await showQueued();
    await waitFor(() => expect(screen.getByText(t("queued.title"))).toBeTruthy());
    expect(await real.retryNow(id)).toMatchObject({ kind: "submitted", reportReference: REFERENCE });
    expect(receivedReference(id)).toBe(REFERENCE); // set by the queue from the server's answer
    await waitFor(() => expect(onReceived).toHaveBeenCalledWith(REFERENCE));
  });
});

describe("CIT-13: received (FR-PUB.30, DG-85)", () => {
  test("received successfully, the reference and the My Reports message — and nothing else", async () => {
    const home = jest.fn();
    await render(<ReceivedScreen reportReference={REFERENCE} onHome={home} />);
    expect(screen.getByText(t("received.body"))).toBeTruthy();
    expect(screen.getByText(t("received.track"))).toBeTruthy();
    expect(t("received.track")).toBe("You can track its status in My Reports.");
    const reference = screen.getByTestId("report-reference");
    expect(reference).toHaveTextContent(REFERENCE);
    expect(reference.props.selectable).toBe(true);
    expect(reference.props.accessibilityLabel).toBe(t("received.referenceLabel", { reference: REFERENCE }));
    expect(announce).toHaveBeenCalledWith(expect.stringContaining(REFERENCE));
    // No expected response time, resolution time, SLA or other timeframe (DG-85).
    expect(JSON.stringify(screen.toJSON())).not.toMatch(/hour|day|week|minute|SLA|within|expect|resolv/i);
    await userEvent.setup().press(screen.getByRole("button", { name: t("received.home") }));
    expect(home).toHaveBeenCalled();
  });

  test("in Urdu the reference stays left-to-right, and no timeframe appears", async () => {
    await setLanguage("ur");
    await render(<ReceivedScreen reportReference={REFERENCE} onHome={jest.fn()} />);
    const reference = screen.getByTestId("report-reference");
    expect(reference.props.style).toEqual(expect.objectContaining({ writingDirection: "ltr" }));
    expect(screen.getByText(i18n.t("received.track"))).toBeTruthy();
    expect(JSON.stringify(screen.toJSON())).not.toMatch(/گھنٹ|دن|ہفت|منٹ/);
  });

  test("a reference exists for CIT-13 only once the server returned one", () => {
    const other = "55555555-5555-4555-8555-555555555555";
    expect(receivedReference(other)).toBeNull();
    rememberReceived(other, REFERENCE);
    expect(receivedReference(other)).toBe(REFERENCE);
  });
});
