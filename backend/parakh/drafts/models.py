"""The draft pipeline (Data Model §5.1–§5.3, §5.7).

A `ClientSubmission` is a draft. It is not a report, carries no report
reference and appears in no civic queue. A `CivicReport` exists only after
the server transaction of API-140 (parakh.reports).
"""
import uuid

from django.db import models
from django.db.models import Q


class SubjectType(models.TextChoices):
    CITIZEN = "citizen"
    STAFF = "staff"


class ClientSubmission(models.Model):
    class PipelineState(models.TextChoices):
        LOCAL_DRAFT = "LOCAL_DRAFT"
        WAITING_FOR_CONNECTION = "WAITING_FOR_CONNECTION"
        UPLOADING = "UPLOADING"
        TRANSCRIPTION_PROCESSING = "TRANSCRIPTION_PROCESSING"
        AWAITING_REPORTER_REVIEW = "AWAITING_REPORTER_REVIEW"
        READY_TO_SUBMIT = "READY_TO_SUBMIT"
        SUBMISSION_FAILED = "SUBMISSION_FAILED"

    class DescriptionMode(models.TextChoices):
        VOICE = "voice"  # the primary path (FR-PUB.9)
        TYPED = "typed"  # the fallback (FR-PUB.12)

    class LocationSource(models.TextChoices):
        DEVICE = "device"
        MANUAL = "manual"  # always location_unverified (FR-PUB.24)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client_submission_id = models.UUIDField(unique=True)
    reporter_subject_type = models.CharField(max_length=8, choices=SubjectType.choices)
    reporter_account_id = models.UUIDField(db_index=True)
    acting_role_assignment_id = models.UUIDField(null=True, blank=True)  # staff only (Phase 2)
    category = models.CharField(max_length=24)
    description_mode = models.CharField(max_length=8, choices=DescriptionMode.choices)
    typed_description = models.TextField(blank=True, default="")
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    location_accuracy_m = models.FloatField(null=True, blank=True)
    location_source = models.CharField(max_length=8, choices=LocationSource.choices)
    location_unverified = models.BooleanField(default=False)
    captured_at = models.DateTimeField()  # operative time (BR-026); never overwritten
    first_seen_at = models.DateTimeField()  # server-received time, stored separately
    updated_at = models.DateTimeField()
    retry_window_ends_at = models.DateTimeField()
    payload_hash = models.CharField(max_length=64)
    pipeline_state = models.CharField(max_length=32, choices=PipelineState.choices)
    manifest_sha256 = models.CharField(max_length=64, blank=True, default="")
    manifest_completed_at = models.DateTimeField(null=True, blank=True)
    resulting_report_id = models.UUIDField(null=True, blank=True, unique=True)

    class Meta:
        indexes = [models.Index(fields=["reporter_subject_type", "reporter_account_id", "first_seen_at"])]


class EvidenceObject(models.Model):
    """One captured item. Bytes live in write-once storage under an opaque key."""

    class Kind(models.TextChoices):
        PHOTO = "photo"
        VIDEO = "video"
        VOICE_ORIGINAL = "voice_original"

    class Status(models.TextChoices):
        RECEIVING = "RECEIVING"
        COMPLETE = "COMPLETE"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission = models.ForeignKey(ClientSubmission, on_delete=models.PROTECT, related_name="evidence")
    client_evidence_id = models.UUIDField()
    report_id = models.UUIDField(null=True, blank=True, db_index=True)
    kind = models.CharField(max_length=16, choices=Kind.choices)
    mime_type = models.CharField(max_length=64)
    byte_size = models.PositiveBigIntegerField()
    declared_sha256 = models.CharField(max_length=64)  # computed on the device at capture; never proof
    sha256 = models.CharField(max_length=64, blank=True, default="")  # recomputed by the server
    chunk_count = models.PositiveIntegerField()
    captured_at = models.DateTimeField()
    capture_confidence = models.CharField(max_length=32, blank=True, default="")
    storage_key = models.CharField(max_length=64, unique=True)  # opaque: no account id, number or name
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.RECEIVING)
    uploaded_by_kind = models.CharField(max_length=8, choices=SubjectType.choices)
    derived_from_id = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField()
    completed_at = models.DateTimeField(null=True, blank=True)
    deleted_at = models.DateTimeField(null=True, blank=True)  # discarded before submission

    class Meta:
        constraints = [
            models.UniqueConstraint(fields=["submission", "client_evidence_id"], name="one_evidence_row_per_client_id")
        ]


class EvidenceChunk(models.Model):
    """A received chunk, held in deletable staging until the manifest completes."""

    evidence = models.ForeignKey(EvidenceObject, on_delete=models.CASCADE, related_name="chunks")
    index = models.PositiveIntegerField()
    sha256 = models.CharField(max_length=64)
    byte_size = models.PositiveIntegerField()
    staging_key = models.CharField(max_length=64, unique=True)
    received_at = models.DateTimeField()

    class Meta:
        constraints = [models.UniqueConstraint(fields=["evidence", "index"], name="one_chunk_per_index")]


class VoiceTranscriptionArtifact(models.Model):
    """AI output derived from the reporter's speech, versioned (Data Model §5.2).

    Three artefacts are never conflated: the original recording (an
    EvidenceObject), `source_asr_text` (never returned to a citizen) and the
    Urdu-script `urdu_civic_rendering`.
    """

    class ProcessingStatus(models.TextChoices):
        QUEUED = "QUEUED"
        PROCESSING = "PROCESSING"
        COMPLETED = "COMPLETED"
        FAILED = "FAILED"
        REVIEW_REQUIRED = "REVIEW_REQUIRED"

    class HumanReviewStatus(models.TextChoices):
        NOT_REQUIRED = "NOT_REQUIRED"
        PENDING = "PENDING"
        IN_REVIEW = "IN_REVIEW"
        COMPLETED = "COMPLETED"

    class Origin(models.TextChoices):
        AI = "ai"
        REPORTER_CORRECTION = "reporter_correction"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission = models.ForeignKey(ClientSubmission, on_delete=models.PROTECT, related_name="artifacts")
    source_audio_evidence = models.ForeignKey(EvidenceObject, on_delete=models.PROTECT, related_name="+")
    rendering_version = models.PositiveIntegerField()
    is_active_version = models.BooleanField(default=True)
    supersedes_artifact = models.ForeignKey("self", null=True, blank=True, on_delete=models.PROTECT, related_name="+")
    origin = models.CharField(max_length=24, choices=Origin.choices, default=Origin.AI)
    detected_languages = models.JSONField(default=list)
    source_asr_text = models.TextField(blank=True, default="")
    urdu_civic_rendering = models.TextField(blank=True, default="")
    rendering_content_hash = models.CharField(max_length=64, blank=True, default="")
    critical_fields_json = models.JSONField(default=dict)
    field_confidence_json = models.JSONField(default=dict)
    overall_confidence = models.FloatField(null=True, blank=True)
    model_name = models.CharField(max_length=64, blank=True, default="")
    model_version = models.CharField(max_length=32, blank=True, default="")
    simulated = models.BooleanField(default=False)  # development adapter output (DG-48)
    processing_status = models.CharField(max_length=16, choices=ProcessingStatus.choices, default=ProcessingStatus.QUEUED)
    failure_code = models.CharField(max_length=48, blank=True, default="")
    processing_started_at = models.DateTimeField(null=True, blank=True)
    processing_completed_at = models.DateTimeField(null=True, blank=True)
    human_review_status = models.CharField(
        max_length=16, choices=HumanReviewStatus.choices, default=HumanReviewStatus.NOT_REQUIRED
    )
    human_reviewed_by_account_id = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField()

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["submission"], condition=Q(is_active_version=True), name="one_active_rendering_per_draft"
            ),
            models.UniqueConstraint(fields=["submission", "rendering_version"], name="one_artifact_per_version"),
        ]
        indexes = [models.Index(fields=["processing_status"])]


class RenderingConfirmation(models.Model):
    """Binds the reporter's confirmation to one exact rendering version (Data Model §5.3)."""

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    artifact = models.ForeignKey(VoiceTranscriptionArtifact, on_delete=models.PROTECT, related_name="confirmations")
    submission = models.ForeignKey(ClientSubmission, on_delete=models.PROTECT, related_name="confirmations")
    rendering_version = models.PositiveIntegerField()
    rendering_content_hash = models.CharField(max_length=64)
    reporter_subject_type = models.CharField(max_length=8, choices=SubjectType.choices)
    reporter_account_id = models.UUIDField()
    acting_role_assignment_id = models.UUIDField(null=True, blank=True)
    confirmed_at = models.DateTimeField()  # server time
    client_confirmed_at = models.DateTimeField(null=True, blank=True)  # advisory only
    idempotency_key = models.UUIDField(unique=True)
    request_fingerprint = models.CharField(max_length=64)
    resulting_report_id = models.UUIDField(null=True, blank=True)
    client_app_version = models.CharField(max_length=32, blank=True, default="")

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["submission"],
                condition=Q(resulting_report_id__isnull=False),
                name="one_reporting_confirmation_per_draft",
            )
        ]
        indexes = [models.Index(fields=["submission", "rendering_version"])]
