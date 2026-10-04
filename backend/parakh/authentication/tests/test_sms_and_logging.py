"""The development SMS adapter is simulated, labelled and confined; no OTP reaches a log."""
import io
import json
import logging
from contextlib import redirect_stderr, redirect_stdout

from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase, override_settings

from parakh.audit.models import AuditEvent, record
from parakh.authentication.sms import (
    DevelopmentConsoleSmsSender,
    TestOutboxSmsSender,
    check_sms_configuration,
)

from .base import NUMBER, AuthTestCase

DEV = "parakh.authentication.sms.DevelopmentConsoleSmsSender"
TEST = "parakh.authentication.sms.TestOutboxSmsSender"


class SmsAdapterTests(SimpleTestCase):
    def test_production_refuses_development_adapters_and_a_missing_backend(self):
        for backend in [DEV, TEST, ""]:
            with self.assertRaises(ImproperlyConfigured):
                check_sms_configuration("production", backend)
        check_sms_configuration("production", "some.real.ProviderSender")  # accepted shape
        check_sms_configuration("development", DEV)

    @override_settings(PARAKH_ENV="production")
    def test_console_adapter_refuses_to_load_in_production(self):
        with self.assertRaises(ImproperlyConfigured):
            DevelopmentConsoleSmsSender()

    @override_settings(PARAKH_ENV="test")
    def test_console_adapter_refuses_to_load_in_test(self):
        with self.assertRaises(ImproperlyConfigured):
            DevelopmentConsoleSmsSender()

    @override_settings(PARAKH_ENV="development")
    def test_outbox_adapter_refuses_to_load_outside_test(self):
        with self.assertRaises(ImproperlyConfigured):
            TestOutboxSmsSender()

    @override_settings(PARAKH_ENV="development")
    def test_console_output_is_labelled_simulated_and_masks_the_number(self):
        err = io.StringIO()
        with redirect_stderr(err):
            DevelopmentConsoleSmsSender().send_otp("+923001234567", "135790", "citizen_signup_login")
        line = err.getvalue()
        self.assertIn("SIMULATED SMS", line)
        self.assertIn("development only, nothing was sent", line)
        self.assertIn("+92 300 *** 4567", line)
        self.assertNotIn("3001234567", line)


class _Capture(logging.Handler):
    def __init__(self):
        super().__init__(level=logging.DEBUG)
        self.lines: list[str] = []

    def emit(self, record):
        self.lines.append(self.format(record))


class NoOtpInLogsTests(AuthTestCase):
    def test_no_code_or_number_reaches_logs_output_or_audit(self):  # TEST-OTP-030
        handler = _Capture()
        root = logging.getLogger()
        old_level = root.level
        root.addHandler(handler)
        root.setLevel(logging.DEBUG)
        self.addCleanup(root.removeHandler, handler)
        self.addCleanup(root.setLevel, old_level)
        out, err = io.StringIO(), io.StringIO()
        with redirect_stdout(out), redirect_stderr(err):
            self.request_otp(NUMBER)
            code = self.last_code()
            self.verify(self.wrong(code))
            self.verify(code)
            self.advance(61)
            self.request_otp(NUMBER)
            self.request_otp(NUMBER)  # rate-limited
        emitted = "\n".join(handler.lines) + out.getvalue() + err.getvalue()
        audit = json.dumps([e.details for e in AuditEvent.objects.all()])
        for secret in [code, "3001234567"]:
            self.assertNotIn(secret, emitted)
            self.assertNotIn(secret, audit)

    def test_audit_refuses_secret_fields(self):
        for key in ["code", "otp", "phone", "refresh_token"]:
            with self.assertRaises(ValueError):
                record("anything", **{key: "x"})
