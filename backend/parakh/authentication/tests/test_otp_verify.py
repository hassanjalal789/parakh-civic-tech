"""API-122 — citizen OTP verification, account creation and consent binding."""
import uuid
from datetime import timedelta

from django.conf import settings

from parakh.accounts.models import CitizenAccount, ConsentRecord
from parakh.authentication.models import AuthSession, OTPChallenge
from parakh.authentication.services import _code_hash
from parakh.identity_vault.models import CitizenPhoneCredential
from parakh.identity_vault.services import phone_hmac

from .base import E164, NUMBER, OTHER_NUMBER, AuthTestCase


class OtpVerifyTests(AuthTestCase):
    def test_first_verification_creates_account_credential_and_separate_consents(self):  # TEST-AUTH-C02, C08, CONSENT-006
        body = self.sign_up(NUMBER, sms=False)
        self.assertEqual(body["token_type"], "Bearer")
        self.assertEqual(body["subject_type"], "citizen")
        self.assertEqual(CitizenAccount.objects.count(), 1)
        account = CitizenAccount.objects.get()
        self.assertEqual(account.preferred_language, "ur")
        credential = CitizenPhoneCredential.objects.get()
        self.assertEqual(credential.citizen_account_id, account.id)
        rows = {c.consent_type: c for c in ConsentRecord.objects.filter(citizen_account=account)}
        self.assertEqual(set(rows), {"account_creation_and_processing", "voice_processing", "sms_notification"})
        self.assertIsNotNone(rows["account_creation_and_processing"].granted_at)
        self.assertIsNotNone(rows["voice_processing"].granted_at)
        self.assertIsNone(rows["sms_notification"].granted_at)  # optional consent declined, still its own row
        self.assertTrue(all(r.consent_version == settings.PARAKH_CONSENT_VERSION for r in rows.values()))

    def test_later_verification_signs_in_to_the_same_account(self):  # TEST-AUTH-C03
        self.sign_up(NUMBER)
        self.advance(61)
        self.request_otp("+923001234567")
        self.verify(self.last_code(), "+923001234567")
        self.assertEqual(CitizenAccount.objects.count(), 1)
        self.assertEqual(CitizenPhoneCredential.objects.count(), 1)
        self.assertEqual(ConsentRecord.objects.count(), 3)
        self.assertEqual(AuthSession.objects.count(), 2)

    def test_success_response_has_tokens_but_no_number_and_is_not_cached(self):
        self.request_otp(NUMBER)
        response = self.verify(self.last_code())
        self.assertEqual(response["Cache-Control"], "no-store")
        self.assertNotIn("3001234567", response.content.decode())
        self.assertEqual(set(response.json()), {"access_token", "access_expires_at", "refresh_token", "token_type", "subject_type"})

    def test_wrong_code_gives_one_uniform_error_with_attempts_remaining(self):
        self.request_otp(NUMBER)
        response = self.verify(self.wrong(self.last_code()))
        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.json(),
            {"error": {"code": "E_OTP_INVALID", "message": "The code is wrong or has expired.", "attempts_remaining": 4}},
        )

    def test_wrong_code_response_is_identical_for_registered_and_unregistered_numbers(self):  # TEST-AUTH-C05
        self.sign_up(NUMBER)
        self.advance(61)
        self.request_otp(NUMBER)
        registered = self.verify(self.wrong(self.last_code()), NUMBER)
        self.request_otp(OTHER_NUMBER)
        unregistered = self.verify(self.wrong(self.last_code()), OTHER_NUMBER)
        self.assertEqual((registered.status_code, registered.json()), (unregistered.status_code, unregistered.json()))

    def test_code_is_rejected_after_five_minutes(self):  # TEST-OTP-020
        self.request_otp(NUMBER)
        code = self.last_code()
        self.advance(300 + 1)
        response = self.verify(code)
        self.assertEqual(response.json()["error"]["code"], "E_OTP_INVALID")
        self.assertEqual(CitizenAccount.objects.count(), 0)

    def test_code_is_accepted_just_before_expiry(self):
        self.request_otp(NUMBER)
        code = self.last_code()
        self.advance(299)
        self.assertEqual(self.verify(code).status_code, 200)

    def test_consumed_code_is_rejected_on_reuse(self):  # TEST-OTP-021
        self.request_otp(NUMBER)
        code = self.last_code()
        self.assertEqual(self.verify(code).status_code, 200)
        response = self.verify(code)
        self.assertEqual(response.json()["error"]["code"], "E_OTP_INVALID")
        self.assertEqual(AuthSession.objects.count(), 1)

    def test_five_failures_consume_the_challenge(self):  # TEST-OTP-024
        self.request_otp(NUMBER)
        code = self.last_code()
        for remaining in [4, 3, 2, 1, 0]:
            self.assertEqual(self.verify(self.wrong(code)).json()["error"]["attempts_remaining"], remaining)
        response = self.verify(code)  # the right code, sixth attempt
        self.assertEqual(response.json()["error"]["code"], "E_OTP_INVALID")
        self.assertIsNotNone(OTPChallenge.objects.get().locked_at)
        self.assertEqual(CitizenAccount.objects.count(), 0)

    def test_failures_never_lock_the_account(self):  # TEST-OTP-025
        self.sign_up(NUMBER)
        self.advance(61)
        self.request_otp(NUMBER)
        for _ in range(5):
            self.verify(self.wrong(self.last_code()))
        self.advance(61)
        self.request_otp(NUMBER)
        self.assertEqual(self.verify(self.last_code()).status_code, 200)
        self.assertEqual(CitizenAccount.objects.get().status, CitizenAccount.Status.ACTIVE)

    def test_a_code_issued_for_another_purpose_cannot_sign_a_citizen_in(self):  # purpose binding, DG-11
        challenge_id = uuid.uuid4()
        staff_challenge = OTPChallenge.objects.create(
            id=challenge_id,
            purpose=OTPChallenge.Purpose.STAFF_LOGIN,
            phone_lookup_hmac=phone_hmac(E164),
            code_hash=_code_hash(challenge_id, "246810"),
            created_at=self.now,
            expires_at=self.now + timedelta(minutes=5),
            max_attempts=5,
        )
        response = self.verify("246810")
        self.assertEqual(response.json()["error"]["code"], "E_OTP_INVALID")
        staff_challenge.refresh_from_db()
        self.assertIsNone(staff_challenge.consumed_at)
        self.assertEqual(staff_challenge.attempts, 0)
        self.assertEqual(AuthSession.objects.count(), 0)

    def test_tampered_consent_at_verify_time_does_not_alter_the_record(self):  # TEST-CONSENT-007
        self.request_otp(NUMBER, sms=False)
        tampered = self.consent(sms=True, consent_version="forged-version", locale="en")
        self.assertEqual(self.verify(self.last_code(), **tampered).status_code, 200)
        sms_row = ConsentRecord.objects.get(consent_type="sms_notification")
        self.assertIsNone(sms_row.granted_at)
        self.assertEqual(set(ConsentRecord.objects.values_list("consent_version", flat=True)), {settings.PARAKH_CONSENT_VERSION})
        self.assertEqual(set(ConsentRecord.objects.values_list("locale", flat=True)), {"ur"})

    def test_new_number_without_server_held_consent_creates_nothing(self):
        self.request_otp(NUMBER, with_consent=False)
        code = self.last_code()
        response = self.verify(code, **self.consent())  # consent sent only at verify is ignored
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["code"], "E_CONSENT_REQUIRED")
        self.assertEqual(CitizenAccount.objects.count(), 0)
        self.assertEqual(ConsentRecord.objects.count(), 0)
        self.assertIsNotNone(OTPChallenge.objects.get().consumed_at)

    def test_existing_account_signs_in_without_a_consent_payload(self):
        self.sign_up(NUMBER)
        self.advance(61)
        self.request_otp(NUMBER, with_consent=False)
        self.assertEqual(self.verify(self.last_code()).status_code, 200)
        self.assertEqual(ConsentRecord.objects.count(), 3)

    def test_abandoned_onboarding_creates_no_account_and_no_consent(self):  # TEST-AUTH-C07, CONSENT-008
        self.request_otp(NUMBER, sms=True)
        self.advance(60 * 60)
        self.assertEqual(CitizenAccount.objects.count(), 0)
        self.assertEqual(ConsentRecord.objects.count(), 0)
        self.assertEqual(CitizenPhoneCredential.objects.count(), 0)

    def test_deactivated_account_cannot_sign_in(self):
        self.sign_up(NUMBER)
        CitizenAccount.objects.update(status=CitizenAccount.Status.DEACTIVATED)
        self.advance(61)
        self.request_otp(NUMBER)
        response = self.verify(self.last_code())
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json()["error"]["code"], "E_ACCOUNT_UNAVAILABLE")
        self.assertEqual(AuthSession.objects.count(), 1)

    def test_malformed_code_is_a_validation_error(self):
        self.request_otp(NUMBER)
        for bad in ["12345", "1234567", "12a456", 123456, None]:
            self.assertEqual(self.verify(bad).json()["error"]["code"], "E_VALIDATION", bad)
        self.assertEqual(OTPChallenge.objects.get().attempts, 0)

    def test_citizen_accounts_have_no_password(self):  # TEST-AUTH-C01
        fields = {f.name for f in CitizenAccount._meta.get_fields()}
        self.assertFalse(any("password" in name for name in fields))
        self.request_otp(NUMBER)
        response = self.api.post("/auth/citizen/otp/verify", {"mobile_number": NUMBER, "password": "x"}, format="json")
        self.assertEqual(response.json()["error"]["code"], "E_VALIDATION")
