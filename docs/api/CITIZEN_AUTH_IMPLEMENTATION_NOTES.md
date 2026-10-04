# Citizen authentication — implementation notes

| Field | Value |
|---|---|
| Status | **Implemented in development and tested. The choices in §3 are PROPOSED (DG-52)** |
| Date | 2026-10-03 |
| Tasks | T-027, T-037, T-038, T-039, T-040, T-041 |
| Code | [`backend/`](../../backend/) |
| Sources | `SRS/API_CONTRACT.md` §2, §3.1, R.1, R.2 · `SRS/DATA_MODEL_AND_IDENTITY_SCHEMA.md` §4.2–§4.7 · `SRS/SCREEN_INVENTORY_AND_NAVIGATION.md` §2.1 · `SRS/TEST_CATALOGUE_IDENTITY_FOUNDATION.md` |

The API contract fixes the routes, transport classes and rules. It does not fix
the request and response bodies or the authentication error codes. This page
records what the code does, so the mobile client and later reviews have one
reference. Nothing here is an approved requirement.

## 1. Routes

| ID | Route | Transport class |
|---|---|---|
| API-121 | `POST /auth/citizen/otp/request` | Public-auth |
| API-122 | `POST /auth/citizen/otp/verify` | Public-auth |
| API-003 | `POST /auth/refresh` | Refresh-only (`Authorization: Bearer <refresh token>`) |
| API-004 | `POST /auth/logout` | Bearer |
| API-128 | `GET` / `DELETE /auth/sessions` | Bearer |
| API-155 | `GET /citizen/profile` *(PATCH not yet built)* | Citizen-authenticated |

## 2. Bodies

**API-121 request**

```json
{
  "mobile_number": "0300 1234567",
  "device_hint": "opaque install id (optional)",
  "pending_consent_ref": "client-generated id (optional)",
  "consent_version": "citizen-consent-draft-1",
  "locale": "ur",
  "consent_selections": {
    "account_creation_and_processing": true,
    "voice_processing": true,
    "sms_notification": false
  }
}
```

If `pending_consent_ref` is sent, the other three consent fields are required. Both
required consents must be `true`. The version must equal the server's current
`PARAKH_CONSENT_VERSION`. The snapshot is stored on the `OTPChallenge`.

**API-121 response — `202`, identical for every valid number:**
`{"expires_in_seconds": 300, "resend_after_seconds": 60, "code_length": 6}`

**API-122 request:** `{"mobile_number": "...", "code": "123456", "device_hint": "..."}`. Any
consent fields sent at verify time are ignored (TEST-CONSENT-007).

**API-122 / API-003 response — `200`, `Cache-Control: no-store`:**
`{"access_token", "access_expires_at", "refresh_token", "token_type": "Bearer", "subject_type": "citizen"}`.
The response does not say whether the account was created or already existed.

## 3. Choices the specifications leave open — PROPOSED (DG-52)

| # | Choice | Why |
|---|---|---|
| 1 | Error codes: `E_INVALID_NUMBER` 400 · `E_OTP_INVALID` 400 (+`attempts_remaining`) · `E_OTP_COOLDOWN` 429 · `E_RATE_LIMITED` 429 (both with `retry_after_seconds`) · `E_CONSENT_REQUIRED` 400 · `E_CONSENT_VERSION` 400 · `E_ACCOUNT_UNAVAILABLE` 403 · `E_REFRESH_INVALID` 401 · `E_UNAUTHENTICATED` 401 · `E_VALIDATION` 400 | §11 of the contract has no authentication codes |
| 2 | One `E_OTP_INVALID` for wrong, expired, consumed, superseded and unknown codes | CIT-05 requires a uniform wrong/expired message |
| 3 | Verify identifies the challenge by number + purpose (the latest one), not by a challenge id | The data model has no client-visible challenge id. A resend supersedes earlier challenges, so at most one is open |
| 4 | Consent is optional on the request, as the contract says. A **new** number verified without server-held consent gets `E_CONSENT_REQUIRED`. The challenge is consumed and nothing is created | Keeps the request path independent of registration. Possession is already proven when this answer is given |
| 5 | Returning citizens sign in without a consent payload. A consent payload sent by a returning citizen is not re-recorded | Re-consent for a new consent version is not specified yet |
| 6 | `attempts_remaining` is returned. It reveals whether a code was recently requested for a number, not whether the number is registered | CIT-05 shows attempts remaining |
| 7 | Access token 15 minutes, refresh token 30 days, refresh rotation on every use | No source value exists |
| 8 | Caps count challenges of every purpose for a number | "Per number" in DR-29 |
| 9 | `DELETE /auth/sessions` without a body ends every session. With `{"session_id": ...}` it ends one of the caller's own sessions. Anyone else's session id gets `404` | API-128 "list and end sessions" |
| 10 | A deactivated or temporarily locked account gets `E_ACCOUNT_UNAVAILABLE` after a correct code. OTP failures never change account status | DR-29: rate limiting is the control; account locking is not |

## 4. Not done here

- Staff authentication, step-up, tickets and `E_OTP_PURPOSE_MISMATCH` (no consuming ticket endpoint exists yet).
- `PATCH /citizen/profile` and consent withdrawal.
- `DeviceSession` (sessions carry only an HMAC of the optional device hint).
- Timing-class measurement for TEST-AUTH-C05. The code paths do the same work for registered and unregistered numbers, but timing was not measured.
- PostgreSQL, the separate vault schema and role, and the audit INSERT/SELECT-only role (T-023, T-028, T-029).
