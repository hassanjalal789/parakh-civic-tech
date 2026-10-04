import { readAccessToken } from "../../services/secureStorage";
import { UnmatchedRequestError } from "../errors";

export const ACTING_ROLE_HEADER = "x-acting-role-assignment-id";

/** Throws if a caller tries to attach the staff-only acting-role header. */
export function refuseActingRoleHeader(headers: Record<string, string>): void {
  if (Object.keys(headers).some((name) => name.toLowerCase() === ACTING_ROLE_HEADER)) {
    throw new UnmatchedRequestError("a citizen or public request may not carry X-Acting-Role-Assignment-ID");
  }
}

/**
 * The `citizen` profile (SRS §3.2.2): `Authorization: Bearer <token>`, read
 * from secure storage at request time. It never sends an acting-role header.
 */
export async function citizenHeaders(headers: Record<string, string>): Promise<Record<string, string>> {
  refuseActingRoleHeader(headers);
  const token = await readAccessToken();
  if (!token) {
    throw new UnmatchedRequestError("no citizen session");
  }
  return { ...headers, Authorization: `Bearer ${token}` };
}
