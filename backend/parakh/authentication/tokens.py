"""Opaque bearer tokens backed by revocable server-side sessions."""
from __future__ import annotations

from datetime import timedelta
from types import SimpleNamespace

from django.conf import settings
from django.db import transaction
from django.utils import timezone
from rest_framework import authentication, exceptions

from parakh.audit.models import record
from parakh.core.errors import ApiError
from parakh.core.hashing import new_token, sha256_hex

from .models import AuthSession, RefreshTokenFamily, RotatedRefreshToken


def issue_session(subject_type: str, subject_id, method: str, device_hint_hmac: str = "") -> dict:
    now = timezone.now()
    access, refresh = new_token(), new_token()
    family = RefreshTokenFamily.objects.create(
        subject_type=subject_type,
        subject_id=subject_id,
        current_token_hash=sha256_hex(refresh),
        created_at=now,
        expires_at=now + timedelta(seconds=settings.PARAKH_REFRESH_TOKEN_TTL_SECONDS),
    )
    session = AuthSession.objects.create(
        subject_type=subject_type,
        subject_id=subject_id,
        authentication_method=method,
        access_token_hash=sha256_hex(access),
        access_expires_at=now + timedelta(seconds=settings.PARAKH_ACCESS_TOKEN_TTL_SECONDS),
        refresh_family=family,
        issued_at=now,
        expires_at=family.expires_at,
        mfa_satisfied_at=now if subject_type == "staff" else None,
        device_hint_hmac=device_hint_hmac,
        last_seen_at=now,
    )
    record("session_issued", actor_kind=subject_type, actor_account_id=subject_id, session_id=str(session.id))
    return _token_body(session, access, refresh)


def _token_body(session: AuthSession, access: str, refresh: str) -> dict:
    return {
        "access_token": access,
        "access_expires_at": session.access_expires_at.isoformat(),
        "refresh_token": refresh,
        "token_type": "Bearer",
        "subject_type": session.subject_type,
    }


def revoke(session: AuthSession, reason: str) -> None:
    now = timezone.now()
    if session.revoked_at is None:
        session.revoked_at = now
        session.revocation_reason = reason
        session.save(update_fields=["revoked_at", "revocation_reason"])
        fam = session.refresh_family
        if fam.revoked_at is None:
            fam.revoked_at = now
            fam.save(update_fields=["revoked_at"])
        record("session_revoked", actor_kind=session.subject_type, actor_account_id=session.subject_id,
               session_id=str(session.id), reason=reason)


def rotate_refresh(refresh_token: str) -> dict:
    """API-003. Replay of an already rotated token revokes the whole family.

    The outcome is decided inside the transaction and raised after it commits,
    so a replay revocation is never rolled back by the error response.
    """
    now = timezone.now()
    digest = sha256_hex(refresh_token)
    with transaction.atomic():
        family = RefreshTokenFamily.objects.select_for_update().filter(current_token_hash=digest).first()
        if family is None:
            used = RotatedRefreshToken.objects.select_related("family").filter(token_hash=digest).first()
            if used is not None and used.family.revoked_at is None:
                session = used.family.session
                revoke(session, "refresh_replay")
                record("refresh_replay_detected", actor_kind=session.subject_type, actor_account_id=session.subject_id,
                       session_id=str(session.id))
            outcome = None
        elif family.revoked_at or family.session.revoked_at or now >= family.expires_at:
            outcome = None
        else:
            session = family.session
            access, refresh = new_token(), new_token()
            RotatedRefreshToken.objects.create(token_hash=digest, family=family, rotated_at=now)
            family.current_token_hash = sha256_hex(refresh)
            family.save(update_fields=["current_token_hash"])
            session.access_token_hash = sha256_hex(access)
            session.access_expires_at = now + timedelta(seconds=settings.PARAKH_ACCESS_TOKEN_TTL_SECONDS)
            session.last_seen_at = now
            session.save(update_fields=["access_token_hash", "access_expires_at", "last_seen_at"])
            record("session_refreshed", actor_kind=session.subject_type, actor_account_id=session.subject_id,
                   session_id=str(session.id))
            outcome = _token_body(session, access, refresh)
    if outcome is None:
        raise ApiError("E_REFRESH_INVALID", "Please sign in again.", 401)
    return outcome


class BearerSessionAuthentication(authentication.BaseAuthentication):
    """`Authorization: Bearer <access token>` → an active AuthSession.

    Sets request.user to a principal with subject_type / subject_id, and
    request.auth to the AuthSession. Authorization decisions happen in views.
    """

    def authenticate(self, request):
        header = authentication.get_authorization_header(request).decode()
        if not header:
            return None
        scheme, _, token = header.partition(" ")
        if scheme.lower() != "bearer" or not token:
            raise exceptions.AuthenticationFailed()
        session = AuthSession.objects.filter(access_token_hash=sha256_hex(token.strip())).first()
        now = timezone.now()
        if session is None or session.revoked_at or now >= session.access_expires_at or now >= session.expires_at:
            raise exceptions.AuthenticationFailed()
        principal = SimpleNamespace(
            is_authenticated=True,
            subject_type=session.subject_type,
            subject_id=session.subject_id,
            acting_role_assignment_id=session.acting_role_assignment_id,
        )
        return principal, session

    def authenticate_header(self, request):
        return "Bearer"
