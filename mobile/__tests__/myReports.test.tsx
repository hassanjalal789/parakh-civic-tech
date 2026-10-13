/**
 * T-063 — CIT-14, My Reports (FR-PUB.31; SRS §4.1.4). The draft store is the fake SQLite; the server's list
 * is a stand-in. All data is synthetic.
 */
import { render, screen, userEvent, waitFor, within } from "@testing-library/react-native";

import { OfflineError } from "../src/api/errors";
import type { ReportSummary } from "../src/api/reporting";
import { runCitizenSessionTeardown } from "../src/auth/session";
import { buildRows, civicStatus } from "../src/domain/myReports";
import i18n, { setLanguage } from "../src/i18n";
import { MyReportsScreen } from "../src/screens/MyReportsScreen";
import { cachedReports, rememberReports } from "../src/services/reportsCache";
import { submissionQueue } from "../src/services/submissionQueue";
import { draftRepository, type DraftRepository } from "../src/storage/drafts";
import { migrate } from "../src/storage/schema";
import { resetFileSystem } from "./fakes/fileSystem";
import { memoryDatabase, resetSqlite } from "./fakes/sqlite";

jest.mock("expo-file-system", () => jest.requireActual("./fakes/fileSystem"));
jest.mock("expo-sqlite", () => jest.requireActual("./fakes/sqlite"));

const ACCOUNT = "11111111-1111-4111-8111-111111111111"; // synthetic
const OTHER = "22222222-2222-4222-8222-222222222222"; // synthetic
const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);
const report = (n: number, state = "SUBMITTED", day = n): ReportSummary => ({
  report_id: `0000f00d-0000-4000-8000-00000000000${n}`,
  report_reference: `PRK-TEST-000${n}`,
  category: n % 2 ? "water" : "road",
  state,
  state_version: 1,
  created_at: `2026-10-0${day}T09:00:00.000Z`,
  captured_at: `2026-10-0${day}T08:50:00.000Z`,
});

let drafts: DraftRepository;
let handlers: { onOpenWaiting: jest.Mock; onContinueDraft: jest.Mock; onHome: jest.Mock };

async function pending(category = "drainage") {
  const id = (await drafts.create()).client_submission_id;
  await drafts.update(id, { category, pipeline_state: "READY_TO_SUBMIT" });
  await drafts.recordSubmit(id, "44444444-4444-4444-8444-444444444444");
  return id;
}
async function saved(category = "waste") {
  const id = (await drafts.create()).client_submission_id;
  await drafts.update(id, { category });
  return id;
}
const show = (fetchReports: () => Promise<ReportSummary[]>, account = ACCOUNT) =>
  render(<MyReportsScreen drafts={drafts} accountId={account} fetchReports={fetchReports} {...handlers} />);

beforeEach(async () => {
  await setLanguage("en");
  resetFileSystem();
  resetSqlite();
  const db = memoryDatabase();
  await migrate(db);
  drafts = draftRepository(db, ACCOUNT);
  handlers = { onOpenWaiting: jest.fn(), onContinueDraft: jest.fn(), onHome: jest.fn() };
  await runCitizenSessionTeardown(); // no list remembered from another test
});

describe("My Reports: what each state is called (SRS §4.1.4)", () => {
  test("every civic state has its approved label and a picture; an unknown one is shown as Received, never as a code", () => {
    const states = [
      ["SUBMITTED", "Received"],
      ["UNDER_VERIFICATION", "Being checked"],
      ["VERIFIED", "Being checked"],
      ["UC_REVIEW", "Being checked"],
      ["ACCEPTED", "Accepted for action"],
      ["CONTRACTOR_ASSIGNED", "Work arranged"],
      ["IN_PROGRESS", "Work started"],
      ["COMPLETION_SUBMITTED", "Work reported done"],
      ["COMPLETION_VERIFICATION", "Being confirmed"],
      ["PENDING_CITIZEN_CONFIRMATION", "Your answer needed"],
      ["RESOLVED_CONFIRMED", "Fixed"],
      ["CLOSED", "Closed"],
      ["REOPENED", "Being looked at again"],
      ["REJECTED", "Not taken forward"],
      ["CANCELLED", "Cancelled"],
    ] as const;
    for (const [state, english] of states) {
      const { label, icon } = civicStatus(state);
      expect(t(`myReports.status.${label}`)).toBe(english);
      expect(icon.length).toBeGreaterThan(0);
    }
    expect(t(`myReports.status.${civicStatus("SOMETHING_NEW").label}`)).toBe("Received");
  });

  test("the Urdu labels are the approved ones", async () => {
    await setLanguage("ur");
    expect(i18n.t("myReports.status.received")).toBe("موصول ہو گئی");
    expect(i18n.t("myReports.status.answerNeeded")).toBe("آپ کا جواب درکار ہے");
    expect(i18n.t("myReports.waiting")).toBe("بھیجنے کا انتظار");
  });
});

describe("My Reports: the three kinds of row (FR-PUB.31)", () => {
  test("a pending submission, an unfinished draft and sent reports are listed apart; only sent ones carry a reference", async () => {
    const waitingId = await pending();
    const draftId = await saved();
    await show(async () => [report(1, "IN_PROGRESS", 1), report(2, "PENDING_CITIZEN_CONFIRMATION", 2)]);
    await screen.findByText(t("myReports.reportsHeading"));
    for (const h of ["waitingHeading", "draftHeading", "reportsHeading"]) {
      expect(screen.getByRole("header", { name: t(`myReports.${h}`) })).toBeTruthy();
    }
    const [waitingRow] = screen.getAllByTestId("row-pending");
    expect(within(waitingRow!).getByText(t("myReports.waiting"))).toBeTruthy();
    expect(within(waitingRow!).getByText(t("myReports.noReference"))).toBeTruthy();
    expect(within(waitingRow!).queryByText(/PRK-/)).toBeNull(); // nothing says the authority has it
    const [draftRow] = screen.getAllByTestId("row-draft");
    expect(within(draftRow!).getByText(t("myReports.draft"))).toBeTruthy();
    expect(within(draftRow!).queryByText(/PRK-/)).toBeNull();
    const sent = screen.getAllByTestId("row-report");
    expect(sent).toHaveLength(2);
    // newest first, each with the reference, the category, a plain-language status and the date
    expect(within(sent[0]!).getByText(t("myReports.reference", { reference: "PRK-TEST-0002" }))).toBeTruthy();
    expect(within(sent[0]!).getByText(t("myReports.status.answerNeeded"))).toBeTruthy();
    expect(
      within(sent[0]!).getByText(t("myReports.category", { category: t("category.road") })),
    ).toBeTruthy();
    expect(within(sent[0]!).getByText(/^Date: /)).toBeTruthy();
    expect(within(sent[1]!).getByText(t("myReports.status.workStarted"))).toBeTruthy();
    expect(waitingId).not.toBe(draftId);
  });

  test("no state code is ever shown, and every status is a word beside a picture", async () => {
    await show(async () => [report(1, "COMPLETION_VERIFICATION"), report(2, "UC_REVIEW")]);
    await screen.findByText(t("myReports.reportsHeading"));
    expect(screen.queryByText(/_/)).toBeNull(); // no UNDER_VERIFICATION-style code anywhere
    for (const row of screen.getAllByTestId("row-report")) {
      expect(within(row).getByText(/^(Being confirmed|Being checked)$/)).toBeTruthy(); // the word
      const picture = civicStatus(
        row.props.accessibilityLabel.startsWith("Being confirmed") ? "COMPLETION_VERIFICATION" : "UC_REVIEW",
      ).icon;
      expect(within(row).getByText(picture, { includeHiddenElements: true })).toBeTruthy(); // and a picture beside it
    }
    const first = screen.getAllByTestId("row-report")[0]!;
    expect(first.props.accessibilityLabel).toMatch(/Being (confirmed|checked)\. Reference PRK-TEST/);
  });

  test("a submission that is being cancelled, or refused, says so; a confirmed one is only listed as a report", async () => {
    const id = await pending("water");
    await drafts.update(id, { cancel_requested_at: "2026-10-11T10:00:00.000Z" });
    const refused = await pending("road");
    await drafts.update(refused, { submission_outcome: "rejected", last_error: "E_X" });
    const done = await pending("waste");
    await drafts.update(done, { report_reference: "PRK-TEST-0009" }); // the server confirmed it
    await show(async () => []);
    await screen.findByText(t("myReports.waitingHeading"));
    expect(screen.getByText(t("myReports.cancelling"))).toBeTruthy();
    expect(screen.getByText(t("myReports.notSentTryAgain"))).toBeTruthy();
    expect(screen.getAllByTestId("row-pending")).toHaveLength(2);
  });

  test("a waiting submission opens CIT-12, an unfinished draft goes on at CIT-08, a sent report is not opened here", async () => {
    const waitingId = await pending();
    const draftId = await saved();
    await show(async () => [report(1)]);
    await screen.findByText(t("myReports.reportsHeading"));
    const user = userEvent.setup();
    await user.press(screen.getByTestId("row-pending"));
    expect(handlers.onOpenWaiting).toHaveBeenCalledWith(waitingId);
    await user.press(screen.getByTestId("row-draft"));
    expect(handlers.onContinueDraft).toHaveBeenCalledWith(draftId);
    expect(screen.getByTestId("row-report").props.accessibilityRole).not.toBe("button");
    await user.press(screen.getByRole("button", { name: t("myReports.back") }));
    expect(handlers.onHome).toHaveBeenCalled();
  });

  test("nothing yet: it says so; a failure that is not a lost connection is said plainly", async () => {
    await show(async () => []);
    expect(await screen.findByText(t("myReports.empty"))).toBeTruthy();
    await screen.unmount();
    await show(async () => {
      throw new Error("boom");
    });
    expect(await screen.findByText(t("myReports.failed"))).toBeTruthy();
  });
});

describe("My Reports: with no connection (FR-PUB.31)", () => {
  test("the list last seen is shown, plus what is waiting on the phone, and the screen says so", async () => {
    await show(async () => [report(1), report(2)]); // seen online once
    await screen.findByText(t("myReports.reportsHeading"));
    await screen.unmount();
    await pending();
    await show(async () => {
      throw new OfflineError();
    });
    expect(await screen.findByText(t("myReports.offline"))).toBeTruthy();
    expect(screen.getAllByTestId("row-report")).toHaveLength(2);
    expect(screen.getAllByTestId("row-pending")).toHaveLength(1);
  });

  test("never seen online and nothing on the phone: it says so instead of showing an empty list as if it were complete", async () => {
    await show(async () => {
      throw new OfflineError();
    });
    expect(await screen.findByText(t("myReports.offlineNothing"))).toBeTruthy();
    expect(screen.queryByText(t("myReports.empty"))).toBeNull();
  });

  test("the remembered list belongs to one account, lives in memory, and is gone when the session ends", async () => {
    rememberReports(ACCOUNT, [report(1)]);
    expect(cachedReports(ACCOUNT)?.reports).toHaveLength(1);
    expect(cachedReports(OTHER)).toBeNull();
    await show(async () => {
      throw new OfflineError();
    }, OTHER);
    expect(await screen.findByText(t("myReports.offlineNothing"))).toBeTruthy(); // not another account's list
    await runCitizenSessionTeardown();
    expect(cachedReports(ACCOUNT)).toBeNull();
  });

  test("it works in Urdu too", async () => {
    await setLanguage("ur");
    await pending();
    await show(async () => [report(1, "REOPENED")]);
    expect(await screen.findByText(i18n.t("myReports.status.lookedAtAgain"))).toBeTruthy();
    expect(screen.getByRole("header", { name: i18n.t("myReports.waitingHeading") })).toBeTruthy();
  });
});

describe("My Reports: rows are built from what is there", () => {
  test("pending first, then drafts, then reports; the server's own unsent drafts are not duplicated by the phone's copies", async () => {
    const rows = buildRows([report(1, "SUBMITTED", 1), report(2, "SUBMITTED", 3)], []);
    expect(rows.map((r) => r.kind === "report" && r.reference)).toEqual(["PRK-TEST-0002", "PRK-TEST-0001"]);
    await pending();
    await saved();
    const local = await drafts.list();
    expect(buildRows([report(1)], local).map((r) => r.kind)).toEqual(["pending", "draft", "report"]);
  });

  test("a queue that sends a waiting submission turns its row into a report on the next look", async () => {
    const id = await pending();
    const queue = submissionQueue(drafts, {
      fetchDraftStatus: jest.fn(async () => "active" as const),
      submitReport: jest.fn(async () => ({ report_id: "r-9", report_reference: "PRK-TEST-0009" })),
      cancelDraftOnServer: jest.fn(),
    } as never);
    expect(await queue.retryNow(id)).toMatchObject({ kind: "submitted" });
    await show(async () => [{ ...report(9), report_reference: "PRK-TEST-0009" }]);
    await waitFor(() =>
      expect(screen.getByText(t("myReports.reference", { reference: "PRK-TEST-0009" }))).toBeTruthy(),
    );
    expect(screen.queryByTestId("row-pending")).toBeNull();
  });
});
