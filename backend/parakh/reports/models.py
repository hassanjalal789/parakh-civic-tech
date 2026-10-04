"""The single lifecycle record (Data Model §5.5–§5.6).

`DRAFT` is not a state. A `CivicReport` is created only in `SUBMITTED`, by
the one transaction of API-140, and its `report_reference` is issued in that
same transaction. There is no separate `CivicCase` entity.
"""
import uuid

from django.db import models
from django.db.models import Q


class CivicReportManager(models.Manager):
    def bulk_create(self, objs, *args, **kwargs):
        for obj in objs:
            obj.guard_creation_state()
        return super().bulk_create(objs, *args, **kwargs)


class CivicReport(models.Model):
    class State(models.TextChoices):
        SUBMITTED = "SUBMITTED"
        UNDER_VERIFICATION = "UNDER_VERIFICATION"
        VERIFIED = "VERIFIED"
        UC_REVIEW = "UC_REVIEW"
        ACCEPTED = "ACCEPTED"
        CONTRACTOR_ASSIGNED = "CONTRACTOR_ASSIGNED"
        IN_PROGRESS = "IN_PROGRESS"
        COMPLETION_SUBMITTED = "COMPLETION_SUBMITTED"
        COMPLETION_VERIFICATION = "COMPLETION_VERIFICATION"
        PENDING_CITIZEN_CONFIRMATION = "PENDING_CITIZEN_CONFIRMATION"
        RESOLVED_CONFIRMED = "RESOLVED_CONFIRMED"
        CLOSED = "CLOSED"
        REOPENED = "REOPENED"
        REJECTED = "REJECTED"
        CANCELLED = "CANCELLED"

    class ReporterKind(models.TextChoices):
        CITIZEN = "citizen"
        STAFF_OFFICIAL = "staff_official"

    class EvidenceCompleteness(models.TextChoices):
        # Derived on the server, never asserted by the client (DR-28 / DG-09).
        NONE = "none"  # typed description, no photo or recording
        PARTIAL = "partial"  # voice recording, no photo
        PHOTOGRAPHIC = "photographic"  # at least one photo

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    report_reference = models.CharField(max_length=16, unique=True)
    client_submission_id = models.UUIDField(unique=True)
    reporter_kind = models.CharField(max_length=16, choices=ReporterKind.choices)
    citizen_account = models.ForeignKey(
        "accounts.CitizenAccount", null=True, blank=True, on_delete=models.PROTECT, related_name="reports"
    )
    official_reporter_account_id = models.UUIDField(null=True, blank=True)
    official_reporter_role_assignment_id = models.UUIDField(null=True, blank=True)
    category = models.CharField(max_length=24)
    description_mode = models.CharField(max_length=8)
    confirmed_rendering_artifact_id = models.UUIDField(null=True, blank=True)
    confirmed_rendering_version = models.PositiveIntegerField(null=True, blank=True)
    rendering_confirmation_id = models.UUIDField(null=True, blank=True)
    typed_description = models.TextField(blank=True, default="")
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    location_accuracy_m = models.FloatField(null=True, blank=True)
    location_source = models.CharField(max_length=8)
    location_unverified = models.BooleanField(default=False)
    uc_scope_id = models.UUIDField(null=True, blank=True)  # scope resolution arrives with the portals
    evidence_completeness = models.CharField(max_length=16, choices=EvidenceCompleteness.choices)
    captured_at = models.DateTimeField()  # operative time (BR-026)
    received_at = models.DateTimeField()  # when the draft first reached the server
    created_at = models.DateTimeField()
    state = models.CharField(max_length=32, choices=State.choices)
    state_version = models.PositiveIntegerField(default=1)
    submission_idempotency_key = models.UUIDField(unique=True)

    objects = CivicReportManager()

    class Meta:
        constraints = [
            # Exactly one attribution shape (Data Model §5.5).
            models.CheckConstraint(
                condition=(
                    Q(
                        reporter_kind="citizen",
                        citizen_account__isnull=False,
                        official_reporter_account_id__isnull=True,
                        official_reporter_role_assignment_id__isnull=True,
                    )
                    | Q(
                        reporter_kind="staff_official",
                        citizen_account__isnull=True,
                        official_reporter_account_id__isnull=False,
                        official_reporter_role_assignment_id__isnull=False,
                    )
                ),
                name="exactly_one_attribution_shape",
            ),
            # A voice report binds the confirmed rendering; a typed report carries the reporter's own text.
            models.CheckConstraint(
                condition=(
                    Q(
                        description_mode="voice",
                        confirmed_rendering_artifact_id__isnull=False,
                        confirmed_rendering_version__isnull=False,
                        rendering_confirmation_id__isnull=False,
                    )
                    | (Q(description_mode="typed", confirmed_rendering_artifact_id__isnull=True) & ~Q(typed_description=""))
                ),
                name="description_is_confirmed_rendering_or_typed_text",
            ),
        ]
        indexes = [
            models.Index(fields=["citizen_account", "created_at"]),
            models.Index(fields=["uc_scope_id", "state"]),
        ]

    def guard_creation_state(self) -> None:
        if self.state != self.State.SUBMITTED:
            raise ValueError("A CivicReport can only be created in SUBMITTED (API Contract §7.3)")

    def save(self, *args, **kwargs):
        if self._state.adding:
            self.guard_creation_state()
        super().save(*args, **kwargs)


class ReportOwnership(models.Model):
    """Ownership is a first-class check, not an inference (Data Model §5.6)."""

    report = models.ForeignKey(CivicReport, on_delete=models.PROTECT, related_name="ownerships")
    subject_type = models.CharField(max_length=8)
    subject_id = models.UUIDField()
    established_at = models.DateTimeField()

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["report", "subject_type", "subject_id"], name="one_ownership_row")
        ]
        indexes = [models.Index(fields=["subject_type", "subject_id"])]


class ReportTimelineEntry(models.Model):
    """The sanitised timeline a reporter sees: states and times only.

    It never names an officer, carries a staff note or holds audit detail
    (FR-PUB.32, API Contract §9.2).
    """

    report = models.ForeignKey(CivicReport, on_delete=models.PROTECT, related_name="timeline")
    state = models.CharField(max_length=32, choices=CivicReport.State.choices)
    occurred_at = models.DateTimeField()

    class Meta:
        ordering = ["occurred_at", "id"]
