"""Shared fixtures. All numbers are synthetic; no real citizen data is used."""
from datetime import UTC, datetime, timedelta
from unittest import mock

from django.conf import settings
from django.test import TestCase, TransactionTestCase
from rest_framework.test import APIClient

from parakh.authentication.sms import TestOutboxSmsSender

NUMBER = "0300 1234567"  # synthetic
E164 = "+923001234567"
OTHER_NUMBER = "03119876543"  # synthetic


class AuthTestMixin:
    """The fixtures, usable on TestCase or, where a test must run migrations, TransactionTestCase."""

    def setUp(self):
        super().setUp()
        TestOutboxSmsSender.outbox.clear()
        self.now = datetime(2026, 10, 3, 9, 0, tzinfo=UTC)
        clock = mock.patch("django.utils.timezone.now", side_effect=lambda: self.now)
        clock.start()
        self.addCleanup(clock.stop)
        self.api = APIClient()

    def advance(self, seconds: float) -> None:
        self.now += timedelta(seconds=seconds)

    @staticmethod
    def consent(sms: bool = False, **overrides) -> dict:
        body = {
            "pending_consent_ref": "3f1c9a52-0b7e-4d0a-9d1e-5b2f6c7a8e90",
            "consent_version": settings.PARAKH_CONSENT_VERSION,
            "locale": "ur",
            "consent_selections": {
                "account_creation_and_processing": True,
                "voice_processing": True,
                "sms_notification": sms,
            },
        }
        body.update(overrides)
        return body

    def request_otp(self, number=NUMBER, with_consent=True, sms=False, ip="127.0.0.1", **extra):
        body = {"mobile_number": number, **(self.consent(sms) if with_consent else {}), **extra}
        return self.api.post("/auth/citizen/otp/request", body, format="json", REMOTE_ADDR=ip)

    @staticmethod
    def last_code() -> str:
        return TestOutboxSmsSender.outbox[-1].code

    @staticmethod
    def wrong(code: str) -> str:
        return f"{(int(code) + 1) % 1_000_000:06d}"

    def verify(self, code, number=NUMBER, **extra):
        return self.api.post("/auth/citizen/otp/verify", {"mobile_number": number, "code": code, **extra}, format="json")

    def sign_up(self, number=NUMBER, sms=False) -> dict:
        assert self.request_otp(number, sms=sms).status_code == 202
        response = self.verify(self.last_code(), number)
        assert response.status_code == 200, response.content
        return response.json()

    def bearer(self, token: str) -> None:
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")


class AuthTestCase(AuthTestMixin, TestCase):
    pass


class AuthTransactionTestCase(AuthTestMixin, TransactionTestCase):
    pass
