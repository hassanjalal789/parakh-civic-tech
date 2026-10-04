"""Authentication routes. Each view declares its transport class (API Contract §2).

Request bodies on these routes carry phone numbers and codes, so nothing
here logs a request body (API Contract §2.1).
"""
import uuid

from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from parakh.core.errors import ApiError

from . import services
from .models import AuthSession
from .tokens import revoke, rotate_refresh


def _no_store(response: Response) -> Response:
    response["Cache-Control"] = "no-store"
    return response


def _body(request) -> dict:
    if not isinstance(request.data, dict):
        raise ApiError("E_VALIDATION", "Some information is missing or invalid.")
    return request.data


def _device_hint(request) -> str:
    hint = _body(request).get("device_hint") or ""
    if not isinstance(hint, str) or len(hint) > 128:
        raise ApiError("E_VALIDATION", "Some information is missing or invalid.")
    return hint


class PublicAuthView(APIView):
    """Transport class 1 — Public-auth. No credential; returns at most a session."""

    authentication_classes: list = []
    permission_classes = [AllowAny]


class CitizenOtpRequestView(PublicAuthView):
    """API-121 `POST /auth/citizen/otp/request`."""

    def post(self, request):
        consent = services.parse_pending_consent(_body(request))
        body = services.request_citizen_otp(
            _body(request).get("mobile_number"),
            consent,
            ip=request.META.get("REMOTE_ADDR", ""),
            device_hint=_device_hint(request),
        )
        return _no_store(Response(body, status=status.HTTP_202_ACCEPTED))


class CitizenOtpVerifyView(PublicAuthView):
    """API-122 `POST /auth/citizen/otp/verify`. Any consent fields sent here are ignored."""

    def post(self, request):
        body = services.verify_citizen_otp(_body(request).get("mobile_number"), _body(request).get("code"), _device_hint(request))
        return _no_store(Response(body, status=status.HTTP_200_OK))


class RefreshView(APIView):
    """API-003 `POST /auth/refresh`. Transport class 5 — Refresh-only (`Authorization: Bearer <refresh>`)."""

    authentication_classes: list = []
    permission_classes = [AllowAny]

    def post(self, request):
        scheme, _, token = request.headers.get("Authorization", "").partition(" ")
        if scheme.lower() != "bearer" or not token.strip():
            raise ApiError("E_REFRESH_INVALID", "Please sign in again.", 401)
        return _no_store(Response(rotate_refresh(token.strip())))


class LogoutView(APIView):
    """API-004 `POST /auth/logout` — server-side revocation of the current session."""

    def post(self, request):
        revoke(request.auth, "logout")
        return Response(status=status.HTTP_204_NO_CONTENT)


class SessionsView(APIView):
    """API-128 `GET` / `DELETE /auth/sessions` — list sessions; end one or all ("sign out everywhere")."""

    def _active(self, request):
        now = timezone.now()
        return AuthSession.objects.filter(
            subject_type=request.user.subject_type,
            subject_id=request.user.subject_id,
            revoked_at__isnull=True,
            expires_at__gt=now,
        ).order_by("-issued_at")

    def get(self, request):
        sessions = [
            {
                "session_id": str(s.id),
                "authentication_method": s.authentication_method,
                "issued_at": s.issued_at.isoformat(),
                "last_seen_at": s.last_seen_at.isoformat() if s.last_seen_at else None,
                "current": s.id == request.auth.id,
            }
            for s in self._active(request)
        ]
        return _no_store(Response({"sessions": sessions}))

    def delete(self, request):
        target = request.data.get("session_id") if isinstance(request.data, dict) else None
        sessions = self._active(request)
        if target:
            sessions = sessions.filter(id=target) if _is_uuid(target) else sessions.none()
            if not sessions.exists():
                raise ApiError("E_NOT_FOUND", "Not found.", 404)
        for session in sessions:
            revoke(session, "logout_all" if not target else "logout_session")
        return Response(status=status.HTTP_204_NO_CONTENT)


def _is_uuid(value) -> bool:
    try:
        uuid.UUID(str(value))
        return True
    except ValueError:
        return False
