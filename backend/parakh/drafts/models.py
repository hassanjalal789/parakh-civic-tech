"""The draft pipeline (Data Model §5.1–§5.3, §5.7).

A `ClientSubmission` is a draft. It is not a report, carries no report
reference and appears in no civic queue. A `CivicReport` exists only after
the server transaction of API-140 (parakh.reports).

Before that transaction everything here is **temporary processing data**
(DG-55): cancellation and expiry delete the media and the derived content.
Evidence is sealed — written once, read-only — when the report is created.
See docs/planning/TEMPORARY_DATA_LIFECYCLE.md.
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
        VOICE = "voice"  # speaking and typing are two equal ways (FR-PUB.9, DG-61)
        TYPED = "typed"

    class LocationSource(models.TextChoices):
        """Derived by the server from what the device sent (DG-73, Hassan Jalal, 2026-10-11)."""

        GPS_CURRENT = "gps_current"  # a current GPS fix, not adjusted: the only verified source
        GPS_LAST_KNOWN = "gps_last_known"  # the phone's last known position, not adjusted
        ADJUSTED = "adjusted"  # the reporter moved a measured position with the directional buttons
        WRITTEN_DESCRIPTION = "written_description"  # no coordinates: the reporter's written description
        SPOKEN_DESCRIPTION = "spoken_description"  # no coordinates: a location_voice recording (DG-77)
        DEVICE = "device"  # before DG-73 only; never derived now
        MANUAL = "manual"  # before DG-73 only; never derived now

    class MeasuredFix(models.TextChoices):
        CURRENT = "current"
        LAST_KNOWN = "last_known"

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    client_submission_id = models.UUIDField(unique=True)
    reporter_subject_type = models.CharField(max_length=8, choices=SubjectType.choices)
    reporter_account_id = models.UUIDField(db_index=True)
    acting_role_assignment_id = models.UUIDField(null=True, blank=True)  # staff only (Phase 2)
    category = models.CharField(max_length=24)
    description_mode = models.CharField(max_length=8, choices=DescriptionMode.choices)
    typed_description = models.TextField(blank=True, default="")
    # Location (DG-30, DG-73). measured_*: what the phone measured, kept unchanged; reported_*: the
    # position the reporter confirms, equal to the measured one unless adjusted. Without coordinates, the
    # reporter's written description stands in for them. Every location field is cleared when purged.
    measured_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    measured_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    measured_accuracy_m = models.FloatField(null=True, blank=True)  # as the phone reported it; may be absent
    measured_fix = models.CharField(max_length=12, choices=MeasuredFix.choices, blank=True, default="")
    measured_at = models.DateTimeField(null=True, blank=True)  # the reading's own time, not captured_at
    reported_latitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    reported_longitude = models.DecimalField(max_digits=9, decimal_places=6, null=True, blank=True)
    location_description = models.TextField(blank=True, default="")  # exactly as written
    location_source = models.CharField(max_length=24, choices=LocationSource.choices, blank=True)  # "" once purged
    location_unverified = models.BooleanField(default=False)  # every source but an unadjusted current fix
    captured_at = models.DateTimeField()  # operative time (BR-026); never overwritten
    first_seen_at = models.DateTimeField()  # server-received time, stored separately
    updated_at = models.DateTimeField()
    temporary_data_expires_at = models.DateTimeField()  # last activity + PARAKH_TEMPORARY_DATA_TTL_HOURS
    cancelled_at = models.DateTimeField(null=True, blank=True)  # cancelled by the citizen; content purged
    expired_at = models.DateTimeField(null=True, blank=True)  # abandoned; content purged; can be reopened
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
        # The reporter's spoken description of where the issue is, when there are no coordinates (DG-77,
        # Hassan Jalal, 2026-10-11). Evidence like any recording; never sent to the AI pipeline.
        LOCATION_VOICE = "location_voice"

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
    duration_seconds = models.FloatField(null=True, blank=True)  # parsed from the container (video, recording)
    chunk_count = models.PositiveIntegerField()
    captured_at = models.DateTimeField()
    capture_confidence = models.CharField(max_length=32, blank=True, default="")
    storage_key = models.CharField(max_length=64, unique=True)  # opaque: no account id, number or name
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.RECEIVING)
    uploaded_by_kind = models.CharField(max_length=8, choices=SubjectType.choices)
    derived_from_id = models.UUIDField(null=True, blank=True)
    created_at = models.DateTimeField()
    completed_at = models.DateTimeField(null=True, blank=True)  # assembled in the processing area
    sealed_at = models.DateTimeField(null=True, blank=True)  # written once to sealed storage by API-140
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
    """The report text, versioned (Data Model §5.2; Mobile SRS v2.3.0 FR-PUB.16).

    Every version holds three texts the reporter reviews and confirms
    together (DG-62): the `transcription` (the reporter's own words; for a
    typed report, the typed text verbatim), the Urdu `urdu_civic_rendering`
    and the `english_rendering`. `source_asr_text`, the raw intermediate
    speech-recognition output, is never returned to a citizen. `text_origins`
    says, per text, whether the reporter wrote it or AI produced it.
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

    class TextOrigin(models.TextChoices):
        REPORTER = "reporter"  # typed or corrected by the reporter; AI never overwrites it
        AI_TRANSCRIPTION = "ai_transcription"
        AI_TRANSLATION = "ai_translation"
        AI_RENDERING = "ai_rendering"  # transliteration or normalisation, not a plain translation

    class SourceKind(models.TextChoices):
        VOICE = "voice"  # the original recording
        TYPED = "typed"  # the reporter's typed text (DG-53)

    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission = models.ForeignKey(ClientSubmission, on_delete=models.PROTECT, related_name="artifacts")
    source_kind = models.CharField(max_length=8, choices=SourceKind.choices, default=SourceKind.VOICE)
    source_audio_evidence = models.ForeignKey(
        EvidenceObject, null=True, blank=True, on_delete=models.PROTECT, related_name="+"
    )  # null for a typed source
    source_text_sha256 = models.CharField(max_length=64, blank=True, default="")  # typed text the rendering came from
    rendering_version = models.PositiveIntegerField()
    is_active_version = models.BooleanField(default=True)
    supersedes_artifact = models.ForeignKey("self", null=True, blank=True, on_delete=models.PROTECT, related_name="+")
    origin = models.CharField(max_length=24, choices=Origin.choices, default=Origin.AI)
    detected_languages = models.JSONField(default=list)
    source_asr_text = models.TextField(blank=True, default="")
    source_language = models.CharField(max_length=8, blank=True, default="")  # "ur", "en", "und", ...
    transcription = models.TextField(blank=True, default="")
    urdu_civic_rendering = models.TextField(blank=True, default="")
    english_rendering = models.TextField(blank=True, default="")
    text_origins = models.JSONField(default=dict)  # {"transcription" | "ur" | "en": TextOrigin}
    derive_from = models.CharField(max_length=16, blank=True, default="")  # a correction awaiting AI re-derivation
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
    reviewed_texts = models.JSONField(default=list)  # what the reporter confirmed: transcription, ur, en (DG-62)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["submission"],
                condition=Q(resulting_report_id__isnull=False),
                name="one_reporting_confirmation_per_draft",
            )
        ]
        indexes = [models.Index(fields=["submission", "rendering_version"])]
