/**
 * The device's calls about its own submissions (API-133, API-140, draft
 * cancellation; docs/api/CITIZEN_REPORTING_CONTRACT.md §3–§6).
 */
import { pathFor, request, ROUTES } from "../src/api/client";
import { ApiError, ERROR_ACTIONS, OfflineError, UnmatchedRequestError } from "../src/api/errors";
import { cancelDraftOnServer, fetchDraftStatus, submitReport } from "../src/api/reporting";
import { config } from "../src/config";
import { classifyFailure } from "../src/domain/submissionRules";
import { saveCitizenTokens } from "../src/services/secureStorage";
import { jsonResponse, lastRequest, mockFetch, secureStoreContents } from "./helpers";

const DRAFT = "3f1c9a52-0b7e-4d0a-9d1e-5b2f6c7a8e90"; // synthetic
const KEY = "0000eeee-0000-4000-8000-000000000001";

function error(status: number, code: string, extra: Record<string, unknown> = {}) {
  return jsonResponse(status, { error: { code, message: "synthetic", ...extra } });
}

beforeEach(async () => {
  secureStoreContents().clear();
  await saveCitizenTokens({ accessToken: "synthetic-access", refreshToken: "synthetic-refresh" });
});

describe("paths are filled only with UUIDs (SRS §3.2.2 rule 4)", () => {
  test("a draft id becomes the path", () => {
    expect(pathFor(ROUTES.draftStatus, { client_submission_id: DRAFT })).toBe(`/citizen/drafts/${DRAFT}`);
  });

  test.each([
    ["missing", {}],
    ["not a UUID", { client_submission_id: "../reports" }],
  ])("a %s value is never sent", async (_case, params) => {
    const fetch = mockFetch(jsonResponse(200, {}));
    expect(() => pathFor(ROUTES.draftStatus, params as Record<string, string>)).toThrow(
      UnmatchedRequestError,
    );
    await expect(request("draftStatus", { params: params as Record<string, string> })).rejects.toBeInstanceOf(
      UnmatchedRequestError,
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe("API-133: the status of a draft", () => {
  test("returns the server's lifecycle, as the signed-in citizen", async () => {
    const fetch = mockFetch(jsonResponse(200, { client_submission_id: DRAFT, lifecycle: "submitted" }));
    expect(await fetchDraftStatus(DRAFT)).toBe("submitted");
    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${config.apiBaseUrl}/citizen/drafts/${DRAFT}`);
    expect(init.method).toBe("GET");
    expect(init.headers.Authorization).toBe("Bearer synthetic-access");
  });

  test("the uniform not-found answer means the server never received the draft", async () => {
    mockFetch(error(404, "E_NOT_FOUND"));
    expect(await fetchDraftStatus(DRAFT)).toBe("absent");
  });

  test("no network is an error, never an answer", async () => {
    mockFetch(new TypeError("Network request failed"));
    await expect(fetchDraftStatus(DRAFT)).rejects.toBeInstanceOf(OfflineError);
  });
});

describe("API-140: submission", () => {
  test("sends the draft id and its one submission key", async () => {
    const report = { report_id: "r", report_reference: "PRK-7Q2X-91KD", state: "SUBMITTED", created_at: "x" };
    const fetch = mockFetch(jsonResponse(201, report));
    expect(await submitReport(DRAFT, KEY)).toEqual(report);
    const { url, init } = lastRequest(fetch);
    expect(url).toBe(`${config.apiBaseUrl}/citizen/reports`);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body as string)).toEqual({ client_submission_id: DRAFT });
    expect(init.headers["X-Submission-Idempotency-Key"]).toBe(KEY);
  });
});

describe("cancelling a draft on the server", () => {
  test("204 is a cancellation", async () => {
    const fetch = mockFetch(jsonResponse(204, null));
    expect(await cancelDraftOnServer(DRAFT)).toEqual({ kind: "cancelled" });
    expect(lastRequest(fetch).init.method).toBe("DELETE");
    expect(lastRequest(fetch).url).toBe(`${config.apiBaseUrl}/citizen/drafts/${DRAFT}`);
  });

  test("too late: the report exists, and its reference comes back", async () => {
    mockFetch(error(409, "E_ALREADY_SUBMITTED", { report_id: "r-1", report_reference: "PRK-7Q2X-91KD" }));
    expect(await cancelDraftOnServer(DRAFT)).toEqual({
      kind: "already_submitted",
      reportId: "r-1",
      reportReference: "PRK-7Q2X-91KD",
    });
  });

  test("a draft the server never had has nothing to cancel", async () => {
    mockFetch(error(404, "E_NOT_FOUND"));
    expect(await cancelDraftOnServer(DRAFT)).toEqual({ kind: "cancelled" });
  });

  test("an 'already submitted' answer without its reference is not trusted", async () => {
    mockFetch(error(409, "E_ALREADY_SUBMITTED"));
    await expect(cancelDraftOnServer(DRAFT)).rejects.toThrow(/report_id/);
  });
});

describe("what a failed call means for the submission", () => {
  test.each([
    ["no network", "unknown", new OfflineError()],
    ["a gateway error", "unknown", new ApiError("E_UNKNOWN", 502)],
    ["an unreadable answer", "unknown", new Error("unreadable")],
    ["a request never sent", "failed", new UnmatchedRequestError("no session")],
    ["E_RATE_LIMITED", "failed", new ApiError("E_RATE_LIMITED", 429)],
    ["E_UNAUTHENTICATED", "failed", new ApiError("E_UNAUTHENTICATED", 401)],
    ["E_DRAFT_CANCELLED", "cancelled", new ApiError("E_DRAFT_CANCELLED", 409)],
    ["E_DRAFT_EXPIRED", "needs_upload", new ApiError("E_DRAFT_EXPIRED", 409)],
    ["E_UPLOAD_INCOMPLETE", "needs_upload", new ApiError("E_UPLOAD_INCOMPLETE", 409)],
    ["E_NOT_FOUND", "needs_upload", new ApiError("E_NOT_FOUND", 404)],
    ["E_RENDERING_INCOMPLETE", "rejected", new ApiError("E_RENDERING_INCOMPLETE", 409)],
    ["E_RENDERING_NOT_CONFIRMED", "rejected", new ApiError("E_RENDERING_NOT_CONFIRMED", 422)],
    ["E_EVIDENCE_REQUIRED", "rejected", new ApiError("E_EVIDENCE_REQUIRED", 422)],
    ["E_IDEMPOTENCY_CONFLICT", "rejected", new ApiError("E_IDEMPOTENCY_CONFLICT", 409)],
  ] as const)("%s → %s", (_label, outcome, failure) => {
    expect(classifyFailure(failure).outcome).toBe(outcome);
  });

  test("a wait the server asks for is kept", () => {
    expect(classifyFailure(new ApiError("E_RATE_LIMITED", 429, { retry_after_seconds: 90 }))).toEqual({
      outcome: "failed",
      code: "E_RATE_LIMITED",
      retryAfterSeconds: 90,
    });
  });

  test("every reporting code has a client action (R-007's code included)", () => {
    for (const code of [
      "E_RENDERING_INCOMPLETE",
      "E_UPLOAD_INCOMPLETE",
      "E_DRAFT_EXPIRED",
      "E_DRAFT_CANCELLED",
    ]) {
      expect(ERROR_ACTIONS[code]).toBeDefined();
    }
    expect(new ApiError("E_RENDERING_INCOMPLETE", 409).action).toBe("refetch_rendering");
  });
});
