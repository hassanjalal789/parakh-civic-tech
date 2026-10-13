/**
 * The one API client. No fetch call exists outside src/api (ESLint-enforced).
 *
 * Every route declares its transport class (API Contract §2). Exactly one
 * profile applies to a request; a request that cannot be matched to its
 * profile is not sent (SRS §3.2.2). Staff profiles do not exist yet.
 */
import { endCitizenSession } from "../auth/session";
import { assertTransportAllowed, config } from "../config";
import { readAccessToken, readRefreshToken, saveCitizenTokens } from "../services/secureStorage";
import { ApiError, OfflineError, UnmatchedRequestError } from "./errors";
import { citizenHeaders, refuseActingRoleHeader } from "./interceptors/citizen";

type TransportClass = "public-auth" | "refresh-only" | "citizen";
type Method = "GET" | "POST" | "DELETE";
type Route = {
  readonly id: string;
  readonly method: Method;
  readonly path: string;
  readonly transport: TransportClass;
};

export const ROUTES = {
  citizenOtpRequest: {
    id: "API-121",
    method: "POST",
    path: "/auth/citizen/otp/request",
    transport: "public-auth",
  },
  citizenOtpVerify: {
    id: "API-122",
    method: "POST",
    path: "/auth/citizen/otp/verify",
    transport: "public-auth",
  },
  refresh: { id: "API-003", method: "POST", path: "/auth/refresh", transport: "refresh-only" },
  logout: { id: "API-004", method: "POST", path: "/auth/logout", transport: "citizen" },
  listSessions: { id: "API-128", method: "GET", path: "/auth/sessions", transport: "citizen" },
  endSessions: { id: "API-128", method: "DELETE", path: "/auth/sessions", transport: "citizen" },
  citizenProfile: { id: "API-155", method: "GET", path: "/citizen/profile", transport: "citizen" },
  // API-150: the account's own reports, plus its unsent server-side drafts (kept apart, with no reference).
  reportsList: { id: "API-150", method: "GET", path: "/citizen/reports", transport: "citizen" },
  draftStatus: {
    id: "API-133",
    method: "GET",
    path: "/citizen/drafts/{client_submission_id}",
    transport: "citizen",
  },
  // Cancellation has no API number; it is named by its path (DG-43, DG-55).
  draftCancel: {
    id: "DELETE /citizen/drafts/{id}",
    method: "DELETE",
    path: "/citizen/drafts/{client_submission_id}",
    transport: "citizen",
  },
  draftOpen: { id: "API-130", method: "POST", path: "/citizen/drafts", transport: "citizen" },
  rendering: {
    id: "API-134",
    method: "GET",
    path: "/citizen/drafts/{client_submission_id}/rendering",
    transport: "citizen",
  },
  renderingConfirm: {
    id: "API-135",
    method: "POST",
    path: "/citizen/drafts/{client_submission_id}/rendering/confirm",
    transport: "citizen",
  },
  // No API number yet: named by its path (DG-43).
  renderingCorrect: {
    id: "POST /citizen/drafts/{id}/rendering/corrections",
    method: "POST",
    path: "/citizen/drafts/{client_submission_id}/rendering/corrections",
    transport: "citizen",
  },
  evidenceChunk: {
    id: "API-131",
    method: "POST",
    path: "/citizen/drafts/{client_submission_id}/evidence",
    transport: "citizen",
  },
  evidenceComplete: {
    id: "API-132",
    method: "POST",
    path: "/citizen/drafts/{client_submission_id}/evidence/complete",
    transport: "citizen",
  },
  reportSubmit: { id: "API-140", method: "POST", path: "/citizen/reports", transport: "citizen" },
} as const satisfies Record<string, Route>;

export type RouteName = keyof typeof ROUTES;

/** API-122 and API-003 response (docs/api/CITIZEN_AUTH_IMPLEMENTATION_NOTES.md §2). */
export type TokenResponse = {
  access_token: string;
  access_expires_at: string;
  refresh_token: string;
  token_type: "Bearer";
  subject_type: "citizen";
};

type RequestOptions = {
  body?: unknown;
  headers?: Record<string, string>;
  /** Values for `{name}` placeholders in the route's path. Only UUIDs are accepted. */
  params?: Record<string, string>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/** Fills a route's path. A missing or non-UUID value is never sent (SRS §3.2.2 rule 4). */
export function pathFor(route: Route, params: Record<string, string> = {}): string {
  return route.path.replace(/\{([a-z_]+)\}/g, (_, name: string) => {
    const value = params[name];
    if (value === undefined || !UUID.test(value))
      throw new UnmatchedRequestError(`bad path parameter ${name}`);
    return value;
  });
}

async function headersFor(route: Route, extra: Record<string, string>): Promise<Record<string, string>> {
  const base = { Accept: "application/json", "Content-Type": "application/json", ...extra };
  switch (route.transport) {
    case "public-auth":
      refuseActingRoleHeader(base);
      if (Object.keys(base).some((h) => h.toLowerCase() === "authorization")) {
        throw new UnmatchedRequestError("a public-auth request carries no credential");
      }
      return base;
    case "refresh-only": {
      refuseActingRoleHeader(base);
      const refresh = await readRefreshToken();
      if (!refresh) throw new UnmatchedRequestError("no refresh token");
      return { ...base, Authorization: `Bearer ${refresh}` };
    }
    case "citizen":
      return citizenHeaders(base);
    default:
      throw new UnmatchedRequestError("unknown transport class");
  }
}

/** One network attempt. Returns the response and the credential it carried. */
async function send(
  route: Route,
  options: RequestOptions,
): Promise<{ response: Response; credential?: string }> {
  const headers = await headersFor(route, options.headers ?? {});
  const url = `${config.apiBaseUrl}${pathFor(route, options.params)}`; // throws before anything is sent
  try {
    const response = await fetch(url, {
      method: route.method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    return { response, credential: headers.Authorization };
  } catch {
    throw new OfflineError(); // never queued; the screen says so plainly
  }
}

async function parse<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = (payload as { error?: { code?: unknown } & Record<string, unknown> } | null)?.error;
    const code = typeof error?.code === "string" ? error.code : "E_UNKNOWN";
    const { code: _code, message: _message, ...details } = error ?? {};
    throw new ApiError(code, response.status, details);
  }
  return payload as T;
}

export async function request<T>(name: RouteName, options: RequestOptions = {}): Promise<T> {
  const route: Route | undefined = ROUTES[name];
  if (!route) throw new UnmatchedRequestError(`unknown route ${String(name)}`);
  assertTransportAllowed(config.apiBaseUrl, config.variant);

  const first = await send(route, options);
  if (first.response.status !== 401 || route.transport !== "citizen") return parse<T>(first.response);

  // FR-AUTH.10 / T-044: refresh once, then retry the original request once.
  await renewSession(first.credential);
  const retry = await send(route, options);
  if (retry.response.status === 401) await endCitizenSession("session_expired");
  return parse<T>(retry.response);
}

/**
 * One refresh call at a time. The server treats a second use of a rotated
 * refresh token as replay and revokes the whole token family, so concurrent
 * 401s share the call in flight, and a 401 for a token that has already been
 * replaced is simply retried. Tokens live only in secure storage.
 */
let refreshInFlight: Promise<void> | null = null;

async function renewSession(usedCredential: string | undefined): Promise<void> {
  const current = await readAccessToken();
  if (current && usedCredential !== `Bearer ${current}`) return; // already renewed by another call
  refreshInFlight ??= refreshTokens().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function refreshTokens(): Promise<void> {
  let response: Response;
  try {
    ({ response } = await send(ROUTES.refresh, {}));
  } catch (error) {
    // No refresh token stored: the session is over. Offline: keep the session.
    if (error instanceof UnmatchedRequestError) await endCitizenSession("session_expired");
    throw error;
  }
  if (response.status === 401) await endCitizenSession("session_expired");
  const tokens = await parse<TokenResponse>(response); // throws on any failure
  await saveCitizenTokens({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token });
}
