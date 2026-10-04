"""OTP challenges and server-side sessions (Data Model §4.2–§4.4).

- An OTP is stored only as `code_hash` (keyed), never in clear.
- `purpose` binds a challenge to exactly one verification endpoint (DG-11).
- Citizen consent is held server-side on the challenge at request time (DG-12).
- Tokens are opaque random values; only their SHA-256 is stored, so a
  database read does not yield a usable token. Sessions are revocable.
"""
import uuid

from django.db import models


class OTPChallenge(models.Model):
    class Purpose(models.TextChoices):
        CITIZEN_SIGNUP_LOGIN = "citizen_signup_login"
        STAFF_ACTIVATION = "staff_activation"
        STAFF_LOGIN = "staff_login"
        PASSWORD_RESET = "password_reset"
        CITIZEN_PHONE_CHANGE_OLD = "citizen_phone_change_old"
        CITIZEN_PHONE_CHANGE_NEW = "citizen_phone_change_new"
        STAFF_PHONE_CHANGE_NEW = "staff_phone_change_new"
        STEP_UP = "step_up"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    purpose = models.CharField(max_length=32, choices=Purpose.choices)
    phone_lookup_hmac = models.CharField(max_length=64, db_index=True)
    code_hash = models.CharField(max_length=64)
    created_at = models.DateTimeField(db_index=True)
    expires_at = models.DateTimeField()
    attempts = models.PositiveSmallIntegerField(default=0)
    max_attempts = models.PositiveSmallIntegerField()
    consumed_at = models.DateTimeField(null=True, blank=True)
    locked_at = models.DateTimeField(null=True, blank=True)  # set when max_attempts is reached
    superseded_by = models.ForeignKey("self", null=True, blank=True, on_delete=models.SET_NULL, related_name="+")
    request_ip_hmac = models.CharField(max_length=64, blank=True, default="", db_index=True)
    device_hint_hmac = models.CharField(max_length=64, blank=True, default="", db_index=True)
    # Citizen signup/login only: what the citizen agreed to, held by the server (DG-12).
    pending_consent_ref = models.CharField(max_length=64, blank=True, default="")
    consent_version = models.CharField(max_length=64, blank=True, default="")
    consent_selections = models.JSONField(default=dict)
    consent_locale = models.CharField(max_length=2, blank=True, default="")

    def is_open(self, now) -> bool:
        return self.consumed_at is None and self.locked_at is None and self.superseded_by_id is None and now < self.expires_at


class RefreshTokenFamily(models.Model):
    """One chain of rotating refresh tokens. Replay of a rotated token revokes the family (NFR-50)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subject_type = models.CharField(max_length=8)  # citizen | staff
    subject_id = models.UUIDField(db_index=True)
    current_token_hash = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField()
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)


class RotatedRefreshToken(models.Model):
    """A refresh token that has already been exchanged. Presenting it again is a replay."""

    token_hash = models.CharField(max_length=64, unique=True)
    family = models.ForeignKey(RefreshTokenFamily, on_delete=models.CASCADE, related_name="rotated")
    rotated_at = models.DateTimeField()


class AuthSession(models.Model):
    class Method(models.TextChoices):
        CITIZEN_OTP = "citizen_otp"
        STAFF_PASSWORD_OTP = "staff_password_otp"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    subject_type = models.CharField(max_length=8)  # citizen | staff
    subject_id = models.UUIDField(db_index=True)
    acting_role_assignment_id = models.UUIDField(null=True, blank=True)  # always null for citizens
    authentication_method = models.CharField(max_length=24, choices=Method.choices)
    access_token_hash = models.CharField(max_length=64, unique=True)
    access_expires_at = models.DateTimeField()
    refresh_family = models.OneToOneField(RefreshTokenFamily, on_delete=models.PROTECT, related_name="session")
    issued_at = models.DateTimeField()
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    revocation_reason = models.CharField(max_length=32, blank=True, default="")
    mfa_satisfied_at = models.DateTimeField(null=True, blank=True)
    step_up_satisfied_at = models.DateTimeField(null=True, blank=True)
    device_hint_hmac = models.CharField(max_length=64, blank=True, default="")
    last_seen_at = models.DateTimeField(null=True, blank=True)
