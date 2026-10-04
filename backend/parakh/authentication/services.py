"""Citizen OTP sign-up / sign-in (API-121, API-122).

Server-side rules enforced here (Data Model §4.2, §4.7; API Contract §3.1, R.1, R.2):

- Six-digit code, five-minute expiry, single use, at most five attempts.
  Exhausting the attempts consumes the challenge; the account is never locked.
- Resend cooldown and per-number / per-device / per-IP caps (PROPOSED DEFAULTS,
  DG-13 — see settings.PARAKH_OTP).
- A new request supersedes the previous open challenge immediately.
- The code is stored only as a keyed hash and is never logged or audited.
- Purpose binding: the citizen verifier only ever reads `citizen_signup_login`
  challenges, so a code issued for any other purpose cannot sign a citizen in.
- Uniformity: the request path never looks up whether the number is
  registered, and every wrong / expired / unknown code gets the same error.
- Consent is held by the server on the challenge at request time; at
  verification, ConsentRecord rows are written from those server-held values
  in the same transaction that creates the account.
"""
from __future__ import annotations

import hmac
import secrets
import uuid
from dataclasses import dataclass
from datetime import timedelta

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from parakh.accounts.models import CitizenAccount, ConsentRecord
from parakh.audit.models import record
from parakh.core.errors import ApiError
from parakh.core.hashing import hmac_hex, lookup_hmac
from parakh.identity_vault import services as vault

from . import sms
from .models import AuthSession, OTPChallenge
from .tokens import issue_session

PURPOSE = OTPChallenge.Purpose.CITIZEN_SIGNUP_LOGIN
CONSENT_KEYS = (ConsentRecord.Type.ACCOUNT, ConsentRecord.Type.VOICE, ConsentRecord.Type.SMS)


def _policy(name: str) -> int:
    return settings.PARAKH_OTP[name]


def _code_hash(challenge_id, code: str) -> str:
    return hmac_hex(settings.PARAKH_OTP_HASH_KEY, f"otp:{challenge_id}:{code}")


def _new_code() -> str:
    return f"{secrets.randbelow(10 ** _policy('LENGTH')):0{_policy('LENGTH')}d}"


# --- consent payload ---------------------------------------------------------

@dataclass(frozen=True)
class PendingConsent:
    ref: str
    version: str
    locale: str
    selections: dict


def parse_pending_consent(data: dict) -> PendingConsent | None:
    """Validate the optional consent snapshot sent with the OTP request.

    The checks do not depend on whether the number is registered.
    """
    ref = data.get("pending_consent_ref")
    if ref in (None, ""):
        return None
    if not isinstance(ref, str) or len(ref) > 64:
        raise ApiError("E_VALIDATION", "Some information is missing or invalid.")
    version = data.get("consent_version")
    if version != settings.PARAKH_CONSENT_VERSION:
        raise ApiError("E_CONSENT_VERSION", "The consent text has changed. Please review it again.")
    locale = data.get("locale")
    if locale not in CitizenAccount.Language.values:
        raise ApiError("E_VALIDATION", "Some information is missing or invalid.")
    raw = data.get("consent_selections")
    if not isinstance(raw, dict) or set(raw) != set(CONSENT_KEYS) or not all(isinstance(v, bool) for v in raw.values()):
        raise ApiError("E_VALIDATION", "Some information is missing or invalid.")
    if not all(raw[k] for k in ConsentRecord.REQUIRED):
        raise ApiError("E_CONSENT_REQUIRED", "Both required consents are needed to create an account.")
    return PendingConsent(ref=ref, version=version, locale=locale, selections={k: raw[k] for k in CONSENT_KEYS})


# --- API-121 -----------------------------------------------------------------

def _rate_limited(limit: str, retry_after: int) -> ApiError:
    record("otp_rate_limited", purpose=PURPOSE, limit=limit)
    code = "E_OTP_COOLDOWN" if limit == "resend_cooldown" else "E_RATE_LIMITED"
    message = "Please wait before asking for another code." if code == "E_OTP_COOLDOWN" else "Too many requests. Please try again later."
    return ApiError(code, message, 429, retry_after_seconds=max(1, retry_after))


def request_citizen_otp(raw_number, consent: PendingConsent | None, ip: str, device_hint: str) -> dict:
    e164 = vault.normalise_pk_mobile(raw_number)
    phone_hmac = vault.phone_hmac(e164)
    ip_hmac = lookup_hmac("ip:" + ip) if ip else ""
    device_hmac = lookup_hmac("device:" + device_hint) if device_hint else ""
    now = timezone.now()
    hour_ago, day_ago = now - timedelta(hours=1), now - timedelta(days=1)

    with transaction.atomic():
        by_number = OTPChallenge.objects.filter(phone_lookup_hmac=phone_hmac)
        last = by_number.order_by("-created_at").first()
        cooldown = _policy("RESEND_COOLDOWN_SECONDS")
        error = None
        if last and (now - last.created_at).total_seconds() < cooldown:
            error = ("resend_cooldown", cooldown - int((now - last.created_at).total_seconds()))
        elif by_number.filter(created_at__gt=hour_ago).count() >= _policy("MAX_PER_NUMBER_PER_HOUR"):
            error = ("number_per_hour", 3600)
        elif by_number.filter(created_at__gt=day_ago).count() >= _policy("MAX_PER_NUMBER_PER_DAY"):
            error = ("number_per_day", 24 * 3600)
        elif device_hmac and OTPChallenge.objects.filter(device_hint_hmac=device_hmac, created_at__gt=hour_ago).count() >= _policy("MAX_PER_DEVICE_PER_HOUR"):
            error = ("device_per_hour", 3600)
        elif ip_hmac and OTPChallenge.objects.filter(request_ip_hmac=ip_hmac, created_at__gt=hour_ago).count() >= _policy("MAX_PER_IP_PER_HOUR"):
            error = ("ip_per_hour", 3600)
        if error is None:
            code = _new_code()
            challenge_id = uuid.uuid4()
            challenge = OTPChallenge.objects.create(
                id=challenge_id,
                purpose=PURPOSE,
                phone_lookup_hmac=phone_hmac,
                code_hash=_code_hash(challenge_id, code),
                created_at=now,
                expires_at=now + timedelta(seconds=_policy("TTL_SECONDS")),
                max_attempts=_policy("MAX_ATTEMPTS"),
                request_ip_hmac=ip_hmac,
                device_hint_hmac=device_hmac,
                pending_consent_ref=consent.ref if consent else "",
                consent_version=consent.version if consent else "",
                consent_selections=consent.selections if consent else {},
                consent_locale=consent.locale if consent else "",
            )
            # Resend: the previous open challenge stops working immediately.
            OTPChallenge.objects.filter(phone_lookup_hmac=phone_hmac, purpose=PURPOSE, consumed_at__isnull=True,
                                        superseded_by__isnull=True).exclude(id=challenge.id).update(superseded_by=challenge)
            record("otp_requested", purpose=PURPOSE, challenge_id=str(challenge.id), consent_held=bool(consent))
    if error is not None:
        raise _rate_limited(*error)

    sms.get_sender().send_otp(e164, code, PURPOSE)
    # Uniform body: identical for registered and unregistered numbers.
    return {
        "expires_in_seconds": _policy("TTL_SECONDS"),
        "resend_after_seconds": _policy("RESEND_COOLDOWN_SECONDS"),
        "code_length": _policy("LENGTH"),
    }


# --- API-122 -----------------------------------------------------------------

def _invalid(attempts_remaining: int) -> ApiError:
    # One error for wrong, expired, consumed, superseded and unknown codes.
    return ApiError("E_OTP_INVALID", "The code is wrong or has expired.", 400, attempts_remaining=attempts_remaining)


def verify_citizen_otp(raw_number, code, device_hint: str) -> dict:
    e164 = vault.normalise_pk_mobile(raw_number)
    if not isinstance(code, str) or len(code) != _policy("LENGTH") or not code.isdigit():
        raise ApiError("E_VALIDATION", "Some information is missing or invalid.")
    phone_hmac = vault.phone_hmac(e164)
    device_hmac = lookup_hmac("device:" + device_hint) if device_hint else ""
    now = timezone.now()

    outcome: ApiError | dict
    with transaction.atomic():
        challenge = (
            OTPChallenge.objects.select_for_update()
            .filter(phone_lookup_hmac=phone_hmac, purpose=PURPOSE)  # purpose binding
            .order_by("-created_at")
            .first()
        )
        if challenge is None or not challenge.is_open(now):
            outcome = _invalid(0)
        elif not hmac.compare_digest(challenge.code_hash, _code_hash(challenge.id, code)):
            challenge.attempts += 1
            if challenge.attempts >= challenge.max_attempts:
                challenge.locked_at = now  # consumes the challenge; the account is not locked
            challenge.save(update_fields=["attempts", "locked_at"])
            record("otp_failed", purpose=PURPOSE, challenge_id=str(challenge.id), attempts=challenge.attempts)
            outcome = _invalid(challenge.max_attempts - challenge.attempts)
        else:
            challenge.consumed_at = now
            challenge.save(update_fields=["consumed_at"])
            record("otp_verified", purpose=PURPOSE, challenge_id=str(challenge.id))
            outcome = _sign_in_or_create(challenge, e164, now, device_hmac)
    if isinstance(outcome, ApiError):
        raise outcome
    return outcome


def _sign_in_or_create(challenge: OTPChallenge, e164: str, now, device_hmac: str):
    """Runs inside the verify transaction, after the challenge is consumed."""
    credential = vault.find_credential(e164)
    if credential is None:
        if not challenge.consent_version:
            # Possession is proven, so this reveals nothing to a third party.
            return ApiError("E_CONSENT_REQUIRED", "Please review and accept the consent to create an account.", 400)
        try:
            with transaction.atomic():
                account = CitizenAccount.objects.create(created_at=now, last_seen_at=now,
                                                        preferred_language=challenge.consent_locale or CitizenAccount.Language.URDU)
                vault.create_credential(e164, account.id, verified_at=now)
                record("citizen_account_created", actor_kind="citizen", actor_account_id=account.id)
                for consent_type in CONSENT_KEYS:
                    ConsentRecord.objects.create(
                        citizen_account=account,
                        consent_type=consent_type,
                        consent_version=challenge.consent_version,
                        granted_at=now if challenge.consent_selections.get(consent_type) else None,
                        locale=challenge.consent_locale,
                    )
                record("consent_recorded", actor_kind="citizen", actor_account_id=account.id,
                       consent_version=challenge.consent_version,
                       granted=sorted(k for k, v in challenge.consent_selections.items() if v))
        except IntegrityError:
            # A concurrent verification created the account first: sign in instead.
            credential = vault.find_credential(e164)
            account = CitizenAccount.objects.get(id=credential.citizen_account_id)
    else:
        account = CitizenAccount.objects.get(id=credential.citizen_account_id)
        if account.status != CitizenAccount.Status.ACTIVE:
            return ApiError("E_ACCOUNT_UNAVAILABLE", "This account cannot sign in. Please contact support.", 403)
        account.last_seen_at = now
        account.save(update_fields=["last_seen_at"])
        record("citizen_signed_in", actor_kind="citizen", actor_account_id=account.id)
    return issue_session("citizen", account.id, AuthSession.Method.CITIZEN_OTP, device_hmac)
