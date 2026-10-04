/**
 * The one API client. No fetch call exists outside src/api (ESLint-enforced).
 *
 * Every route declares its transport class (API Contract §2). Exactly one
 * profile applies to a request; a request that cannot be matched to its
 * profile is not sent (SRS §3.2.2). Staff profiles do not exist yet.
 */
import { assertTransportAllowed, config } from "../config";
import { readRefreshToken } from "../services/secureStorage";
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
} as const satisfies Record<string, Route>;

export type RouteName = keyof typeof ROUTES;

type RequestOptions = { body?: unknown; headers?: Record<string, string> };

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

export async function request<T>(name: RouteName, options: RequestOptions = {}): Promise<T> {
  const route: Route | undefined = ROUTES[name];
  if (!route) throw new UnmatchedRequestError(`unknown route ${String(name)}`);
  assertTransportAllowed(config.apiBaseUrl, config.variant);
  const headers = await headersFor(route, options.headers ?? {});

  let response: Response;
  try {
    response = await fetch(`${config.apiBaseUrl}${route.path}`, {
      method: route.method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new OfflineError(); // never queued; the screen says so plainly
  }

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
