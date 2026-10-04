"""API-121 — citizen OTP request."""
from parakh.audit.models import AuditEvent
from parakh.authentication.models import OTPChallenge
from parakh.authentication.sms import TestOutboxSmsSender
from parakh.identity_vault.services import phone_hmac

from .base import E164, NUMBER, OTHER_NUMBER, AuthTestCase


class OtpRequestTests(AuthTestCase):
    def test_response_is_uniform_for_registered_and_unregistered_numbers(self):  # TEST-AUTH-C05, TEST-OTP-029
        self.sign_up(NUMBER)
        self.advance(61)
        registered = self.request_otp(NUMBER)
        unregistered = self.request_otp(OTHER_NUMBER)
        self.assertEqual(registered.status_code, 202)
        self.assertEqual(registered.status_code, unregistered.status_code)
        self.assertEqual(registered.json(), unregistered.json())
        self.assertEqual(registered.json(), {"expires_in_seconds": 300, "resend_after_seconds": 60, "code_length": 6})
        self.assertEqual(registered["Cache-Control"], "no-store")

    def test_invalid_number_is_rejected_and_nothing_is_sent(self):
        for bad in ["12345", "+9230012345", "04235761234", "abc", "", None]:
            response = self.request_otp(bad)
            self.assertEqual(response.status_code, 400, bad)
            self.assertEqual(response.json()["error"]["code"], "E_INVALID_NUMBER", bad)
        self.assertEqual(OTPChallenge.objects.count(), 0)
        self.assertEqual(TestOutboxSmsSender.outbox, [])

    def test_error_body_never_echoes_the_number(self):
        response = self.request_otp("0300123456")
        self.assertNotIn("0300123456", response.content.decode())

    def test_required_consent_unchecked_is_refused(self):
        body = self.consent()
        body["consent_selections"]["voice_processing"] = False
        response = self.api.post("/auth/citizen/otp/request", {"mobile_number": NUMBER, **body}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "E_CONSENT_REQUIRED")
        self.assertEqual(OTPChallenge.objects.count(), 0)

    def test_unknown_consent_version_is_refused(self):
        response = self.api.post(
            "/auth/citizen/otp/request", {"mobile_number": NUMBER, **self.consent(consent_version="old-text")}, format="json"
        )
        self.assertEqual(response.json()["error"]["code"], "E_CONSENT_VERSION")

    def test_combined_or_missing_consent_choices_are_refused(self):  # never one checkbox
        body = self.consent()
        body["consent_selections"] = {"all": True}
        response = self.api.post("/auth/citizen/otp/request", {"mobile_number": NUMBER, **body}, format="json")
        self.assertEqual(response.json()["error"]["code"], "E_VALIDATION")

    def test_consent_snapshot_is_held_on_the_server_challenge(self):  # TEST-CONSENT-005
        self.request_otp(NUMBER, sms=True)
        challenge = OTPChallenge.objects.get()
        self.assertEqual(challenge.consent_version, "citizen-consent-draft-1")
        self.assertEqual(
            challenge.consent_selections,
            {"account_creation_and_processing": True, "voice_processing": True, "sms_notification": True},
        )
        self.assertEqual(challenge.pending_consent_ref, "3f1c9a52-0b7e-4d0a-9d1e-5b2f6c7a8e90")

    def test_code_and_number_are_never_stored_in_clear(self):
        self.request_otp(NUMBER)
        code = self.last_code()
        challenge = OTPChallenge.objects.get()
        stored = " ".join(str(getattr(challenge, f.attname)) for f in OTPChallenge._meta.fields)
        self.assertNotIn(code, stored)
        self.assertNotIn("3001234567", stored)
        self.assertEqual(challenge.phone_lookup_hmac, phone_hmac(E164))
        self.assertEqual(len(code), 6)
        self.assertTrue(code.isdigit())

    def test_all_number_formats_map_to_one_identity(self):
        for i, form in enumerate(["03001234567", "+923001234567", "923001234567", "0092 300 1234567"]):
            self.advance(61 * 30)  # outside cooldown and hourly cap
            self.assertEqual(self.request_otp(form).status_code, 202, form)
        self.assertEqual(set(OTPChallenge.objects.values_list("phone_lookup_hmac", flat=True)), {phone_hmac(E164)})

    def test_resend_within_cooldown_is_refused(self):  # TEST-OTP-023
        self.request_otp(NUMBER)
        self.advance(59)
        response = self.request_otp(NUMBER)
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json()["error"]["code"], "E_OTP_COOLDOWN")
        self.assertEqual(response.json()["error"]["retry_after_seconds"], 1)
        self.assertEqual(OTPChallenge.objects.count(), 1)
        self.advance(1)
        self.assertEqual(self.request_otp(NUMBER).status_code, 202)

    def test_resend_supersedes_the_previous_challenge_immediately(self):  # TEST-OTP-022
        self.request_otp(NUMBER)
        first_code = self.last_code()
        self.advance(61)
        self.request_otp(NUMBER)
        second_code = self.last_code()
        first = OTPChallenge.objects.order_by("created_at").first()
        self.assertIsNotNone(first.superseded_by_id)
        if first_code != second_code:
            self.assertEqual(self.verify(first_code).json()["error"]["code"], "E_OTP_INVALID")
        self.assertEqual(self.verify(second_code).status_code, 200)

    def test_fourth_request_in_one_hour_for_one_number_is_refused(self):  # TEST-OTP-026
        for _ in range(3):
            self.assertEqual(self.request_otp(NUMBER).status_code, 202)
            self.advance(61)
        response = self.request_otp(NUMBER)
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json()["error"]["code"], "E_RATE_LIMITED")

    def test_eleventh_request_in_one_day_for_one_number_is_refused(self):  # TEST-OTP-027
        for _ in range(10):
            self.assertEqual(self.request_otp(NUMBER).status_code, 202)
            self.advance(21 * 60)  # stays under 3 per rolling hour
        response = self.request_otp(NUMBER)
        self.assertEqual(response.status_code, 429)
        self.assertEqual(response.json()["error"]["code"], "E_RATE_LIMITED")

    def test_sixth_request_in_one_hour_from_one_device_is_refused(self):  # TEST-OTP-028
        for i in range(5):
            self.assertEqual(self.request_otp(f"0300000000{i}", device_hint="install-A").status_code, 202)
        self.assertEqual(self.request_otp("03000000009", device_hint="install-A").status_code, 429)
        self.assertEqual(self.request_otp("03000000009", device_hint="install-B").status_code, 202)

    def test_twenty_first_request_in_one_hour_from_one_ip_is_refused(self):
        for i in range(20):
            self.assertEqual(self.request_otp(f"03000000{i:03d}", ip="10.1.2.3").status_code, 202)
        self.assertEqual(self.request_otp("03000000999", ip="10.1.2.3").status_code, 429)
        self.assertEqual(self.request_otp("03000000999", ip="10.9.9.9").status_code, 202)

    def test_rate_limiting_is_audited_without_the_number(self):
        self.request_otp(NUMBER)
        self.request_otp(NUMBER)
        event = AuditEvent.objects.filter(action="otp_rate_limited").get()
        self.assertEqual(event.details["limit"], "resend_cooldown")
        self.assertNotIn("3001234567", str(event.details))

    def test_non_object_body_is_a_validation_error(self):
        response = self.api.post("/auth/citizen/otp/request", ["03001234567"], format="json")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "E_VALIDATION")
