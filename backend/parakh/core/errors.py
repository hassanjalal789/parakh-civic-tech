"""Uniform error envelope: {"error": {"code": "E_...", "message": "..."}}.

Error bodies never echo submitted values (no number, code or token).
"""
from __future__ import annotations

from rest_framework import exceptions, status
from rest_framework.response import Response


class ApiError(Exception):
    def __init__(self, code: str, message: str, http_status: int = status.HTTP_400_BAD_REQUEST, **extra):
        super().__init__(code)
        self.code = code
        self.message = message
        self.http_status = http_status
        self.extra = extra

    def response(self) -> Response:
        body = {"error": {"code": self.code, "message": self.message, **self.extra}}
        return Response(body, status=self.http_status)


_MAP = {
    exceptions.NotAuthenticated: ("E_UNAUTHENTICATED", "Please sign in.", 401),
    exceptions.AuthenticationFailed: ("E_UNAUTHENTICATED", "Please sign in.", 401),
    exceptions.PermissionDenied: ("E_FORBIDDEN", "This action is not available.", 403),
    exceptions.NotFound: ("E_NOT_FOUND", "Not found.", 404),
    exceptions.MethodNotAllowed: ("E_METHOD_NOT_ALLOWED", "Method not allowed.", 405),
    exceptions.ParseError: ("E_VALIDATION", "The request could not be read.", 400),
    exceptions.ValidationError: ("E_VALIDATION", "Some information is missing or invalid.", 400),
    exceptions.UnsupportedMediaType: ("E_VALIDATION", "Unsupported request format.", 415),
}


def exception_handler(exc, context):
    if isinstance(exc, ApiError):
        return exc.response()
    for klass, (code, message, http_status) in _MAP.items():
        if isinstance(exc, klass):
            resp = Response({"error": {"code": code, "message": message}}, status=http_status)
            if http_status == 401:
                resp["WWW-Authenticate"] = "Bearer"
            return resp
    return None  # unexpected errors -> Django's 500 handler (no details leaked when DEBUG is off)
