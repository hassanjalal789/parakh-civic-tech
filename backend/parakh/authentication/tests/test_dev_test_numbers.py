"""
DG-70 (Hassan Jalal, 2026-10-09): in development, citizen sign-in accepts only
the designated test numbers, and the safeguard can never affect production.

All numbers are synthetic. Development is simulated with override_settings, with
the SMS sender replaced by a recorder (the test outbox runs only in test). The
start-up rules are checked by starting Django in a fresh process, as core/tests.py does.
"""
import os
import subprocess
import sys
from unittest import mock

from django.test import SimpleTestCase, override_settings

from parakh.accounts.models import CitizenAccount
from parakh.audit.models import AuditEvent
from parakh.authentication.models import AuthSession, OTPChallenge
from parakh.core.tests import BACKEND, PRODUCTION_KEYS, _start
from parakh.identity_vault.models import CitizenPhoneCredential

from .base import NUMBER, OTHER_NUMBER, AuthTestCase

DESIGNATED = ("+923001234567",)  # NUMBER, "0300 1234567"


class _Recorder:
    def __init__(self):
        self.sent = []

    def send_otp(self, phone_e164, code, purpose):
        self.sent.append((phone_e164, code, purpose))


class _RecordingSender(AuthTestCase):
    def setUp(self):
        super().setUp()
        self.sms = _Recorder()
        patcher = mock.patch("parakh.authentication.services.sms.get_sender", return_value=self.sms)
        patcher.start()
        self.addCleanup(patcher.stop)


@override_settings(PARAKH_ENV="development", PARAKH_DEV_TEST_NUMBERS=DESIGNATED)
class DevelopmentAcceptsOnlyTestNumbersTests(_RecordingSender):
    def test_a_designated_test_number_signs_in(self):
        self.assertEqual(self.request_otp(NUMBER).status_code, 202)
        self.assertEqual(self.sms.sent[-1][0], "+923001234567")
        response = self.verify(self.sms.sent[-1][1], NUMBER)
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(CitizenAccount.objects.count(), 1)

    def test_any_other_number_is_refused_before_anything_is_stored_counted_sent_or_audited(self):
        audit_before = AuditEvent.objects.count()
        for number in [OTHER_NUMBER, "+923001234568", "03001234560", "0092 300 1234569"]:
            response = self.request_otp(number)
            self.assertEqual(response.status_code, 403, number)
            self.assertEqual(response.json()["error"]["code"], "E_DEV_TEST_NUMBER_ONLY", number)
        self.assertEqual(OTPChallenge.objects.count(), 0)
        self.assertEqual(self.sms.sent, [])
        self.assertEqual(AuditEvent.objects.count(), audit_before)

    def test_verify_refuses_any_other_number_and_creates_nothing(self):
        response = self.verify("123456", OTHER_NUMBER)
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"]["code"], "E_DEV_TEST_NUMBER_ONLY")
        self.assertEqual(CitizenAccount.objects.count(), 0)
        self.assertEqual(CitizenPhoneCredential.objects.count(), 0)
        self.assertEqual(AuthSession.objects.count(), 0)

    def test_refusals_never_use_up_the_limits_shared_with_the_designated_number(self):
        for _ in range(25):  # more than the per-device and per-IP hourly caps, from the same device and IP
            self.assertEqual(self.request_otp(OTHER_NUMBER).status_code, 403)
        self.assertEqual(self.request_otp(NUMBER).status_code, 202)

    def test_the_refusal_never_echoes_the_number(self):
        body = self.request_otp(OTHER_NUMBER).content.decode()
        for fragment in ["3119876543", "119876543", "9876543", OTHER_NUMBER]:
            self.assertNotIn(fragment, body)

    def test_a_malformed_number_is_still_reported_as_malformed(self):
        response = self.request_otp("12345")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "E_INVALID_NUMBER")


class TestAndProductionNeverRefuseANumberTests(_RecordingSender):
    def test_in_test_any_valid_number_signs_in(self):
        self.assertEqual(self.request_otp(OTHER_NUMBER).status_code, 202)

    @override_settings(PARAKH_ENV="production", PARAKH_DEV_TEST_NUMBERS=())
    def test_in_production_any_valid_number_is_accepted(self):
        self.assertEqual(self.request_otp(OTHER_NUMBER).status_code, 202)
        self.assertEqual(self.verify(self.sms.sent[-1][1], OTHER_NUMBER).status_code, 200)

    @override_settings(PARAKH_ENV="production", PARAKH_DEV_TEST_NUMBERS=DESIGNATED)
    def test_production_ignores_a_list_even_if_one_were_present(self):
        self.assertEqual(self.request_otp(OTHER_NUMBER).status_code, 202)


def _settings_value(env_overrides: dict) -> subprocess.CompletedProcess:
    env = {k: v for k, v in os.environ.items() if not k.startswith(("PARAKH_", "DJANGO_"))}
    env.update({"DJANGO_SETTINGS_MODULE": "config.settings", **env_overrides})
    code = "import django; django.setup(); from django.conf import settings; print(settings.PARAKH_DEV_TEST_NUMBERS)"
    return subprocess.run([sys.executable, "-c", code], cwd=BACKEND, env=env, capture_output=True, text=True,
                          timeout=60)


class StartupRulesTests(SimpleTestCase):
    def test_production_refuses_to_start_when_the_list_is_set_even_empty(self):
        for value in ["+923001234567", ""]:
            result = _start({**PRODUCTION_KEYS, "PARAKH_SMS_BACKEND": "provider.module.SmsSender",
                             "PARAKH_DEV_TEST_NUMBERS": value})
            self.assertNotEqual(result.returncode, 0, value)
            self.assertIn("PARAKH_DEV_TEST_NUMBERS is for development only", result.stderr)

    def test_development_refuses_a_list_that_is_not_pakistani_mobile_numbers(self):
        for value in ["+15551234567", "03001234567", "+92300123456", ",", "+923001234567,abc"]:
            result = _start({"PARAKH_ENV": "development", "PARAKH_DEV_TEST_NUMBERS": value})
            self.assertNotEqual(result.returncode, 0, value)
            self.assertIn("must list Pakistani mobile numbers", result.stderr, value)

    def test_development_defaults_to_the_numbers_the_project_designates(self):
        result = _settings_value({"PARAKH_ENV": "development"})
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), "('+923001234567', '+923009990001', '+923009990002')")

    def test_development_accepts_its_own_list_and_test_runs_have_none(self):
        own = _settings_value({"PARAKH_ENV": "development", "PARAKH_DEV_TEST_NUMBERS": " +923001234567 ,+923009990001"})
        self.assertEqual(own.stdout.strip(), "('+923001234567', '+923009990001')", own.stderr)
        test = _settings_value({"PARAKH_ENV": "test", "PARAKH_DEV_TEST_NUMBERS": "+923001234567"})
        self.assertEqual(test.stdout.strip(), "()", test.stderr)
