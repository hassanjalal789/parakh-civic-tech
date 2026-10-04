/**
 * Client-side check of a Pakistani mobile number, mirroring the backend's
 * `normalise_pk_mobile` (FR-AUTH.5). The server remains the authority.
 */
const PK_MOBILE = /^3\d{9}$/;

export function normalisePkMobile(raw: string): string | null {
  let digits = raw.replace(/[\s\-()]/g, "");
  if (digits.startsWith("+92")) digits = digits.slice(3);
  else if (digits.startsWith("0092")) digits = digits.slice(4);
  else if (digits.startsWith("92") && digits.length === 12) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = digits.slice(1);
  return PK_MOBILE.test(digits) ? `+92${digits}` : null;
}

/** "+923001234567" -> "+92 300 *** 4567" — the only form the app ever displays. */
export function maskE164(e164: string): string {
  const national = e164.slice(3);
  return `+92 ${national.slice(0, 3)} *** ${national.slice(-4)}`;
}
