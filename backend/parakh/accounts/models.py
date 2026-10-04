"""Citizen accounts and consent records (SRS §6.2.1, §6.2.9).

The account holds no phone number and no name — no name field exists in the
31-entity model (RC-07 / DG-19).
"""
import uuid

from django.db import models


class CitizenAccount(models.Model):
    class Status(models.TextChoices):
        ACTIVE = "ACTIVE"
        TEMPORARILY_LOCKED = "TEMPORARILY_LOCKED"
        DEACTIVATED = "DEACTIVATED"

    class Language(models.TextChoices):
        URDU = "ur"
        ENGLISH = "en"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    status = models.CharField(max_length=24, choices=Status.choices, default=Status.ACTIVE)
    preferred_language = models.CharField(max_length=2, choices=Language.choices, default=Language.URDU)
    created_at = models.DateTimeField()
    last_seen_at = models.DateTimeField(null=True, blank=True)
    deactivated_at = models.DateTimeField(null=True, blank=True)
    deactivation_reason = models.TextField(blank=True, default="")


class ConsentRecord(models.Model):
    """One row per consent type — never one combined checkbox (FR-AUTH.3)."""

    class Type(models.TextChoices):
        ACCOUNT = "account_creation_and_processing"  # required
        VOICE = "voice_processing"  # required
        SMS = "sms_notification"  # optional, withdrawable

    REQUIRED = (Type.ACCOUNT, Type.VOICE)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    citizen_account = models.ForeignKey(CitizenAccount, on_delete=models.PROTECT, related_name="consents")
    consent_type = models.CharField(max_length=40, choices=Type.choices)
    consent_version = models.CharField(max_length=64)
    granted_at = models.DateTimeField(null=True, blank=True)  # null = optional consent declined
    withdrawn_at = models.DateTimeField(null=True, blank=True)
    locale = models.CharField(max_length=2)

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["citizen_account", "consent_type", "consent_version"], name="one_consent_row_per_type_and_version")
        ]
