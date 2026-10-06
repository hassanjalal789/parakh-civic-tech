"""R-007: renderings made before 2026-10-06, carried through the real migrations.

Drafts are made through the API; then migration 0003 (and 0004) is unapplied,
the rows are given what the code of that time stored — an Urdu text with an
Urdu-only hash, and confirmations naming no texts — and the migrations are
applied again: 0003 adds the empty bilingual fields, 0004 re-queues the
unsubmitted renderings. Submitted reports must come through untouched.
"""
import hashlib
import io
import unicodedata
import uuid

from django.core.management import call_command
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

from parakh.audit.models import AuditEvent
from parakh.drafts.models import ClientSubmission, EvidenceObject, RenderingConfirmation, VoiceTranscriptionArtifact
from parakh.drafts.services import settle_state
from parakh.drafts.tests.base import ReportingTestCase, ReportingTransactionTestCase
from parakh.reports.models import CivicReport

BEFORE_BILINGUAL = ("drafts", "0002_rename_retry_window_ends_at_clientsubmission_temporary_data_expires_at_and_more")
URDU_TYPED = "سکول کے سامنے پانی کا پائپ پھٹ گیا ہے"


def legacy_hash(urdu: str) -> str:
    """The content hash before 2026-10-06: the Urdu text alone."""
    canonical = unicodedata.normalize("NFC", urdu).replace("\r\n", "\n").replace("\r", "\n").strip()
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def versions(csid: str):
    return VoiceTranscriptionArtifact.objects.filter(submission__client_submission_id=csid)


class LegacyRenderingMigrationTests(ReportingTransactionTestCase):
    @staticmethod
    def migrate(targets):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(targets)
        return executor.loader.project_state(targets).apps

    @staticmethod
    def latest():
        return MigrationExecutor(connection).loader.graph.leaf_nodes()

    def setUp(self):
        super().setUp()
        self.addCleanup(self.migrate, self.latest())  # never leave the schema rolled back

    def replay_legacy(self):
        """Unapply the bilingual migrations, store what the old code stored, and apply them again."""
        old = self.migrate([BEFORE_BILINGUAL])
        Artifact = old.get_model("drafts", "VoiceTranscriptionArtifact")
        Confirmation = old.get_model("drafts", "RenderingConfirmation")
        for artifact in Artifact.objects.exclude(urdu_civic_rendering=""):
            digest = legacy_hash(artifact.urdu_civic_rendering)
            Confirmation.objects.filter(artifact_id=artifact.id).update(rendering_content_hash=digest)
            artifact.rendering_content_hash = digest
            artifact.save(update_fields=["rendering_content_hash"])
        self.migrate(self.latest())

    def test_unsubmitted_legacy_drafts_are_rendered_again_and_need_a_fresh_confirmation(self):
        confirmed, confirmed_v1, _ = self.typed_draft(URDU_TYPED)
        self.assertEqual(self.confirm(confirmed, confirmed_v1).status_code, 201)
        unconfirmed, unconfirmed_v1, _ = self.voice_draft(photos=3, video=True)

        self.replay_legacy()

        for csid, v1 in ((confirmed, confirmed_v1), (unconfirmed, unconfirmed_v1)):
            old = VoiceTranscriptionArtifact.objects.get(id=v1["voice_transcription_artifact_id"])
            self.assertFalse(old.is_active_version)  # kept, as history
            self.assertEqual((old.urdu_civic_rendering, old.transcription, old.english_rendering),
                             (v1["urdu_civic_rendering"], "", ""))
            new = versions(csid).get(is_active_version=True)
            self.assertEqual((new.rendering_version, new.supersedes_artifact_id, new.processing_status),
                             (2, old.id, "QUEUED"))
            self.assertEqual(ClientSubmission.objects.get(client_submission_id=csid).pipeline_state,
                             "TRANSCRIPTION_PROCESSING")
            # Nothing from before can become a report, by an old confirmation or a new one.
            self.assertEqual(self.submit(csid).json()["error"]["code"], "E_RENDERING_NOT_CONFIRMED")
            old_body = {**v1, "rendering_content_hash": legacy_hash(v1["urdu_civic_rendering"])}
            self.assertEqual(self.confirm(csid, old_body).json()["error"]["code"], "E_RENDERING_SUPERSEDED")
        history = RenderingConfirmation.objects.get(artifact_id=confirmed_v1["voice_transcription_artifact_id"])
        self.assertEqual(history.reviewed_texts, [])  # the old confirmation is kept, unchanged
        self.assertEqual(AuditEvent.objects.filter(action="rendering_requeued_for_bilingual_text").count(), 2)

        out = io.StringIO()
        call_command("process_queued_renderings", stdout=out)
        self.assertIn("Processed 2", out.getvalue())
        for csid in (confirmed, unconfirmed):
            rendering = self.api.get(f"/citizen/drafts/{csid}/rendering").json()
            self.assertEqual((rendering["rendering_version"], rendering["processing_status"]), (2, "COMPLETED"))
            self.assertTrue(all(rendering[k] for k in ("transcription", "urdu_civic_rendering", "english_rendering")))
            self.assertEqual(self.confirm(csid, rendering).status_code, 201)  # a fresh, full confirmation
            created = self.submit(csid)
            self.assertEqual(created.status_code, 201, created.content)
            detail = self.api.get(f"/citizen/reports/{created.json()['report_id']}").json()["description"]
            self.assertTrue(detail["bilingual"])
            self.assertEqual(detail["english_rendering"], rendering["english_rendering"])
        typed = versions(confirmed).get(is_active_version=True)
        self.assertEqual((typed.transcription, typed.urdu_civic_rendering), (URDU_TYPED, URDU_TYPED))  # verbatim
        unconfirmed_report = CivicReport.objects.get(client_submission_id=unconfirmed)
        self.assertEqual(EvidenceObject.objects.filter(report_id=unconfirmed_report.id, kind="photo").count(), 3)

    def test_a_submitted_legacy_report_and_its_evidence_are_untouched_and_replay_safely(self):
        csid, v1, _ = self.voice_draft()
        self.confirm(csid, v1)
        key = str(uuid.uuid4())
        original = self.submit(csid, key).json()
        sealed = sorted(EvidenceObject.objects.filter(report_id=original["report_id"]).values_list("sha256", "sealed_at"))

        self.replay_legacy()

        artifact = VoiceTranscriptionArtifact.objects.get(id=v1["voice_transcription_artifact_id"])
        self.assertTrue(artifact.is_active_version)
        self.assertEqual(versions(csid).count(), 1)  # never re-queued
        self.assertEqual(artifact.rendering_content_hash, legacy_hash(v1["urdu_civic_rendering"]))
        self.assertEqual(RenderingConfirmation.objects.get(submission__client_submission_id=csid).reviewed_texts, [])
        self.assertEqual(
            sorted(EvidenceObject.objects.filter(report_id=original["report_id"]).values_list("sha256", "sealed_at")),
            sealed)
        replay = self.submit(csid, key)
        self.assertEqual((replay.status_code, replay.json()), (200, original))
        self.assertEqual(self.submit(csid).json()["report_reference"], original["report_reference"])  # a new key too
        self.assertEqual(CivicReport.objects.count(), 1)
        detail = self.api.get(f"/citizen/reports/{original['report_id']}").json()["description"]
        self.assertEqual((detail["bilingual"], detail["transcription"], detail["english_rendering"]), (False, None, None))
        self.assertEqual(detail["urdu_civic_rendering"], v1["urdu_civic_rendering"])  # shown as it was, never filled in
        self.assertEqual(AuditEvent.objects.filter(action="rendering_requeued_for_bilingual_text").count(), 0)

    def test_the_migration_is_safe_to_run_again_and_leaves_failed_renderings_to_the_normal_retry(self):
        csid, v1, _ = self.typed_draft(URDU_TYPED)
        with self.settings(PARAKH_SIMULATED_AI_OUTCOME="fail"):
            failed = self.open().json()["client_submission_id"]
            items = [self.item(), self.photo()]
            self.upload_all(failed, items)
            self.assertEqual(self.complete(failed, items).json()["rendering"]["processing_status"], "FAILED")

        self.replay_legacy()
        self.migrate([("drafts", "0003_bilingual_report_text")])  # unapply 0004 (a no-op) and apply it again
        self.migrate(self.latest())

        self.assertEqual(versions(csid).count(), 2)  # re-queued once, not twice
        self.assertEqual(versions(failed).count(), 1)  # a failed rendering waits for the device's retry
        self.assertEqual(ClientSubmission.objects.get(client_submission_id=failed).pipeline_state, "SUBMISSION_FAILED")
        retried = self.complete(failed, items).json()  # the device's Retry: a new version in both languages
        self.assertEqual((retried["rendering"]["rendering_version"], retried["rendering"]["processing_status"]),
                         (2, "COMPLETED"))
        self.assertTrue(retried["rendering"]["english_rendering"])


class LegacyRenderingAtRuntimeTests(ReportingTestCase):
    """Defence in depth: whatever the database holds, an incomplete version never becomes a report."""

    def make_legacy(self, csid: str, rendering: dict) -> str:
        digest = legacy_hash(rendering["urdu_civic_rendering"])
        VoiceTranscriptionArtifact.objects.filter(id=rendering["voice_transcription_artifact_id"]).update(
            transcription="", english_rendering="", source_language="", text_origins={}, rendering_content_hash=digest)
        RenderingConfirmation.objects.filter(submission__client_submission_id=csid).update(
            reviewed_texts=[], rendering_content_hash=digest)
        return digest

    def test_an_incomplete_version_cannot_be_confirmed_corrected_or_submitted(self):
        csid, rendering, _ = self.typed_draft(URDU_TYPED)
        self.confirm(csid, rendering)
        digest = self.make_legacy(csid, rendering)
        legacy = {**rendering, "rendering_content_hash": digest}
        self.assertEqual(self.submit(csid).json()["error"]["code"], "E_RENDERING_INCOMPLETE")
        self.assertEqual(self.confirm(csid, legacy).json()["error"]["code"], "E_RENDERING_INCOMPLETE")
        correction = self.correct(csid, legacy, "درست متن")
        self.assertEqual(correction.json()["error"]["code"], "E_RENDERING_INCOMPLETE")
        self.assertEqual(settle_state(ClientSubmission.objects.get(client_submission_id=csid)), "AWAITING_REPORTER_REVIEW")
        self.assertEqual(CivicReport.objects.count(), 0)

    def test_a_confirmation_that_does_not_name_every_text_is_not_enough(self):
        csid, rendering, _ = self.voice_draft()
        self.confirm(csid, rendering)
        RenderingConfirmation.objects.update(reviewed_texts=["ur"])  # as if made by a partial check
        self.assertEqual(self.submit(csid).json()["error"]["code"], "E_RENDERING_NOT_CONFIRMED")
        self.assertEqual(settle_state(ClientSubmission.objects.get(client_submission_id=csid)), "AWAITING_REPORTER_REVIEW")

    def test_the_devices_manifest_replay_renders_a_legacy_version_again(self):
        csid, rendering, items = self.voice_draft()
        self.make_legacy(csid, rendering)
        replayed = self.complete(csid, items).json()["rendering"]
        self.assertEqual((replayed["rendering_version"], replayed["processing_status"]), (2, "COMPLETED"))
        self.assertTrue(replayed["transcription"] and replayed["english_rendering"])
        self.assertEqual(self.confirm(csid, replayed).status_code, 201)
        self.assertEqual(self.submit(csid).status_code, 201)

    def test_the_devices_manifest_replay_starts_a_version_the_migration_queued(self):
        csid, rendering, items = self.voice_draft()
        old = VoiceTranscriptionArtifact.objects.get(id=rendering["voice_transcription_artifact_id"])
        VoiceTranscriptionArtifact.objects.filter(id=old.id).update(is_active_version=False)
        VoiceTranscriptionArtifact.objects.create(  # what 0004 leaves: queued, never started
            submission=old.submission, source_kind=old.source_kind, source_audio_evidence=old.source_audio_evidence,
            rendering_version=2, is_active_version=True, supersedes_artifact=old, processing_status="QUEUED",
            created_at=self.now)
        replayed = self.complete(csid, items).json()["rendering"]
        self.assertEqual((replayed["rendering_version"], replayed["processing_status"]), (2, "COMPLETED"))
        self.assertEqual(versions(csid).count(), 2)  # started, not duplicated

    def test_three_texts_under_an_urdu_only_hash_are_still_not_enough(self):
        csid, rendering, _ = self.voice_draft()
        digest = legacy_hash(rendering["urdu_civic_rendering"])  # the hash would bind the Urdu text alone
        VoiceTranscriptionArtifact.objects.filter(id=rendering["voice_transcription_artifact_id"]).update(
            rendering_content_hash=digest)
        stale = {**rendering, "rendering_content_hash": digest}
        self.assertEqual(self.confirm(csid, stale).json()["error"]["code"], "E_RENDERING_INCOMPLETE")
        RenderingConfirmation.objects.create(  # a full confirmation of that hash, as if from another path
            artifact_id=rendering["voice_transcription_artifact_id"], submission=ClientSubmission.objects.get(),
            rendering_version=1, rendering_content_hash=digest, reporter_subject_type="citizen",
            reporter_account_id=ClientSubmission.objects.get().reporter_account_id, confirmed_at=self.now,
            idempotency_key=uuid.uuid4(), request_fingerprint="x", reviewed_texts=["en", "transcription", "ur"])
        self.assertEqual(self.submit(csid).json()["error"]["code"], "E_RENDERING_INCOMPLETE")
        self.assertEqual(CivicReport.objects.count(), 0)
