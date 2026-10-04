"""SMS delivery boundary.

No SMS provider is selected (DG-15). Two adapters exist, and both are
DEVELOPMENT/TEST ONLY (DG-48):

- DevelopmentConsoleSmsSender — prints a clearly labelled SIMULATED message to
  the developer's console so a code can be typed in during local work.
- TestOutboxSmsSender — keeps messages in memory for automated tests.

Neither is an SMS integration. Both refuse to load outside their environment,
and production refuses to start with either configured (settings.py and apps.py).
"""
from __future__ import annotations

import sys
from dataclasses import dataclass

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.utils.module_loading import import_string


class SmsSender:
    def send_otp(self, phone_e164: str, code: str, purpose: str) -> None:  # pragma: no cover - interface
        raise NotImplementedError


DEV_ONLY_BACKENDS = {
    "parakh.authentication.sms.DevelopmentConsoleSmsSender",
    "parakh.authentication.sms.TestOutboxSmsSender",
}


class DevelopmentConsoleSmsSender(SmsSender):
    def __init__(self):
        if settings.PARAKH_ENV != "development":
            raise ImproperlyConfigured("DevelopmentConsoleSmsSender is allowed only when PARAKH_ENV=development")

    def send_otp(self, phone_e164: str, code: str, purpose: str) -> None:
        from parakh.identity_vault.services import mask

        # Written to stderr only, never to the logging system, and only in development.
        print(f"[SIMULATED SMS — development only, nothing was sent] {purpose} code for {mask(phone_e164)}: {code}", file=sys.stderr)


@dataclass
class OutboxMessage:
    phone_e164: str
    code: str
    purpose: str


class TestOutboxSmsSender(SmsSender):
    outbox: list[OutboxMessage] = []

    def __init__(self):
        if settings.PARAKH_ENV != "test":
            raise ImproperlyConfigured("TestOutboxSmsSender is allowed only when PARAKH_ENV=test")

    def send_otp(self, phone_e164: str, code: str, purpose: str) -> None:
        TestOutboxSmsSender.outbox.append(OutboxMessage(phone_e164, code, purpose))


def get_sender() -> SmsSender:
    path = settings.PARAKH_SMS_BACKEND
    if not path:
        raise ImproperlyConfigured("PARAKH_SMS_BACKEND is not configured")
    return import_string(path)()


def check_sms_configuration(env: str, backend: str) -> None:
    """Refuse a development adapter outside development/test (called at startup)."""
    if env == "production" and (not backend or backend in DEV_ONLY_BACKENDS):
        raise ImproperlyConfigured("Production requires a real SMS backend; development adapters are refused")
