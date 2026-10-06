"""Report creation (API-140) and the citizen's own report views (API-150, API-151).

`create_citizen_report` is the one transaction of API Contract §7.3: verify
the confirmation, verify the evidence, create the report in SUBMITTED, issue
the reference, bind the rendering, record ownership, **seal the evidence**,
append the audit event. All succeed, or none happens. A replay never creates
a second report.

Sealing (DG-55): each item is read back from the processing area, its SHA-256
is checked again, and it is written once to the sealed store. The processing
copies are removed after the commit.
"""
from __future__ import annotations

import hashlib
import secrets
import uuid

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone

from parakh.audit.models import record
from parakh.core.errors import ApiError
from parakh.drafts.models import ClientSubmission, EvidenceObject, RenderingConfirmation, VoiceTranscriptionArtifact
from parakh.drafts.services import (
    active_artifact, evidence_required, integrity, is_complete_rendering, is_full_confirmation, manifest_hash,
    not_found, owned_draft, rendering_incomplete, require_active,
)
from parakh.drafts.storage import get_storage

from .models import CivicReport, ReportOwnership, ReportTimelineEntry

# Crockford base32 without I, L, O, U: readable aloud, no lookalikes. Random, never sequential.
_ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"


def new_report_reference() -> str:
    chars = "".join(secrets.choice(_ALPHABET) for _ in range(8))
    return f"PRK-{chars[:4]}-{chars[4:]}"


def _completeness(draft: ClientSubmission) -> str:
    kinds = set(draft.evidence.filter(deleted_at__isnull=True, status=EvidenceObject.Status.COMPLETE)
                .values_list("kind", flat=True))
    if EvidenceObject.Kind.PHOTO in kinds or EvidenceObject.Kind.VIDEO in kinds:
        return CivicReport.EvidenceCompleteness.PHOTOGRAPHIC
    if EvidenceObject.Kind.VOICE_ORIGINAL in kinds:
        return CivicReport.EvidenceCompleteness.PARTIAL
    return CivicReport.EvidenceCompleteness.NONE


def _current_confirmation(draft: ClientSubmission) -> RenderingConfirmation | None:
    """The reporter's full confirmation of the current, complete version, or None (DG-62; R-007).

    Complete: the transcription, the Urdu text and the English text exist, and the stored hash is
    the current three-text hash. Full: it names all three texts. A confirmation made before
    2026-10-06 names none, so it never qualifies.
    """
    active = active_artifact(draft)
    if active is None or not is_complete_rendering(active):
        return None
    for confirmation in draft.confirmations.filter(artifact=active).order_by("-confirmed_at"):
        if is_full_confirmation(confirmation, active):
            return confirmation
    return None


def create_citizen_report(subject, client_submission_id, idempotency_key: uuid.UUID) -> tuple[CivicReport, bool]:
    """API-140. Returns (report, created). A replay returns the original report."""
    try:
        report, created, sealed_keys = _create(subject, client_submission_id, idempotency_key)
        storage = get_storage()
        for key in sealed_keys:  # after the commit: the temporary copies are no longer needed
            storage.delete_processing(key)
        return report, created
    except IntegrityError:
        # A concurrent retry committed first. Exactly one report exists; return it.
        draft = owned_draft(subject, client_submission_id)
        report = CivicReport.objects.filter(client_submission_id=draft.client_submission_id).first()
        if report is None:
            raise
        return report, False


def _create(subject, client_submission_id, idempotency_key) -> tuple[CivicReport, bool, list[str]]:
    now = timezone.now()
    storage = get_storage()
    with transaction.atomic():
        draft = owned_draft(subject, client_submission_id, for_update=True)
        if draft.resulting_report_id:
            return CivicReport.objects.get(id=draft.resulting_report_id), False, []
        require_active(draft)  # a cancelled or expired draft cannot become a report
        if CivicReport.objects.filter(submission_idempotency_key=idempotency_key).exists():
            raise ApiError("E_IDEMPOTENCY_CONFLICT", "This request was already used for something else.", 409)
        if draft.manifest_completed_at is None:
            raise ApiError("E_UPLOAD_INCOMPLETE", "Some of your evidence has not finished sending.", 409,
                           evidence_ids=[])

        # Voice and typed descriptions alike need the current active version confirmed (DG-53, TEST-API-014),
        # with all three texts present and covered by the confirmation (DG-62, R-007).
        active = active_artifact(draft)
        if active is not None and active.processing_status == VoiceTranscriptionArtifact.ProcessingStatus.COMPLETED \
                and not is_complete_rendering(active):
            raise rendering_incomplete()
        confirmation = _current_confirmation(draft)
        if confirmation is None:
            raise ApiError("E_RENDERING_NOT_CONFIRMED", "Please check and confirm the text before sending.", 422)
        items = list(draft.evidence.filter(deleted_at__isnull=True, status=EvidenceObject.Status.COMPLETE))
        # Exactly the last completed manifest is sealed: its hash must still match the assembled items.
        if manifest_hash([(str(ev.client_evidence_id), ev.kind, ev.sha256, ev.byte_size) for ev in items]) \
                != draft.manifest_sha256:
            raise ApiError("E_UPLOAD_INCOMPLETE", "Some of your evidence has not finished sending.", 409,
                           evidence_ids=[])
        photos = sum(ev.kind == EvidenceObject.Kind.PHOTO for ev in items)
        if not settings.PARAKH_PHOTO_COUNT_MIN <= photos <= settings.PARAKH_PHOTO_COUNT_MAX:  # DG-47
            raise evidence_required()
        # Anything else — an item uploaded after the manifest, never completed — is discarded,
        # so no temporary data outlives the submission (DG-55).
        leftovers = list(draft.evidence.filter(deleted_at__isnull=True).exclude(id__in=[ev.id for ev in items]))
        for ev in leftovers:
            for chunk in ev.chunks.all():
                storage.delete_staging(chunk.staging_key)
            ev.chunks.all().delete()
            storage.delete_processing(ev.storage_key)
            ev.deleted_at = now
            ev.save(update_fields=["deleted_at"])
        # Location is required at API-130.
        for ev in items:  # seal: read back, check again, write once
            data = storage.get_processing(ev.storage_key)
            if hashlib.sha256(data).hexdigest() != ev.sha256:
                raise integrity([str(ev.client_evidence_id)])
            storage.seal(ev.storage_key, data)

        report = CivicReport.objects.create(
            report_reference=_unique_reference(),
            client_submission_id=draft.client_submission_id,
            reporter_kind=CivicReport.ReporterKind.CITIZEN,
            citizen_account_id=subject.subject_id,
            category=draft.category,
            description_mode=draft.description_mode,
            confirmed_rendering_artifact_id=confirmation.artifact_id,
            confirmed_rendering_version=confirmation.rendering_version,
            rendering_confirmation_id=confirmation.id,
            typed_description=draft.typed_description,
            latitude=draft.latitude,
            longitude=draft.longitude,
            location_accuracy_m=draft.location_accuracy_m,
            location_source=draft.location_source,
            location_unverified=draft.location_unverified,
            evidence_completeness=_completeness(draft),
            captured_at=draft.captured_at,
            received_at=draft.first_seen_at,
            created_at=now,
            state=CivicReport.State.SUBMITTED,
            submission_idempotency_key=idempotency_key,
        )
        ReportOwnership.objects.create(
            report=report, subject_type=subject.subject_type, subject_id=subject.subject_id, established_at=now
        )
        ReportTimelineEntry.objects.create(report=report, state=CivicReport.State.SUBMITTED, occurred_at=now)
        draft.resulting_report_id = report.id
        draft.updated_at = now
        draft.save(update_fields=["resulting_report_id", "updated_at"])
        confirmation.resulting_report_id = report.id
        confirmation.save(update_fields=["resulting_report_id"])
        draft.evidence.filter(id__in=[ev.id for ev in items]).update(report_id=report.id, sealed_at=now)
        record(
            "report_created",
            actor_kind=subject.subject_type,
            actor_account_id=subject.subject_id,
            report_id=str(report.id),
            client_submission_id=str(draft.client_submission_id),
            new_state=report.state,
            sealed_items=len(items),
        )
    return report, True, [ev.storage_key for ev in items]


def _unique_reference() -> str:
    for _ in range(8):
        reference = new_report_reference()
        if not CivicReport.objects.filter(report_reference=reference).exists():
            return reference
    raise RuntimeError("could not allocate a report reference")


# --- reads: own reports only, explicit allow-lists -------------------------------------
def owned_reports(subject):
    return CivicReport.objects.filter(
        ownerships__subject_type=subject.subject_type, ownerships__subject_id=subject.subject_id
    ).distinct()


def owned_report(subject, report_id) -> CivicReport:
    try:
        rid = uuid.UUID(str(report_id))
    except ValueError:
        raise not_found() from None
    report = owned_reports(subject).filter(id=rid).first()
    if report is None:  # not found and not owned look the same (TEST-API-019)
        raise not_found()
    return report


def creation_body(report: CivicReport) -> dict:
    """The API-140 response: the first moment a reference exists."""
    return {
        "report_id": str(report.id),
        "report_reference": report.report_reference,
        "state": report.state,
        "created_at": report.created_at.isoformat(),
    }


def summary_item(report: CivicReport) -> dict:
    return {
        "report_id": str(report.id),
        "report_reference": report.report_reference,
        "category": report.category,
        "state": report.state,
        "created_at": report.created_at.isoformat(),
        "captured_at": report.captured_at.isoformat(),
    }


def detail_body(report: CivicReport) -> dict:
    """API-151. Excludes source_asr_text, staff identities, staff notes and audit internals (API Contract §9.2)."""
    artifact = VoiceTranscriptionArtifact.objects.get(id=report.confirmed_rendering_artifact_id)
    description = {
        "mode": report.description_mode,
        # Exactly the texts the reporter confirmed: their words, the Urdu text and the English text (DG-62).
        # A report made before 2026-10-06 has the Urdu text only; it is shown as it was, never filled in.
        "bilingual": bool(artifact.transcription and artifact.english_rendering),
        "source_language": artifact.source_language or None,
        "transcription": artifact.transcription or None,
        "urdu_civic_rendering": artifact.urdu_civic_rendering,
        "english_rendering": artifact.english_rendering or None,
        "text_origins": artifact.text_origins or None,
        "rendering_version": report.confirmed_rendering_version,
        "rendering_status": "reporter_confirmed",
        "ai_generated": True,  # produced or translated by AI, then confirmed by the reporter
        "simulated": artifact.simulated,
    }
    if report.description_mode == ClientSubmission.DescriptionMode.TYPED:
        description["typed_description"] = report.typed_description  # the reporter's own words
    evidence = [
        {
            "evidence_id": str(ev.id),
            "client_evidence_id": str(ev.client_evidence_id),
            "kind": ev.kind,
            "mime_type": ev.mime_type,
            "byte_size": ev.byte_size,
            "duration_seconds": ev.duration_seconds,
            "captured_at": ev.captured_at.isoformat(),
        }
        for ev in EvidenceObject.objects.filter(report_id=report.id, sealed_at__isnull=False).order_by("created_at")
    ]
    return {
        **summary_item(report),
        "location": {
            "latitude": float(report.latitude),
            "longitude": float(report.longitude),
            "accuracy_m": report.location_accuracy_m,
            "unverified": report.location_unverified,
        },
        "description": description,
        "evidence": evidence,
        "evidence_completeness": report.evidence_completeness,
        "timeline": [{"state": t.state, "occurred_at": t.occurred_at.isoformat()} for t in report.timeline.all()],
    }


def owned_evidence(subject, report_id, evidence_id) -> EvidenceObject:
    report = owned_report(subject, report_id)
    try:
        eid = uuid.UUID(str(evidence_id))
    except ValueError:
        raise not_found() from None
    evidence = EvidenceObject.objects.filter(id=eid, report_id=report.id, sealed_at__isnull=False).first()
    if evidence is None:
        raise not_found()
    return evidence


def unsent_drafts(subject):
    """Active server-side drafts with no report yet. They carry no reference (FR-PUB.31)."""
    return ClientSubmission.objects.filter(
        reporter_subject_type=subject.subject_type,
        reporter_account_id=subject.subject_id,
        resulting_report_id__isnull=True,
        cancelled_at__isnull=True,
        expired_at__isnull=True,
    ).order_by("-first_seen_at")

