"""API-130…API-135: drafts, evidence integrity, the SIMULATED rendering, correction and confirmation."""
import json
import uuid

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase, override_settings

from parakh.audit.models import AuditEvent, verify_chain
from parakh.authentication.tokens import issue_session
from parakh.drafts import ai
from parakh.drafts.models import ClientSubmission, EvidenceObject, RenderingConfirmation, VoiceTranscriptionArtifact
from parakh.drafts.services import rendering_hash
from parakh.drafts.storage import LocalStorage, WriteOnceViolation, check_evidence_storage_configuration, get_storage
from parakh.reports.models import CivicReport

from .base import ReportingTestCase, sha


def _no_asr_text(testcase, response):
    """FR-PUB.16: the intermediate ASR output never appears on a citizen route."""
    text = response.content.decode()
    testcase.assertNotIn("source_asr_text", text)
    testcase.assertNotIn("no speech recognition was performed", text)


class DraftTests(ReportingTestCase):
    def test_api130_is_idempotent_on_client_submission_id_and_carries_no_reference(self):
        payload = self.draft_payload()
        first = self.api.post("/citizen/drafts", payload, format="json")
        self.assertEqual(first.status_code, 201)
        self.assertEqual(first.json()["pipeline_state"], "LOCAL_DRAFT")
        self.assertEqual(first["Cache-Control"], "no-store")
        again = self.api.post("/citizen/drafts", payload, format="json")
        self.assertEqual(again.status_code, 200)
        self.assertEqual(ClientSubmission.objects.count(), 1)
        self.assertNotIn("report_reference", first.content.decode())  # TEST-API-016

    def test_an_edit_before_submission_updates_the_same_draft(self):
        payload = self.draft_payload()
        self.api.post("/citizen/drafts", payload, format="json")
        edited = self.api.post("/citizen/drafts", {**payload, "category": "road"}, format="json")
        self.assertEqual(edited.status_code, 200)
        self.assertEqual(edited.json()["category"], "road")
        self.assertEqual(ClientSubmission.objects.count(), 1)

    def test_another_citizens_draft_is_the_uniform_404(self):
        payload = self.draft_payload()
        self.api.post("/citizen/drafts", payload, format="json")
        other = self.as_other_citizen()
        taken = other.post("/citizen/drafts", payload, format="json")
        poll = other.get(f"/citizen/drafts/{payload['client_submission_id']}")
        missing = other.get(f"/citizen/drafts/{uuid.uuid4()}")
        self.assertEqual({taken.status_code, poll.status_code, missing.status_code}, {404})
        self.assertEqual(poll.json(), missing.json())

    def test_validation_and_the_manual_pin_rule(self):
        self.assertEqual(self.open(category="flood").json()["error"]["field"], "category")
        self.assertEqual(self.open(description_mode="typed").json()["error"]["field"], "typed_description")
        voice_with_text = self.open(typed_description="Pipe burst near the school")
        self.assertEqual(voice_with_text.json()["error"]["field"], "typed_description")
        self.assertEqual(self.open(location=None).json()["error"]["field"], "location")
        future = self.open(captured_at=(self.now.replace(year=2027)).isoformat())
        self.assertEqual(future.json()["error"]["field"], "captured_at")
        manual = self.open(location={"latitude": 31.5, "longitude": 74.3, "source": "manual"})
        self.assertEqual(manual.status_code, 201)
        self.assertTrue(manual.json()["location"]["unverified"])  # FR-PUB.24

    def test_unauthenticated_and_staff_sessions_are_refused(self):
        self.api.credentials()
        self.assertEqual(self.open().status_code, 401)
        staff = issue_session("staff", uuid.uuid4(), "password_otp")
        self.bearer(staff["access_token"])
        self.assertEqual(self.open().status_code, 403)


class EvidenceIntegrityTests(ReportingTestCase):
    def test_a_chunk_whose_hash_does_not_match_is_refused_and_nothing_is_stored(self):
        csid = self.open().json()["client_submission_id"]
        it = self.item()
        chunk = it["data"][:1000]
        body = self.chunk_body(it, 0, chunk, 3, chunk_sha256=sha(b"something else"))
        response = self.api.post(f"/citizen/drafts/{csid}/evidence", body, format="json")
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"]["code"], "E_CAPTURE_INTEGRITY")
        self.assertEqual(EvidenceObject.objects.count(), 0)

    def test_size_bounds_are_enforced(self):  # T-054, NFR-53, NFR-54
        csid = self.open().json()["client_submission_id"]
        limits = settings.PARAKH_EVIDENCE
        it = self.item()
        chunk = it["data"][:1000]
        too_big_item = self.chunk_body(it, 0, chunk, 99, byte_size=limits["ITEM_MAX_BYTES"] + 1)
        self.assertEqual(self.api.post(f"/citizen/drafts/{csid}/evidence", too_big_item, format="json")
                         .json()["error"]["field"], "byte_size")
        big = b"\x00" * (limits["CHUNK_MAX_BYTES"] + 1)
        too_big_chunk = self.chunk_body(it, 0, big, 3)
        self.assertEqual(self.api.post(f"/citizen/drafts/{csid}/evidence", too_big_chunk, format="json")
                         .json()["error"]["field"], "chunk_base64")
        impossible_count = self.chunk_body(it, 0, chunk, 1, byte_size=limits["CHUNK_MAX_BYTES"] * 2)
        self.assertEqual(self.api.post(f"/citizen/drafts/{csid}/evidence", impossible_count, format="json")
                         .json()["error"]["field"], "chunk_count")
        self.assertEqual(EvidenceObject.objects.count(), 0)

    def test_assembled_bytes_must_have_the_declared_size(self):  # T-054
        csid = self.open().json()["client_submission_id"]
        it = self.item()
        claimed = dict(it, data=it["data"] + b"tail")  # the device claims 4 more bytes than it sends
        chunks = [it["data"][i : i + 48 * 1024] for i in range(0, len(it["data"]), 48 * 1024)]
        for index, chunk in enumerate(chunks):
            body = self.chunk_body(claimed, index, chunk, len(chunks))
            self.assertEqual(self.api.post(f"/citizen/drafts/{csid}/evidence", body, format="json").status_code, 200)
        response = self.complete(csid, [claimed])
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"]["evidence_ids"], [it["evidence_id"]])

    def test_too_many_items_are_refused(self):  # technical safeguard, not the product photo bounds (DG-47)
        csid = self.open().json()["client_submission_id"]
        for _ in range(settings.PARAKH_EVIDENCE["MAX_ITEMS"]):
            self.assertEqual(self.upload(csid, self.item("photo"), skip=range(1, 99))[0].status_code, 200)
        extra = self.upload(csid, self.item("photo"), skip=range(1, 99))[0]
        self.assertEqual(extra.json()["error"]["field"], "evidence_count")

    @override_settings(PARAKH_PHOTO_COUNT_MAX=1)
    def test_an_approved_photo_maximum_is_enforced_once_it_exists(self):  # DG-47: unset by default
        csid = self.open().json()["client_submission_id"]
        items = [self.item(), self.item("photo"), self.item("photo", data=b"\xff\xd8\xff\xe0 second " * 3000)]
        for it in items:
            self.upload(csid, it)
        self.assertEqual(self.complete(csid, items).json()["error"]["field"], "manifest.photo_count")
        self.assertEqual(self.complete(csid, items[:2]).status_code, 200)

    def test_no_photo_maximum_is_enforced_while_it_is_undecided(self):
        self.assertIsNone(settings.PARAKH_PHOTO_COUNT_MAX)

    def test_a_repeated_chunk_is_idempotent(self):
        csid = self.open().json()["client_submission_id"]
        it = self.item()
        first = self.upload(csid, it, skip=range(1, 10))[0]
        again = self.upload(csid, it, skip=range(1, 10))[0]
        self.assertEqual(first.json(), again.json())
        self.assertEqual(first.json()["received_chunks"], 1)
        self.assertEqual(self.api.get(f"/citizen/drafts/{csid}").json()["pipeline_state"], "UPLOADING")

    def test_upload_and_complete_produce_a_simulated_ai_generated_rendering(self):
        csid, rendering, items = self.voice_draft()
        self.assertTrue(rendering["ai_generated"])
        self.assertTrue(rendering["simulated"])
        self.assertEqual(rendering["processing_status"], "COMPLETED")
        self.assertIn("SIMULATED", rendering["urdu_civic_rendering"])
        self.assertEqual(rendering["rendering_content_hash"], rendering_hash(rendering["urdu_civic_rendering"]))
        low = {f["key"] for f in rendering["fields"] if f["low_confidence"]}
        self.assertEqual(low, {"location"})  # FR-PUB.18: marked, never guessed
        for path in [f"/citizen/drafts/{csid}", f"/citizen/drafts/{csid}/rendering"]:
            _no_asr_text(self, self.api.get(path))
        # The original recording is byte-identical after AI output exists (FR-PUB.10).
        stored = EvidenceObject.objects.get(client_evidence_id=items[0]["evidence_id"])
        self.assertEqual(get_storage().get_evidence(stored.storage_key), items[0]["data"])
        self.assertEqual(stored.sha256, items[0]["sha256"])

    def test_bytes_that_do_not_match_the_declared_capture_hash_are_refused(self):
        csid = self.open().json()["client_submission_id"]
        it = self.item()
        it["sha256"] = sha(b"what the device claimed")
        self.upload(csid, it)
        response = self.complete(csid, [it])
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"]["evidence_ids"], [it["evidence_id"]])
        self.assertFalse(EvidenceObject.objects.get(client_evidence_id=it["evidence_id"]).chunks.exists())

    def test_bytes_that_are_not_the_declared_type_are_refused(self):  # T-054 magic bytes
        csid = self.open().json()["client_submission_id"]
        voice, fake_photo = self.item(), self.item("photo", data=b"MZ\x90\x00 not an image " * 2000)
        for it in (voice, fake_photo):
            self.upload(csid, it)
        response = self.complete(csid, [voice, fake_photo])
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["field"], "evidence_type")
        self.assertEqual(response.json()["error"]["evidence_ids"], [fake_photo["evidence_id"]])
        self.assertEqual(EvidenceObject.objects.get(client_evidence_id=voice["evidence_id"]).status, "COMPLETE")

    def test_a_manifest_hash_that_does_not_match_is_refused(self):
        csid = self.open().json()["client_submission_id"]
        it = self.item()
        self.upload(csid, it)
        body = {**self.manifest([it]), "manifest_sha256": sha(b"not the manifest")}
        response = self.api.post(f"/citizen/drafts/{csid}/evidence/complete", body, format="json")
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"]["reason"], "manifest")

    def test_an_incomplete_upload_names_the_missing_chunks_and_resumes(self):
        csid = self.open().json()["client_submission_id"]
        it = self.item()
        self.upload(csid, it, skip={2})
        response = self.complete(csid, [it])
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["missing_chunks"], {it["evidence_id"]: [2]})
        self.upload(csid, it)  # resume: already-received chunks are replays
        self.assertEqual(self.complete(csid, [it]).json()["pipeline_state"], "AWAITING_REPORTER_REVIEW")

    def test_a_voice_draft_needs_exactly_one_recording(self):
        csid = self.open().json()["client_submission_id"]
        photo = self.item("photo")
        self.upload(csid, photo)
        response = self.complete(csid, [photo])
        self.assertEqual(response.json()["error"]["field"], "manifest.voice_original")

    def test_a_retaken_photo_is_discarded_before_submission(self):
        csid = self.open().json()["client_submission_id"]
        voice, old, new = self.item(), self.item("photo"), self.item("photo", data=b"\xff\xd8\xff\xe0 retaken " * 4000)
        for it in (voice, old, new):
            self.upload(csid, it)
        self.assertEqual(self.complete(csid, [voice, old, new]).status_code, 200)
        self.assertEqual(self.complete(csid, [voice, new]).status_code, 200)  # the old photo was deleted
        discarded = EvidenceObject.objects.get(client_evidence_id=old["evidence_id"])
        self.assertIsNotNone(discarded.deleted_at)
        self.assertFalse((LocalStorage().root / "evidence" / discarded.storage_key[:2] / discarded.storage_key).exists())
        kept = [e["evidence_id"] for e in self.api.get(f"/citizen/drafts/{csid}").json()["evidence"]]
        self.assertEqual(sorted(kept), sorted([voice["evidence_id"], new["evidence_id"]]))

    def test_evidence_storage_is_write_once(self):
        storage = get_storage()
        storage.put_evidence("abc123", b"original")
        storage.put_evidence("abc123", b"original")  # identical bytes: a no-op
        with self.assertRaises(WriteOnceViolation):
            storage.put_evidence("abc123", b"replacement")
        self.assertEqual(storage.get_evidence("abc123"), b"original")


class ProcessingFailureTests(ReportingTestCase):
    @override_settings(PARAKH_SIMULATED_AI_OUTCOME="fail")
    def test_failure_preserves_everything_creates_no_report_and_retry_makes_a_new_version(self):
        csid = self.open().json()["client_submission_id"]
        it = self.item()
        self.upload(csid, it)
        failed = self.complete(csid, [it]).json()
        self.assertEqual(failed["pipeline_state"], "SUBMISSION_FAILED")
        self.assertEqual(failed["rendering"]["processing_status"], "FAILED")
        self.assertIsNone(failed["rendering"]["urdu_civic_rendering"])  # never plausible replacement text
        self.assertEqual(self.submit(csid).json()["error"]["code"], "E_RENDERING_NOT_CONFIRMED")
        self.assertEqual(CivicReport.objects.count(), 0)
        stored = EvidenceObject.objects.get(client_evidence_id=it["evidence_id"])
        self.assertEqual(get_storage().get_evidence(stored.storage_key), it["data"])

        with self.settings(PARAKH_SIMULATED_AI_OUTCOME="complete"):
            retried = self.complete(csid, [it]).json()  # "Retry": the same manifest again
        self.assertEqual(retried["pipeline_state"], "AWAITING_REPORTER_REVIEW")
        self.assertEqual(retried["rendering"]["rendering_version"], 2)

    @override_settings(PARAKH_SIMULATED_AI_OUTCOME="review_required")
    def test_review_required_shows_no_text_and_cannot_be_confirmed(self):
        csid = self.open().json()["client_submission_id"]
        it = self.item()
        self.upload(csid, it)
        draft = self.complete(csid, [it]).json()
        self.assertEqual(draft["pipeline_state"], "SUBMISSION_FAILED")
        self.assertEqual(draft["rendering"]["processing_status"], "REVIEW_REQUIRED")
        self.assertIsNone(draft["rendering"]["urdu_civic_rendering"])
        artifact = VoiceTranscriptionArtifact.objects.get()
        self.assertEqual(artifact.human_review_status, "PENDING")
        forced = {**draft["rendering"], "rendering_content_hash": artifact.rendering_content_hash}
        self.assertEqual(self.confirm(csid, forced).json()["error"]["code"], "E_STALE_STATE")


class CorrectionAndConfirmationTests(ReportingTestCase):
    def test_a_correction_creates_a_new_version_and_keeps_the_old_one(self):
        csid, v1, _ = self.voice_draft()
        response = self.correct(csid, v1, "پانی کی پائپ لائن سکول کے سامنے ٹوٹی ہوئی ہے۔")
        self.assertEqual(response.status_code, 201)
        v2 = response.json()
        self.assertEqual((v2["rendering_version"], v2["origin"], v2["supersedes_rendering_version"]),
                         (2, "reporter_correction", 1))
        self.assertTrue(v2["ai_generated"])  # still labelled until the reporter confirms
        rows = VoiceTranscriptionArtifact.objects.order_by("rendering_version")
        self.assertEqual([r.is_active_version for r in rows], [False, True])
        self.assertEqual(rows[0].urdu_civic_rendering, v1["urdu_civic_rendering"])  # nothing overwritten
        self.assertEqual(rows[1].supersedes_artifact_id, rows[0].id)
        self.assertEqual(self.api.get(f"/citizen/drafts/{csid}/rendering").json()["rendering_version"], 2)

    def test_a_correction_based_on_an_old_version_is_refused(self):
        csid, v1, _ = self.voice_draft()
        self.correct(csid, v1, "پہلی درستی")
        stale = self.correct(csid, v1, "دوسری درستی")
        self.assertEqual(stale.json()["error"]["code"], "E_RENDERING_SUPERSEDED")

    def test_confirmation_binds_the_exact_version_and_replays_idempotently(self):
        csid, rendering, _ = self.voice_draft()
        key = str(uuid.uuid4())
        first = self.confirm(csid, rendering, key)
        self.assertEqual(first.status_code, 201)
        self.assertEqual(first.json()["pipeline_state"], "READY_TO_SUBMIT")
        replay = self.confirm(csid, rendering, key)
        self.assertEqual(replay.status_code, 200)
        self.assertEqual(replay.json()["rendering_confirmation_id"], first.json()["rendering_confirmation_id"])
        reused = self.confirm(csid, rendering, key, confirmed_at=self.now.replace(hour=8).isoformat())
        self.assertEqual(reused.json()["error"]["code"], "E_IDEMPOTENCY_CONFLICT")
        self.assertEqual(RenderingConfirmation.objects.count(), 1)

    def test_a_superseded_version_is_refused_with_409(self):  # TEST-API-011
        csid, v1, _ = self.voice_draft()
        self.correct(csid, v1, "درست شدہ متن")
        response = self.confirm(csid, v1)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["code"], "E_RENDERING_SUPERSEDED")
        self.assertEqual(RenderingConfirmation.objects.count(), 0)

    def test_a_mismatched_content_hash_is_refused_with_409(self):  # TEST-API-012
        csid, rendering, _ = self.voice_draft()
        response = self.confirm(csid, rendering, rendering_content_hash=rendering_hash("کوئی اور متن"))
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["code"], "E_RENDERING_HASH_MISMATCH")

    def test_the_reporter_fields_must_match_the_session(self):
        csid, rendering, _ = self.voice_draft()
        self.assertEqual(self.confirm(csid, rendering, reporter_account_id=str(uuid.uuid4())).json()["error"]["field"],
                         "reporter")
        self.assertEqual(self.confirm(csid, rendering, reporter_subject_type="staff").json()["error"]["field"],
                         "reporter")

    def test_nobody_confirms_another_persons_draft(self):  # FR-PUB.23
        csid, rendering, _ = self.voice_draft()
        other = self.as_other_citizen()
        own_id = self.open(client=other).json()["reporter_account_id"]  # the other citizen's own, valid identity
        body = self.confirmation_body(csid, rendering, reporter_account_id=own_id)
        response = other.post(f"/citizen/drafts/{csid}/rendering/confirm", body, format="json",
                              HTTP_X_CONFIRMATION_IDEMPOTENCY_KEY=str(uuid.uuid4()))
        self.assertEqual(response.status_code, 404)  # the same answer as a draft that does not exist
        self.assertEqual(RenderingConfirmation.objects.count(), 0)

    def test_an_idempotency_key_is_required(self):
        csid, rendering, _ = self.voice_draft()
        response = self.api.post(f"/citizen/drafts/{csid}/rendering/confirm",
                                 self.confirmation_body(csid, rendering), format="json")
        self.assertEqual(response.json()["error"]["field"], "idempotency_key")

    def test_the_audit_chain_holds_and_carries_no_rendering_or_asr_text(self):
        csid, rendering, _ = self.voice_draft()
        self.confirm(csid, rendering)
        self.assertEqual(verify_chain(), (True, None))
        details = json.dumps([e.details for e in AuditEvent.objects.all()], ensure_ascii=False)
        self.assertNotIn(rendering["urdu_civic_rendering"], details)
        self.assertNotIn("no speech recognition", details)
        actions = set(AuditEvent.objects.values_list("action", flat=True))
        self.assertTrue({"draft_opened", "evidence_manifest_completed", "rendering_produced",
                         "rendering_confirmed"} <= actions)


class AdapterConfinementTests(SimpleTestCase):
    def test_production_refuses_the_simulated_adapter_and_the_local_store(self):
        for backend in ["parakh.drafts.ai.SimulatedRenderingAdapter", ""]:
            with self.assertRaises(ImproperlyConfigured):
                ai.check_ai_configuration("production", backend)
        for backend in ["parakh.drafts.storage.LocalStorage", ""]:
            with self.assertRaises(ImproperlyConfigured):
                check_evidence_storage_configuration("production", backend)
        ai.check_ai_configuration("development", "parakh.drafts.ai.SimulatedRenderingAdapter")

    @override_settings(PARAKH_ENV="production")
    def test_the_simulated_adapter_and_local_store_refuse_to_load_in_production(self):
        with self.assertRaises(ImproperlyConfigured):
            ai.SimulatedRenderingAdapter()
        with self.assertRaises(ImproperlyConfigured):
            LocalStorage()
