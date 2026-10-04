"""Draft pipeline services: API-130…API-135 and the rendering correction route.

Body shapes and the error codes that no source fixes are PROPOSED; see
docs/api/CITIZEN_REPORTING_CONTRACT.md.

Rules that come from the sources:
- Every draft is resolved from the authenticated subject. A draft belonging
  to someone else gets the same 404 as one that does not exist.
- A client-declared hash is never proof: the server recomputes every chunk,
  every item and the whole manifest (E_CAPTURE_INTEGRITY).
- `source_asr_text` is never returned on a citizen route.
- A correction creates a new rendering version; nothing is overwritten.
- A confirmation binds one exact version and content hash. A superseded
  version or a different hash is refused with 409; the server never accepts
  an older version or upgrades a confirmation to a newer one.
"""
from __future__ import annotations

import base64
import binascii
import hashlib
import json
import logging
import math
import unicodedata
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta
from decimal import ROUND_HALF_UP, Decimal, InvalidOperation

from django.conf import settings
from django.db import IntegrityError, transaction
from django.utils import timezone
from django.utils.dateparse import parse_datetime

from parakh.audit.models import record
from parakh.core.errors import ApiError

from . import ai
from .models import ClientSubmission, EvidenceChunk, EvidenceObject, RenderingConfirmation, VoiceTranscriptionArtifact
from .storage import get_storage, new_storage_key

log = logging.getLogger(__name__)

State = ClientSubmission.PipelineState
Status = VoiceTranscriptionArtifact.ProcessingStatus
Kind = EvidenceObject.Kind

MAX_TYPED_DESCRIPTION = 4000
MAX_RENDERING = 5000
FUTURE_TOLERANCE = timedelta(minutes=10)


# --- errors -----------------------------------------------------------------
def not_found() -> ApiError:
    return ApiError("E_NOT_FOUND", "Not found.", 404)


def invalid(field: str) -> ApiError:
    return ApiError("E_VALIDATION", "Some information is missing or invalid.", 400, field=field)


def stale() -> ApiError:
    return ApiError("E_STALE_STATE", "This has changed since you last looked. Refreshing.", 409)


def integrity(evidence_ids: list[str], **extra) -> ApiError:
    return ApiError(
        "E_CAPTURE_INTEGRITY", "Some of your evidence did not arrive correctly.", 422, evidence_ids=evidence_ids, **extra
    )


# --- hashing ----------------------------------------------------------------
def canonical_rendering(text: str) -> str:
    """The canonical form a content hash is computed over: NFC, LF line endings, trimmed."""
    return unicodedata.normalize("NFC", text).replace("\r\n", "\n").replace("\r", "\n").strip()


def rendering_hash(text: str) -> str:
    return hashlib.sha256(canonical_rendering(text).encode("utf-8")).hexdigest()


def manifest_hash(entries: list[tuple[str, str, str, int]]) -> str:
    """SHA-256 over one line `evidence_id:kind:sha256:byte_size` per item, sorted by evidence_id."""
    lines = "".join(f"{eid}:{kind}:{sha}:{size}\n" for eid, kind, sha, size in sorted(entries))
    return hashlib.sha256(lines.encode("utf-8")).hexdigest()


def _fingerprint(data: dict) -> str:
    return hashlib.sha256(json.dumps(data, sort_keys=True, default=str).encode()).hexdigest()


# --- parsing helpers ----------------------------------------------------------
def _uuid(value, field: str) -> uuid.UUID:
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError, AttributeError):
        raise invalid(field) from None


def _datetime(value, field: str) -> datetime:
    parsed = parse_datetime(value) if isinstance(value, str) else None
    if parsed is None or parsed.tzinfo is None:
        raise invalid(field)
    if parsed > timezone.now() + FUTURE_TOLERANCE:
        raise invalid(field)
    return parsed


def _number(value, field: str, low: float, high: float) -> float:
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not low <= value <= high:
        raise invalid(field)
    return float(value)


def _coordinate(value, field: str, limit: int) -> Decimal:
    number = _number(value, field, -limit, limit)
    try:
        return Decimal(str(number)).quantize(Decimal("0.000001"), rounding=ROUND_HALF_UP)
    except InvalidOperation:
        raise invalid(field) from None


def _sha(value, field: str) -> str:
    if not isinstance(value, str) or len(value) != 64 or any(c not in "0123456789abcdef" for c in value):
        raise invalid(field)
    return value


def _body(body) -> dict:
    if not isinstance(body, dict):
        raise invalid("body")
    return body


def _owns(subject, draft: ClientSubmission) -> bool:
    return draft.reporter_subject_type == subject.subject_type and draft.reporter_account_id == subject.subject_id


def owned_draft(subject, client_submission_id, *, for_update: bool = False) -> ClientSubmission:
    csid = _uuid(client_submission_id, "client_submission_id")
    qs = ClientSubmission.objects.select_for_update() if for_update else ClientSubmission.objects
    draft = qs.filter(client_submission_id=csid).first()
    if draft is None or not _owns(subject, draft):
        raise not_found()
    return draft


def active_artifact(draft: ClientSubmission) -> VoiceTranscriptionArtifact | None:
    return draft.artifacts.filter(is_active_version=True).first()


# --- API-130: open a draft ------------------------------------------------------
def _parse_draft(body) -> dict:
    body = _body(body)
    category = body.get("category")
    if category not in settings.PARAKH_CATEGORIES:
        raise invalid("category")
    mode = body.get("description_mode")
    if mode not in ClientSubmission.DescriptionMode.values:
        raise invalid("description_mode")
    typed = body.get("typed_description") or ""
    if not isinstance(typed, str) or len(typed) > MAX_TYPED_DESCRIPTION:
        raise invalid("typed_description")
    typed = typed.strip()
    if (mode == "typed") != bool(typed):  # one description modality, never both (DR-28)
        raise invalid("typed_description")
    location = body.get("location")
    if not isinstance(location, dict):
        raise invalid("location")
    source = location.get("source")
    if source not in ClientSubmission.LocationSource.values:
        raise invalid("location.source")
    accuracy = location.get("accuracy_m")
    if accuracy is not None:
        accuracy = _number(accuracy, "location.accuracy_m", 0, 100_000)
    unverified = location.get("unverified", False)
    if not isinstance(unverified, bool):
        raise invalid("location.unverified")
    return {
        "client_submission_id": _uuid(body.get("client_submission_id"), "client_submission_id"),
        "category": category,
        "description_mode": mode,
        "typed_description": typed,
        "latitude": _coordinate(location.get("latitude"), "location.latitude", 90),
        "longitude": _coordinate(location.get("longitude"), "location.longitude", 180),
        "location_accuracy_m": accuracy,
        "location_source": source,
        # A manual pin is always unverified (FR-PUB.24).
        "location_unverified": source == "manual" or unverified,
        "captured_at": _datetime(body.get("captured_at"), "captured_at"),
    }


_EDITABLE = ("category", "typed_description", "latitude", "longitude", "location_accuracy_m", "location_source",
             "location_unverified", "captured_at")


def open_draft(subject, body) -> tuple[ClientSubmission, bool]:
    """API-130. Idempotent on client_submission_id; an edit before submission updates the draft."""
    data = _parse_draft(body)
    digest = _fingerprint({k: v for k, v in data.items()})
    now = timezone.now()
    try:
        with transaction.atomic():
            draft = ClientSubmission.objects.select_for_update().filter(
                client_submission_id=data["client_submission_id"]
            ).first()
            if draft is not None:
                return _reopen(subject, draft, data, digest, now), False
            draft = ClientSubmission.objects.create(
                reporter_subject_type=subject.subject_type,
                reporter_account_id=subject.subject_id,
                payload_hash=digest,
                pipeline_state=State.LOCAL_DRAFT,
                first_seen_at=now,
                updated_at=now,
                retry_window_ends_at=now + timedelta(days=settings.PARAKH_DRAFT_RETRY_WINDOW_DAYS),
                **data,
            )
            record(
                "draft_opened",
                actor_kind=subject.subject_type,
                actor_account_id=subject.subject_id,
                client_submission_id=str(draft.client_submission_id),
            )
            return draft, True
    except IntegrityError:
        # A concurrent API-130 with the same id won the insert: treat this one as its replay.
        with transaction.atomic():
            draft = ClientSubmission.objects.select_for_update().get(client_submission_id=data["client_submission_id"])
            return _reopen(subject, draft, data, digest, now), False


def _reopen(subject, draft: ClientSubmission, data: dict, digest: str, now) -> ClientSubmission:
    if not _owns(subject, draft):
        raise not_found()
    if draft.payload_hash == digest:
        return draft  # replay
    if draft.resulting_report_id or (
        draft.manifest_completed_at and data["description_mode"] != draft.description_mode
    ):
        raise stale()
    if data["description_mode"] != draft.description_mode:
        draft.description_mode = data["description_mode"]
    for field in _EDITABLE:
        setattr(draft, field, data[field])
    draft.payload_hash = digest
    draft.updated_at = now
    draft.save()
    return draft


# --- API-131: one evidence chunk ------------------------------------------------
_MIME = {
    Kind.PHOTO: ("image/jpeg", "image/png"),
    Kind.VOICE_ORIGINAL: (
        "audio/mp4", "audio/m4a", "audio/x-m4a", "audio/aac", "audio/mpeg", "audio/3gpp", "audio/webm", "audio/wav",
    ),
}


@dataclass(frozen=True)
class _Chunk:
    evidence_id: uuid.UUID
    kind: str
    mime_type: str
    byte_size: int
    sha256: str
    captured_at: datetime
    chunk_index: int
    chunk_count: int
    chunk_sha256: str
    data: bytes


def _parse_chunk(body) -> _Chunk:
    body = _body(body)
    limits = settings.PARAKH_EVIDENCE
    kind = body.get("kind")
    if kind not in _MIME:  # photo and voice only in Phase 1
        raise invalid("kind")
    mime = body.get("mime_type")
    if mime not in _MIME[kind]:
        raise invalid("mime_type")
    size = body.get("byte_size")
    if isinstance(size, bool) or not isinstance(size, int) or not 0 < size <= limits["ITEM_MAX_BYTES"]:
        raise invalid("byte_size")
    count, index = body.get("chunk_count"), body.get("chunk_index")
    if isinstance(count, bool) or not isinstance(count, int) or count < math.ceil(size / limits["CHUNK_MAX_BYTES"]):
        raise invalid("chunk_count")
    if count > size or isinstance(index, bool) or not isinstance(index, int) or not 0 <= index < count:
        raise invalid("chunk_index")
    encoded = body.get("chunk_base64")
    if not isinstance(encoded, str):
        raise invalid("chunk_base64")
    try:
        data = base64.b64decode(encoded, validate=True)
    except (binascii.Error, ValueError):
        raise invalid("chunk_base64") from None
    if not 0 < len(data) <= limits["CHUNK_MAX_BYTES"]:
        raise invalid("chunk_base64")
    return _Chunk(
        evidence_id=_uuid(body.get("evidence_id"), "evidence_id"),
        kind=kind,
        mime_type=mime,
        byte_size=size,
        sha256=_sha(body.get("sha256"), "sha256"),
        captured_at=_datetime(body.get("captured_at"), "captured_at"),
        chunk_index=index,
        chunk_count=count,
        chunk_sha256=_sha(body.get("chunk_sha256"), "chunk_sha256"),
        data=data,
    )


def receive_chunk(subject, client_submission_id, body) -> dict:
    """API-131. Per-chunk idempotent. The server recomputes the chunk hash before storing anything."""
    chunk = _parse_chunk(body)
    if hashlib.sha256(chunk.data).hexdigest() != chunk.chunk_sha256:
        raise integrity([str(chunk.evidence_id)], chunk_index=chunk.chunk_index)
    storage = get_storage()
    now = timezone.now()
    with transaction.atomic():
        draft = owned_draft(subject, client_submission_id, for_update=True)
        if draft.resulting_report_id:
            raise stale()
        evidence = draft.evidence.filter(client_evidence_id=chunk.evidence_id).first()
        if evidence is None:
            if draft.evidence.filter(deleted_at__isnull=True).count() >= settings.PARAKH_EVIDENCE["MAX_ITEMS"]:
                raise invalid("evidence_count")
            evidence = EvidenceObject.objects.create(
                submission=draft,
                client_evidence_id=chunk.evidence_id,
                kind=chunk.kind,
                mime_type=chunk.mime_type,
                byte_size=chunk.byte_size,
                declared_sha256=chunk.sha256,
                chunk_count=chunk.chunk_count,
                captured_at=chunk.captured_at,
                storage_key=new_storage_key(),
                uploaded_by_kind=subject.subject_type,
                created_at=now,
            )
        else:
            if evidence.deleted_at:
                raise stale()
            same = (evidence.kind, evidence.mime_type, evidence.byte_size, evidence.declared_sha256,
                    evidence.chunk_count, evidence.captured_at) == (
                chunk.kind, chunk.mime_type, chunk.byte_size, chunk.sha256, chunk.chunk_count, chunk.captured_at)
            if not same:
                raise invalid("evidence_metadata")
        if evidence.status == EvidenceObject.Status.RECEIVING:
            existing = evidence.chunks.filter(index=chunk.chunk_index).first()
            if existing is None:
                key = new_storage_key()
                storage.put_staging(key, chunk.data)
                EvidenceChunk.objects.create(
                    evidence=evidence, index=chunk.chunk_index, sha256=chunk.chunk_sha256,
                    byte_size=len(chunk.data), staging_key=key, received_at=now,
                )
            elif existing.sha256 != chunk.chunk_sha256:
                raise integrity([str(chunk.evidence_id)], chunk_index=chunk.chunk_index)
        if draft.pipeline_state == State.LOCAL_DRAFT:
            draft.pipeline_state = State.UPLOADING
            draft.updated_at = now
            draft.save(update_fields=["pipeline_state", "updated_at"])
        received = evidence.chunk_count if evidence.status == EvidenceObject.Status.COMPLETE else evidence.chunks.count()
    return {
        "evidence_id": str(evidence.client_evidence_id),
        "chunk_index": chunk.chunk_index,
        "received_chunks": received,
        "chunk_count": evidence.chunk_count,
        "all_chunks_received": received == evidence.chunk_count,
    }


# --- API-132: complete the manifest ------------------------------------------------
def _parse_manifest(body) -> tuple[list[dict], str]:
    body = _body(body)
    items = body.get("manifest")
    if not isinstance(items, list) or len(items) > settings.PARAKH_EVIDENCE["MAX_ITEMS"]:
        raise invalid("manifest")
    entries, seen = [], set()
    for item in items:
        if not isinstance(item, dict):
            raise invalid("manifest")
        eid = _uuid(item.get("evidence_id"), "manifest.evidence_id")
        size = item.get("byte_size")
        if eid in seen or item.get("kind") not in _MIME or isinstance(size, bool) or not isinstance(size, int):
            raise invalid("manifest")
        seen.add(eid)
        entries.append({"evidence_id": eid, "kind": item["kind"], "sha256": _sha(item.get("sha256"), "manifest.sha256"),
                        "byte_size": size})
    return entries, _sha(body.get("manifest_sha256"), "manifest_sha256")


def _looks_like(mime: str, data: bytes) -> bool:
    """Magic-byte check: the bytes must be the type the device declared (T-054)."""
    head = data[:16]
    if mime == "image/jpeg":
        return head.startswith(b"\xff\xd8\xff")
    if mime == "image/png":
        return head.startswith(b"\x89PNG\r\n\x1a\n")
    if mime in ("audio/mp4", "audio/m4a", "audio/x-m4a", "audio/3gpp"):
        return head[4:8] == b"ftyp"
    if mime == "audio/aac":
        return len(head) > 1 and head[0] == 0xFF and head[1] & 0xF6 == 0xF0  # ADTS sync word
    if mime == "audio/mpeg":
        return head.startswith(b"ID3") or (len(head) > 1 and head[0] == 0xFF and head[1] & 0xE0 == 0xE0)
    if mime == "audio/webm":
        return head.startswith(b"\x1a\x45\xdf\xa3")
    if mime == "audio/wav":
        return head.startswith(b"RIFF") and head[8:12] == b"WAVE"
    return False


def _discard_chunks(storage, evidence: EvidenceObject) -> None:
    for c in evidence.chunks.all():
        storage.delete_staging(c.staging_key)
    evidence.chunks.all().delete()


def complete_manifest(subject, client_submission_id, body) -> ClientSubmission:
    """API-132. Replay-safe. Assembles each item, recomputes its hash, then the whole-manifest hash.

    A replay of the same manifest after a processing failure queues a new
    processing attempt (the citizen's "Retry"). A changed manifest — a
    re-recording, or a photo retaken or deleted before submission — replaces
    the previous one; items no longer listed are discarded.
    """
    entries, client_hash = _parse_manifest(body)
    storage = get_storage()
    now = timezone.now()
    problem: ApiError | None = None
    queued: VoiceTranscriptionArtifact | None = None
    with transaction.atomic():
        draft = owned_draft(subject, client_submission_id, for_update=True)
        if draft.resulting_report_id:  # a report exists: only an identical replay is answered
            if draft.manifest_sha256 != client_hash:
                raise stale()
            return draft
        live = {e.client_evidence_id: e for e in draft.evidence.filter(deleted_at__isnull=True)}
        listed = {e["evidence_id"] for e in entries}
        voices = [e for e in entries if e["kind"] == Kind.VOICE_ORIGINAL]
        if draft.description_mode == ClientSubmission.DescriptionMode.VOICE and len(voices) != 1:
            raise invalid("manifest.voice_original")
        if draft.description_mode == ClientSubmission.DescriptionMode.TYPED and voices:
            raise invalid("manifest.voice_original")
        photo_max = settings.PARAKH_PHOTO_COUNT_MAX  # None until Hassan decides (DG-47)
        if photo_max is not None and sum(e["kind"] == Kind.PHOTO for e in entries) > photo_max:
            raise invalid("manifest.photo_count")
        missing = sorted(str(eid) for eid in listed - set(live))
        if missing:
            raise ApiError("E_UPLOAD_INCOMPLETE", "Some of your evidence has not finished sending.", 409,
                           evidence_ids=missing)

        incomplete, bad, wrong_type = {}, [], []
        for entry in entries:
            ev = live[entry["evidence_id"]]
            if (ev.kind, ev.byte_size, ev.declared_sha256) != (entry["kind"], entry["byte_size"], entry["sha256"]):
                bad.append(str(ev.client_evidence_id))
                continue
            if ev.status == EvidenceObject.Status.COMPLETE:
                continue
            chunks = list(ev.chunks.order_by("index"))
            if len(chunks) != ev.chunk_count:
                have = {c.index for c in chunks}
                incomplete[str(ev.client_evidence_id)] = [i for i in range(ev.chunk_count) if i not in have]
                continue
            data = b"".join(storage.get_staging(c.staging_key) for c in chunks)
            if len(data) != ev.byte_size or hashlib.sha256(data).hexdigest() != ev.declared_sha256:
                _discard_chunks(storage, ev)  # the client re-uploads this item
                bad.append(str(ev.client_evidence_id))
                continue
            if not _looks_like(ev.mime_type, data):
                _discard_chunks(storage, ev)
                wrong_type.append(str(ev.client_evidence_id))
                continue
            storage.put_evidence(ev.storage_key, data)
            ev.sha256 = hashlib.sha256(data).hexdigest()
            ev.status = EvidenceObject.Status.COMPLETE
            ev.completed_at = now
            ev.save(update_fields=["sha256", "status", "completed_at"])
            _discard_chunks(storage, ev)

        if incomplete:
            problem = ApiError("E_UPLOAD_INCOMPLETE", "Some of your evidence has not finished sending.", 409,
                               evidence_ids=sorted(incomplete), missing_chunks=incomplete)
        elif bad:
            problem = integrity(sorted(bad))
        elif wrong_type:
            problem = ApiError("E_VALIDATION", "Some information is missing or invalid.", 400,
                               field="evidence_type", evidence_ids=sorted(wrong_type))
        else:
            server_hash = manifest_hash(
                [(str(eid), live[eid].kind, live[eid].sha256, live[eid].byte_size) for eid in listed]
            )
            if server_hash != client_hash:
                problem = integrity([], reason="manifest")
            else:
                queued = _settle_manifest(subject, draft, live, listed, server_hash, now, storage)
    # Outcomes are decided inside the transaction and raised after it commits, so items that did
    # arrive intact stay assembled (write-once storage cannot be rolled back).
    if problem:
        raise problem
    if queued is not None:
        submit_processing(queued.id)
        draft.refresh_from_db()
    return draft


def _settle_manifest(subject, draft, live, listed, server_hash, now, storage):
    replay = draft.manifest_completed_at is not None and draft.manifest_sha256 == server_hash
    for eid, ev in live.items():
        if eid not in listed:  # retaken or deleted before submission (FR-PUB.6)
            _discard_chunks(storage, ev)
            if ev.status == EvidenceObject.Status.COMPLETE:
                storage.discard_unsubmitted_evidence(ev.storage_key)
            ev.deleted_at = now
            ev.save(update_fields=["deleted_at"])
    draft.manifest_sha256 = server_hash
    draft.manifest_completed_at = draft.manifest_completed_at if replay else now
    queued = None
    if draft.description_mode == ClientSubmission.DescriptionMode.VOICE:
        voice = next(live[eid] for eid in listed if live[eid].kind == Kind.VOICE_ORIGINAL)
        active = active_artifact(draft)
        usable = active is not None and active.source_audio_evidence_id == voice.id and active.processing_status in (
            Status.QUEUED, Status.PROCESSING, Status.COMPLETED)
        if not usable:
            queued = _new_artifact(draft, voice, previous=active, now=now)
    draft.pipeline_state = settle_state(draft)
    draft.updated_at = now
    draft.save(update_fields=["manifest_sha256", "manifest_completed_at", "pipeline_state", "updated_at"])
    if not replay:
        record("evidence_manifest_completed", actor_kind=subject.subject_type, actor_account_id=subject.subject_id,
               client_submission_id=str(draft.client_submission_id), items=len(listed))
    return queued


def _new_artifact(draft, voice, *, previous, now, **fields) -> VoiceTranscriptionArtifact:
    version = (draft.artifacts.order_by("-rendering_version").values_list("rendering_version", flat=True).first() or 0) + 1
    if previous is not None:
        previous.is_active_version = False
        previous.save(update_fields=["is_active_version"])
    return VoiceTranscriptionArtifact.objects.create(
        submission=draft,
        source_audio_evidence=voice,
        rendering_version=version,
        is_active_version=True,
        supersedes_artifact=previous,
        created_at=now,
        **fields,
    )


def settle_state(draft: ClientSubmission) -> str:
    """The pipeline state that follows from the draft's evidence, rendering and confirmations."""
    if draft.manifest_completed_at is None:
        return State.UPLOADING if draft.evidence.filter(deleted_at__isnull=True).exists() else State.LOCAL_DRAFT
    if draft.description_mode == ClientSubmission.DescriptionMode.TYPED:
        return State.READY_TO_SUBMIT
    active = active_artifact(draft)
    if active is None or active.processing_status in (Status.QUEUED, Status.PROCESSING):
        return State.TRANSCRIPTION_PROCESSING
    if active.processing_status != Status.COMPLETED:
        return State.SUBMISSION_FAILED
    confirmed = RenderingConfirmation.objects.filter(
        submission=draft, artifact=active, rendering_version=active.rendering_version,
        rendering_content_hash=active.rendering_content_hash,
    ).exists()
    return State.READY_TO_SUBMIT if confirmed else State.AWAITING_REPORTER_REVIEW


# --- AI processing (server-side only; FR-PUB.14) -------------------------------------
def submit_processing(artifact_id) -> None:
    """Hands an artefact to the configured runner. "inline" runs it now, after the commit."""
    if settings.PARAKH_AI_RUNNER != "inline":
        raise RuntimeError("Only the inline runner exists in this build")
    run_processing(artifact_id)


def run_processing(artifact_id) -> None:
    with transaction.atomic():
        artifact = VoiceTranscriptionArtifact.objects.select_for_update().filter(id=artifact_id).first()
        if artifact is None or artifact.processing_status != Status.QUEUED:
            return
        artifact.processing_status = Status.PROCESSING
        artifact.processing_started_at = timezone.now()
        artifact.save(update_fields=["processing_status", "processing_started_at"])
        voice = artifact.source_audio_evidence
        draft = artifact.submission
    outcome, failure = None, ""
    try:
        audio = get_storage().get_evidence(voice.storage_key)
        outcome = ai.get_adapter().render(audio, voice.mime_type, {"category": draft.category})
    except ai.ProcessingFailure as exc:
        failure = exc.code
    except Exception:  # never fabricate text; never crash the caller
        log.exception("rendering adapter error")
        failure = "ADAPTER_ERROR"
    with transaction.atomic():
        artifact = VoiceTranscriptionArtifact.objects.select_for_update().get(id=artifact_id)
        artifact.processing_completed_at = timezone.now()
        if outcome is None:
            artifact.processing_status = Status.FAILED
            artifact.failure_code = failure
        else:
            artifact.source_asr_text = outcome.source_asr_text
            artifact.urdu_civic_rendering = canonical_rendering(outcome.urdu_civic_rendering)
            artifact.rendering_content_hash = rendering_hash(outcome.urdu_civic_rendering)
            artifact.detected_languages = outcome.detected_languages
            artifact.critical_fields_json = outcome.critical_fields
            artifact.field_confidence_json = outcome.field_confidence
            artifact.overall_confidence = outcome.overall_confidence
            artifact.model_name, artifact.model_version = outcome.model_name, outcome.model_version
            artifact.simulated = outcome.simulated
            if outcome.needs_human_review:
                artifact.processing_status = Status.REVIEW_REQUIRED
                artifact.human_review_status = VoiceTranscriptionArtifact.HumanReviewStatus.PENDING
            else:
                artifact.processing_status = Status.COMPLETED
        artifact.save()
        draft = ClientSubmission.objects.select_for_update().get(id=artifact.submission_id)
        if artifact.is_active_version and not draft.resulting_report_id:
            draft.pipeline_state = settle_state(draft)
            draft.updated_at = timezone.now()
            draft.save(update_fields=["pipeline_state", "updated_at"])
        record(
            "rendering_produced" if outcome else "rendering_failed",
            client_submission_id=str(draft.client_submission_id),
            artifact_id=str(artifact.id),
            rendering_version=artifact.rendering_version,
            processing_status=artifact.processing_status,
            model_name=artifact.model_name,
            simulated=artifact.simulated,
            failure_code=artifact.failure_code,
        )


# --- the rendering correction route (named by path; DG-43) -----------------------------
def _stale_rendering_check(draft, artifact_id, version, content_hash) -> VoiceTranscriptionArtifact:
    artifact = draft.artifacts.filter(id=artifact_id).first()
    if artifact is None:
        raise not_found()
    if not artifact.is_active_version or artifact.rendering_version != version:
        raise ApiError("E_RENDERING_SUPERSEDED", "This text has been updated. Please read the new version.", 409)
    if artifact.processing_status != Status.COMPLETED:
        raise stale()
    if artifact.rendering_content_hash != content_hash:
        raise ApiError("E_RENDERING_HASH_MISMATCH", "This text has changed. Please read it again.", 409)
    return artifact


def _version(value, field: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 1:
        raise invalid(field)
    return value


def correct_rendering(subject, client_submission_id, body) -> VoiceTranscriptionArtifact:
    """The reporter's correction becomes a new version; the previous one is kept (FR-PUB.19)."""
    body = _body(body)
    artifact_id = _uuid(body.get("voice_transcription_artifact_id"), "voice_transcription_artifact_id")
    version = _version(body.get("rendering_version"), "rendering_version")
    content_hash = _sha(body.get("rendering_content_hash"), "rendering_content_hash")
    text = body.get("urdu_civic_rendering")
    if not isinstance(text, str) or not canonical_rendering(text) or len(text) > MAX_RENDERING:
        raise invalid("urdu_civic_rendering")
    fields = body.get("corrected_fields", [])
    if not isinstance(fields, list) or len(fields) > 20 or not all(isinstance(f, str) and len(f) <= 40 for f in fields):
        raise invalid("corrected_fields")
    now = timezone.now()
    with transaction.atomic():
        draft = owned_draft(subject, client_submission_id, for_update=True)
        if draft.resulting_report_id:
            raise stale()
        base = _stale_rendering_check(draft, artifact_id, version, content_hash)
        confidence = dict(base.field_confidence_json)
        for f in fields:
            if f in confidence:
                confidence[f] = 1.0  # checked by the reporter
        new = _new_artifact(
            draft, base.source_audio_evidence, previous=base, now=now,
            origin=VoiceTranscriptionArtifact.Origin.REPORTER_CORRECTION,
            detected_languages=base.detected_languages,
            source_asr_text=base.source_asr_text,
            urdu_civic_rendering=canonical_rendering(text),
            rendering_content_hash=rendering_hash(text),
            critical_fields_json=base.critical_fields_json,
            field_confidence_json=confidence,
            overall_confidence=base.overall_confidence,
            model_name=base.model_name,
            model_version=base.model_version,
            simulated=base.simulated,
            processing_status=Status.COMPLETED,
            processing_started_at=now,
            processing_completed_at=now,
        )
        draft.pipeline_state = settle_state(draft)
        draft.updated_at = now
        draft.save(update_fields=["pipeline_state", "updated_at"])
        record("rendering_corrected", actor_kind=subject.subject_type, actor_account_id=subject.subject_id,
               client_submission_id=str(draft.client_submission_id), artifact_id=str(new.id),
               rendering_version=new.rendering_version, supersedes_version=base.rendering_version)
    return new


# --- API-135: confirm one exact rendering version ---------------------------------------
def confirm_rendering(subject, client_submission_id, body, idempotency_key: uuid.UUID, app_version: str = ""):
    """All six checks of API Contract §6.2. Returns (confirmation, created)."""
    body = _body(body)
    fields = {
        "voice_transcription_artifact_id": _uuid(body.get("voice_transcription_artifact_id"),
                                                 "voice_transcription_artifact_id"),
        "client_submission_id": _uuid(body.get("client_submission_id"), "client_submission_id"),
        "rendering_version": _version(body.get("rendering_version"), "rendering_version"),
        "rendering_content_hash": _sha(body.get("rendering_content_hash"), "rendering_content_hash"),
        "reporter_subject_type": body.get("reporter_subject_type"),
        "reporter_account_id": _uuid(body.get("reporter_account_id"), "reporter_account_id"),
        "confirmed_at": _datetime(body.get("confirmed_at"), "confirmed_at"),
    }
    if str(fields["client_submission_id"]) != str(_uuid(client_submission_id, "client_submission_id")):
        raise invalid("client_submission_id")
    # Taken from the session, and rejected if the body disagrees.
    if fields["reporter_subject_type"] != subject.subject_type or fields["reporter_account_id"] != subject.subject_id:
        raise invalid("reporter")
    fingerprint = _fingerprint(fields)
    with transaction.atomic():
        prior = RenderingConfirmation.objects.filter(idempotency_key=idempotency_key).first()
        if prior is not None:
            if prior.reporter_account_id != subject.subject_id or prior.request_fingerprint != fingerprint:
                raise ApiError("E_IDEMPOTENCY_CONFLICT", "This request was already used for something else.", 409)
            return prior, False  # replay: the original result
        draft = owned_draft(subject, client_submission_id, for_update=True)
        if not draft.artifacts.filter(id=fields["voice_transcription_artifact_id"]).exists():
            raise not_found()
        if draft.resulting_report_id:  # check 5: already produced a report — return the original
            return draft.confirmations.get(resulting_report_id=draft.resulting_report_id), False
        artifact = _stale_rendering_check(
            draft, fields["voice_transcription_artifact_id"], fields["rendering_version"],
            fields["rendering_content_hash"],
        )
        confirmation = RenderingConfirmation.objects.create(
            artifact=artifact,
            submission=draft,
            rendering_version=artifact.rendering_version,
            rendering_content_hash=artifact.rendering_content_hash,
            reporter_subject_type=subject.subject_type,
            reporter_account_id=subject.subject_id,
            confirmed_at=timezone.now(),
            client_confirmed_at=fields["confirmed_at"],
            idempotency_key=idempotency_key,
            request_fingerprint=fingerprint,
            client_app_version=app_version[:32],
        )
        draft.pipeline_state = settle_state(draft)
        draft.updated_at = timezone.now()
        draft.save(update_fields=["pipeline_state", "updated_at"])
        record("rendering_confirmed", actor_kind=subject.subject_type, actor_account_id=subject.subject_id,
               client_submission_id=str(draft.client_submission_id), artifact_id=str(artifact.id),
               rendering_version=artifact.rendering_version)
    return confirmation, True


# --- response bodies: explicit allow-lists -------------------------------------------------
def rendering_body(artifact: VoiceTranscriptionArtifact) -> dict:
    """API-134. Never contains source_asr_text (FR-PUB.16)."""
    completed = artifact.processing_status == Status.COMPLETED
    threshold = settings.PARAKH_LOW_CONFIDENCE_THRESHOLD
    fields = []
    if completed:
        for key, value in artifact.critical_fields_json.items():
            confidence = artifact.field_confidence_json.get(key)
            fields.append({
                "key": key,
                "value": value,
                "confidence": confidence,
                "low_confidence": confidence is not None and confidence < threshold,
            })
    return {
        "voice_transcription_artifact_id": str(artifact.id),
        "client_submission_id": str(artifact.submission.client_submission_id),
        "rendering_version": artifact.rendering_version,
        "rendering_content_hash": artifact.rendering_content_hash if completed else None,
        "urdu_civic_rendering": artifact.urdu_civic_rendering if completed else None,
        "fields": fields,
        "overall_confidence": artifact.overall_confidence if completed else None,
        "processing_status": artifact.processing_status,
        "failure_code": artifact.failure_code or None,
        "origin": artifact.origin,
        "supersedes_rendering_version": artifact.supersedes_artifact.rendering_version
        if artifact.supersedes_artifact_id else None,
        "ai_generated": True,
        "simulated": artifact.simulated,
    }


def draft_body(draft: ClientSubmission) -> dict:
    """API-130 / API-133. A draft is not a report: no report reference, ever (TEST-API-016)."""
    active = active_artifact(draft) if draft.description_mode == ClientSubmission.DescriptionMode.VOICE else None
    evidence = []
    for ev in draft.evidence.filter(deleted_at__isnull=True).order_by("created_at"):
        received = ev.chunk_count if ev.status == EvidenceObject.Status.COMPLETE else ev.chunks.count()
        evidence.append({
            "evidence_id": str(ev.client_evidence_id),
            "kind": ev.kind,
            "status": ev.status,
            "byte_size": ev.byte_size,
            "received_chunks": received,
            "chunk_count": ev.chunk_count,
        })
    return {
        "client_submission_id": str(draft.client_submission_id),
        "pipeline_state": draft.pipeline_state,
        "reporter_subject_type": draft.reporter_subject_type,
        "reporter_account_id": str(draft.reporter_account_id),
        "category": draft.category,
        "description_mode": draft.description_mode,
        "typed_description": draft.typed_description or None,
        "location": {
            "latitude": float(draft.latitude),
            "longitude": float(draft.longitude),
            "accuracy_m": draft.location_accuracy_m,
            "source": draft.location_source,
            "unverified": draft.location_unverified,
        },
        "captured_at": draft.captured_at.isoformat(),
        "received_at": draft.first_seen_at.isoformat(),
        "evidence": evidence,
        "manifest_complete": draft.manifest_completed_at is not None,
        "rendering": rendering_body(active) if active else None,
        "submitted": draft.resulting_report_id is not None,
        "retry_window_ends_at": draft.retry_window_ends_at.isoformat(),
    }
