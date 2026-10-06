"""R-007: renderings made before 2026-10-06 must be prepared again in Urdu and English.

0003 added the transcription and the English text with empty defaults. An
unsubmitted draft whose current version predates it holds an Urdu text with
an Urdu-only hash, and possibly a confirmation that names no texts. Neither
may become a report (DG-62). For each such draft this migration:

- keeps the old version and any confirmation of it, unchanged, as history;
- adds a new QUEUED version that supersedes it, so the text is rendered again
  into all three texts and the reporter must confirm afresh.

It never touches a submitted report, its rendering or its confirmation. A
queued version is processed by `manage.py process_queued_renderings`, or when
the device replays its manifest. The migration calls no AI service.
"""
import hashlib
import json
import unicodedata

from django.db import migrations
from django.utils import timezone

REGENERATE_FROM = ("COMPLETED", "REVIEW_REQUIRED")


def _canonical(text: str) -> str:
    return unicodedata.normalize("NFC", text).replace("\r\n", "\n").replace("\r", "\n").strip()


def _three_text_hash(transcription: str, urdu: str, english: str) -> str:
    """The content hash of 2026-10-06 (frozen here so this migration never changes meaning)."""
    payload = json.dumps(
        {"en": _canonical(english), "transcription": _canonical(transcription), "ur": _canonical(urdu)},
        ensure_ascii=False, sort_keys=True, separators=(",", ":"),
    )
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _is_bilingual(artifact) -> bool:
    return bool(
        artifact.transcription and artifact.urdu_civic_rendering and artifact.english_rendering
        and artifact.rendering_content_hash
        == _three_text_hash(artifact.transcription, artifact.urdu_civic_rendering, artifact.english_rendering)
    )


def regenerate(apps, schema_editor):
    Draft = apps.get_model("drafts", "ClientSubmission")
    Artifact = apps.get_model("drafts", "VoiceTranscriptionArtifact")
    now = timezone.now()
    regenerated = []
    drafts = Draft.objects.filter(resulting_report_id__isnull=True, cancelled_at__isnull=True, expired_at__isnull=True)
    for draft in drafts.order_by("first_seen_at"):
        active = Artifact.objects.filter(submission_id=draft.id, is_active_version=True).first()
        if active is None or active.processing_status not in REGENERATE_FROM or _is_bilingual(active):
            continue
        newest = Artifact.objects.filter(submission_id=draft.id).order_by("-rendering_version").first()
        active.is_active_version = False
        active.save(update_fields=["is_active_version"])
        Artifact.objects.create(
            submission_id=draft.id,
            source_kind=active.source_kind,
            source_audio_evidence_id=active.source_audio_evidence_id,
            source_text_sha256=active.source_text_sha256,
            rendering_version=newest.rendering_version + 1,
            is_active_version=True,
            supersedes_artifact_id=active.id,
            origin="ai",
            processing_status="QUEUED",
            created_at=now,
        )
        draft.pipeline_state = "TRANSCRIPTION_PROCESSING"
        draft.save(update_fields=["pipeline_state"])  # not reporter activity: the clean-up clock is untouched
        regenerated.append(str(draft.client_submission_id))
    if regenerated:
        from parakh.audit.models import record  # only reached when there is legacy data to move

        for csid in regenerated:
            record("rendering_requeued_for_bilingual_text", client_submission_id=csid, reason="R-007")


class Migration(migrations.Migration):
    dependencies = [
        ("drafts", "0003_bilingual_report_text"),
        ("audit", "0001_initial"),
    ]

    operations = [migrations.RunPython(regenerate, migrations.RunPython.noop)]
