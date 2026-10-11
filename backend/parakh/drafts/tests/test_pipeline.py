"""API-130…API-135 and cancellation: drafts, evidence integrity, photos and video, renderings, temporary data."""
import json
from datetime import timedelta
import uuid
from types import SimpleNamespace
from unittest import mock

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.test import SimpleTestCase, override_settings

from parakh.audit.models import AuditEvent, verify_chain
from parakh.authentication.tokens import issue_session
from parakh.drafts import ai, media
from parakh.drafts.models import (
    ClientSubmission, EvidenceChunk, EvidenceObject, RenderingConfirmation, VoiceTranscriptionArtifact,
)
from parakh.drafts.services import complete_manifest, purge_expired_drafts, rendering_hash, run_processing
from parakh.drafts.storage import LocalStorage, WriteOnceViolation, check_evidence_storage_configuration, get_storage
from parakh.reports.models import CivicReport

from .base import VIDEO_BYTES, VOICE_BYTES, ReportingTestCase, mp4, sha


def _no_asr_text(testcase, response):
    """FR-PUB.16: the intermediate ASR output never appears on a citizen route."""
    text = response.content.decode()
    testcase.assertNotIn("source_asr_text", text)
    testcase.assertNotIn("no speech recognition was performed", text)


def _area_files(area: str) -> list:
    root = LocalStorage().root / area
    return [p for p in root.rglob("*") if p.is_file()] if root.exists() else []


class DraftTests(ReportingTestCase):
    def test_api130_is_idempotent_on_client_submission_id_and_carries_no_reference(self):
        payload = self.draft_payload()
        first = self.api.post("/citizen/drafts", payload, format="json")
        self.assertEqual(first.status_code, 201)
        self.assertEqual(first.json()["pipeline_state"], "LOCAL_DRAFT")
        self.assertEqual(first.json()["lifecycle"], "active")
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
        cancel = other.delete(f"/citizen/drafts/{payload['client_submission_id']}")
        self.assertEqual({taken.status_code, poll.status_code, missing.status_code, cancel.status_code}, {404})
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
        self.assertEqual(rendering["source_kind"], "voice")
        self.assertEqual(rendering["processing_status"], "COMPLETED")
        self.assertIn("SIMULATED", rendering["urdu_civic_rendering"])
        self.assertEqual(rendering["rendering_content_hash"], rendering_hash(
            rendering["transcription"], rendering["urdu_civic_rendering"], rendering["english_rendering"]))
        low = {f["key"] for f in rendering["fields"] if f["low_confidence"]}
        self.assertEqual(low, {"location"})  # FR-PUB.18: marked, never guessed
        for path in [f"/citizen/drafts/{csid}", f"/citizen/drafts/{csid}/rendering"]:
            _no_asr_text(self, self.api.get(path))
        # Until submission the assembled recording is temporary processing data, byte-identical (FR-PUB.10).
        stored = EvidenceObject.objects.get(client_evidence_id=items[0]["evidence_id"])
        self.assertEqual(get_storage().get_processing(stored.storage_key), items[0]["data"])
        self.assertEqual(stored.sha256, items[0]["sha256"])
        self.assertIsNone(stored.sealed_at)
        self.assertEqual(stored.duration_seconds, 30.0)

    def test_bytes_that_do_not_match_the_declared_capture_hash_are_refused(self):
        csid = self.open().json()["client_submission_id"]
        it, photo = self.item(), self.photo()
        it["sha256"] = sha(b"what the device claimed")
        self.upload(csid, it)
        self.upload(csid, photo)
        response = self.complete(csid, [it, photo])
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
        items = [self.item(), self.photo()]
        self.upload_all(csid, items)
        body = {**self.manifest(items), "manifest_sha256": sha(b"not the manifest")}
        response = self.api.post(f"/citizen/drafts/{csid}/evidence/complete", body, format="json")
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"]["reason"], "manifest")

    def test_an_incomplete_upload_names_the_missing_chunks_and_resumes(self):
        csid = self.open().json()["client_submission_id"]
        it, photo = self.item(), self.photo()
        self.upload(csid, it, skip={2})
        self.upload(csid, photo)
        response = self.complete(csid, [it, photo])
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["missing_chunks"], {it["evidence_id"]: [2]})
        self.upload(csid, it)  # resume: already-received chunks are replays
        self.assertEqual(self.complete(csid, [it, photo]).json()["pipeline_state"], "AWAITING_REPORTER_REVIEW")

    def test_a_voice_draft_needs_exactly_one_recording(self):
        csid = self.open().json()["client_submission_id"]
        photo = self.photo()
        self.upload(csid, photo)
        response = self.complete(csid, [photo])
        self.assertEqual(response.json()["error"]["field"], "manifest.voice_original")

    def test_a_retaken_photo_is_discarded_before_submission(self):
        csid = self.open().json()["client_submission_id"]
        voice, old, new = self.item(), self.photo(1), self.photo(2)
        self.upload_all(csid, [voice, old, new])
        self.assertEqual(self.complete(csid, [voice, old, new]).status_code, 200)
        self.assertEqual(self.complete(csid, [voice, new]).status_code, 200)  # the old photo was deleted
        discarded = EvidenceObject.objects.get(client_evidence_id=old["evidence_id"])
        self.assertIsNotNone(discarded.deleted_at)
        self.assertFalse((LocalStorage().root / "processing" / discarded.storage_key[:2] / discarded.storage_key).exists())
        kept = [e["evidence_id"] for e in self.api.get(f"/citizen/drafts/{csid}").json()["evidence"]]
        self.assertEqual(sorted(kept), sorted([voice["evidence_id"], new["evidence_id"]]))

    def test_evidence_storage_is_write_once(self):
        storage = get_storage()
        storage.seal("abc123", b"original")
        storage.seal("abc123", b"original")  # identical bytes: a no-op
        with self.assertRaises(WriteOnceViolation):
            storage.seal("abc123", b"replacement")
        self.assertEqual(storage.get_evidence("abc123"), b"original")

    def test_size_bounds_are_enforced(self):  # T-054, NFR-53, NFR-54
        csid = self.open().json()["client_submission_id"]
        limits = settings.PARAKH_EVIDENCE
        it = self.item()
        chunk = it["data"][:1000]
        for kind in ("voice_original", "photo", "video"):
            sized = self.item(kind)
            body = self.chunk_body(sized, 0, chunk, 99, byte_size=limits["ITEM_MAX_BYTES"][kind] + 1)
            self.assertEqual(self.api.post(f"/citizen/drafts/{csid}/evidence", body, format="json")
                             .json()["error"]["field"], "byte_size", kind)
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
        it, photo = self.item(), self.photo()
        self.upload(csid, photo)
        claimed = dict(it, data=it["data"] + b"tail")  # the device claims 4 more bytes than it sends
        chunks = [it["data"][i : i + 48 * 1024] for i in range(0, len(it["data"]), 48 * 1024)]
        for index, chunk in enumerate(chunks):
            body = self.chunk_body(claimed, index, chunk, len(chunks))
            self.assertEqual(self.api.post(f"/citizen/drafts/{csid}/evidence", body, format="json").status_code, 200)
        response = self.complete(csid, [claimed, photo])
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"]["evidence_ids"], [it["evidence_id"]])

    def test_too_many_items_are_refused(self):  # technical safeguard
        csid = self.open().json()["client_submission_id"]
        for n in range(settings.PARAKH_EVIDENCE["MAX_ITEMS"]):
            self.assertEqual(self.upload(csid, self.photo(n), skip=range(1, 99))[0].status_code, 200)
        extra = self.upload(csid, self.photo(99), skip=range(1, 99))[0]
        self.assertEqual(extra.json()["error"]["field"], "evidence_count")


class PhotoBoundTests(ReportingTestCase):  # DG-47: 1-3 live photos per report
    def _manifest_answer(self, photos: int):
        csid = self.open().json()["client_submission_id"]
        items = [self.item()] + [self.photo(n) for n in range(photos)]
        self.upload_all(csid, items)
        return self.complete(csid, items)

    def test_the_bounds_are_one_to_three(self):
        self.assertEqual((settings.PARAKH_PHOTO_COUNT_MIN, settings.PARAKH_PHOTO_COUNT_MAX), (1, 3))

    def test_no_photo_is_refused_with_e_evidence_required(self):
        response = self._manifest_answer(0)
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"]["code"], "E_EVIDENCE_REQUIRED")
        self.assertEqual((response.json()["error"]["min_photos"], response.json()["error"]["max_photos"]), (1, 3))

    def test_one_and_three_photos_are_accepted_and_four_are_refused(self):
        self.assertEqual(self._manifest_answer(1).status_code, 200)
        self.assertEqual(self._manifest_answer(3).status_code, 200)
        four = self._manifest_answer(4)
        self.assertEqual(four.status_code, 400)
        self.assertEqual(four.json()["error"]["field"], "manifest.photo_count")

    def test_an_invalid_bound_stops_start_up(self):
        from parakh.core.tests import _start

        for env in ({"PARAKH_PHOTO_COUNT_MIN": "0"}, {"PARAKH_PHOTO_COUNT_MIN": "4"},
                    {"PARAKH_PHOTO_COUNT_MAX": "11", "PARAKH_EVIDENCE_MAX_ITEMS": "12"}):
            result = _start({"PARAKH_ENV": "development", **env})
            self.assertNotEqual(result.returncode, 0, env)
            self.assertIn("ImproperlyConfigured", result.stderr)


class VideoTests(ReportingTestCase):  # DG-54: one optional live video of up to 60 seconds
    def _complete_with(self, video: dict, photos: int = 1, extra=()):
        csid = self.open().json()["client_submission_id"]
        items = [self.item()] + [self.photo(n) for n in range(photos)] + [video, *extra]
        self.upload_all(csid, items)
        return self.complete(csid, items), video

    def test_a_video_of_up_to_60_seconds_is_accepted_and_its_duration_recorded(self):
        response, video = self._complete_with(self.item("video", data=mp4(60.2, ("vide", "soun"), b"mp42", 150_000)))
        self.assertEqual(response.status_code, 200)
        self.assertEqual(EvidenceObject.objects.get(client_evidence_id=video["evidence_id"]).duration_seconds, 60.2)

    def test_a_video_longer_than_60_seconds_is_refused(self):
        response, video = self._complete_with(self.item("video", data=mp4(61, ("vide", "soun"), b"mp42", 150_000)))
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["field"], "video_duration")
        self.assertEqual(response.json()["error"]["max_seconds"], 60)
        self.assertEqual(response.json()["error"]["evidence_ids"], [video["evidence_id"]])

    def test_a_file_without_a_video_track_is_not_a_video(self):
        response, _ = self._complete_with(self.item("video", data=mp4(20, ("soun",), b"mp42", 150_000)))
        self.assertEqual(response.json()["error"]["field"], "evidence_type")

    def test_a_video_without_sound_is_refused(self):  # DG-71 (Hassan Jalal, 2026-10-11)
        response, video = self._complete_with(self.item("video", data=mp4(20, ("vide",), b"mp42", 150_000)))
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["field"], "video_sound")
        self.assertEqual(response.json()["error"]["evidence_ids"], [video["evidence_id"]])

    def test_a_video_with_sound_is_accepted(self):
        response, _ = self._complete_with(self.item("video", data=mp4(20, ("vide", "soun"), b"mp42", 150_000)))
        self.assertEqual(response.status_code, 200, response.content)

    def test_a_recording_with_a_video_track_is_refused(self):
        csid = self.open().json()["client_submission_id"]
        voice = self.item("voice_original", data=VIDEO_BYTES)
        items = [voice, self.photo()]
        self.upload_all(csid, items)
        self.assertEqual(self.complete(csid, items).json()["error"]["field"], "evidence_type")

    def test_a_malformed_container_is_refused(self):
        broken = b"\x00\x00\x00\x18ftypmp42" + b"\xff" * 5000
        response, _ = self._complete_with(self.item("video", data=broken))
        self.assertEqual(response.json()["error"]["field"], "evidence_type")
        with self.assertRaises(media.MalformedMedia):
            media.summarise(broken)

    def test_only_one_video_and_it_never_replaces_the_photos(self):
        second = self.item("video", data=mp4(10, ("vide", "soun"), b"mp42", 150_000))
        response, _ = self._complete_with(self.item("video"), extra=[second])
        self.assertEqual(response.json()["error"]["field"], "manifest.video_count")
        no_photo, _ = self._complete_with(self.item("video"), photos=0)
        self.assertEqual(no_photo.json()["error"]["code"], "E_EVIDENCE_REQUIRED")


class RecordingLengthTests(ReportingTestCase):  # DG-74 (Hassan Jalal, 2026-10-11): at most 3 minutes
    def _complete_with(self, voice: dict):
        csid = self.open().json()["client_submission_id"]
        items = [voice, self.photo()]
        self.upload_all(csid, items)
        return self.complete(csid, items)

    def test_a_recording_of_up_to_3_minutes_is_accepted_and_its_duration_recorded(self):
        voice = self.item("voice_original", data=mp4(180.5))
        response = self._complete_with(voice)
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(EvidenceObject.objects.get(client_evidence_id=voice["evidence_id"]).duration_seconds, 180.5)

    def test_a_recording_longer_than_3_minutes_is_refused(self):
        voice = self.item("voice_original", data=mp4(181))
        response = self._complete_with(voice)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["field"], "recording_duration")
        self.assertEqual(response.json()["error"]["max_seconds"], 180)
        self.assertEqual(response.json()["error"]["evidence_ids"], [voice["evidence_id"]])


class TypedRenderingTests(ReportingTestCase):  # DG-53
    def test_a_typed_draft_gets_a_simulated_rendering_to_confirm(self):
        csid, rendering, _ = self.typed_draft("Pipe burst near the school")
        self.assertEqual(rendering["source_kind"], "typed")
        self.assertTrue(rendering["ai_generated"])
        self.assertTrue(rendering["simulated"])
        self.assertIn("Pipe burst near the school", rendering["urdu_civic_rendering"])
        self.assertEqual(self.api.get(f"/citizen/drafts/{csid}").json()["pipeline_state"], "AWAITING_REPORTER_REVIEW")
        artifact = VoiceTranscriptionArtifact.objects.get()
        self.assertIsNone(artifact.source_audio_evidence_id)
        self.assertEqual(artifact.source_asr_text, "")

    def test_new_typed_text_needs_a_new_rendering(self):
        csid, v1, items = self.typed_draft("First wording")
        payload = self.draft_payload(client_submission_id=csid, description_mode="typed",
                                     typed_description="Second wording")
        edited = self.api.post("/citizen/drafts", payload, format="json")
        self.assertFalse(edited.json()["manifest_complete"])
        v2 = self.complete(csid, items).json()["rendering"]
        self.assertEqual(v2["rendering_version"], 2)
        self.assertIn("Second wording", v2["urdu_civic_rendering"])
        self.assertEqual(self.confirm(csid, v1).json()["error"]["code"], "E_RENDERING_SUPERSEDED")


class ProcessingFailureTests(ReportingTestCase):
    @override_settings(PARAKH_SIMULATED_AI_OUTCOME="fail")
    def test_failure_preserves_everything_creates_no_report_and_retry_makes_a_new_version(self):
        csid = self.open().json()["client_submission_id"]
        items = [self.item(), self.photo()]
        self.upload_all(csid, items)
        failed = self.complete(csid, items).json()
        self.assertEqual(failed["pipeline_state"], "SUBMISSION_FAILED")
        self.assertEqual(failed["rendering"]["processing_status"], "FAILED")
        self.assertIsNone(failed["rendering"]["urdu_civic_rendering"])  # never plausible replacement text
        self.assertEqual(self.submit(csid).json()["error"]["code"], "E_RENDERING_NOT_CONFIRMED")
        self.assertEqual(CivicReport.objects.count(), 0)
        stored = EvidenceObject.objects.get(client_evidence_id=items[0]["evidence_id"])
        self.assertEqual(get_storage().get_processing(stored.storage_key), items[0]["data"])

        with self.settings(PARAKH_SIMULATED_AI_OUTCOME="complete"):
            retried = self.complete(csid, items).json()  # "Retry": the same manifest again
        self.assertEqual(retried["pipeline_state"], "AWAITING_REPORTER_REVIEW")
        self.assertEqual(retried["rendering"]["rendering_version"], 2)

    @override_settings(PARAKH_SIMULATED_AI_OUTCOME="review_required")
    def test_review_required_shows_no_text_and_cannot_be_confirmed(self):
        csid = self.open().json()["client_submission_id"]
        items = [self.item(), self.photo()]
        self.upload_all(csid, items)
        draft = self.complete(csid, items).json()
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
        response = self.confirm(csid, rendering, rendering_content_hash=rendering_hash("کوئی اور متن", "کوئی اور متن", "other text"))
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


class CancellationTests(ReportingTestCase):  # DG-55
    def test_cancellation_purges_media_and_derived_content_and_is_idempotent(self):
        csid, rendering, _ = self.voice_draft(photos=2, video=True)
        self.confirm(csid, rendering)
        self.assertTrue(_area_files("processing"))
        response = self.cancel(csid)
        self.assertEqual(response.status_code, 204)
        self.assertEqual(_area_files("processing") + _area_files("staging"), [])
        self.assertEqual((EvidenceObject.objects.count(), EvidenceChunk.objects.count(),
                          VoiceTranscriptionArtifact.objects.count(), RenderingConfirmation.objects.count()),
                         (0, 0, 0, 0))
        draft = ClientSubmission.objects.get()
        self.assertIsNotNone(draft.cancelled_at)
        self.assertEqual((draft.latitude, draft.typed_description, draft.payload_hash), (None, "", ""))
        body = self.api.get(f"/citizen/drafts/{csid}").json()
        self.assertEqual((body["lifecycle"], body["location"], body["rendering"]), ("cancelled", None, None))
        event = AuditEvent.objects.filter(action="draft_cancelled").get()
        self.assertEqual(event.details["items"], 4)
        self.assertEqual(self.cancel(csid).status_code, 204)  # again: same answer

    def test_a_cancelled_draft_accepts_nothing_and_cannot_be_reopened(self):
        csid, rendering, items = self.voice_draft()
        self.cancel(csid)
        self.assertEqual(self.submit(csid).json()["error"]["code"], "E_DRAFT_CANCELLED")
        self.assertEqual(self.complete(csid, items).json()["error"]["code"], "E_DRAFT_CANCELLED")
        self.assertEqual(self.upload(csid, self.photo(7))[0].json()["error"]["code"], "E_DRAFT_CANCELLED")
        reopen = self.api.post("/citizen/drafts", self.draft_payload(client_submission_id=csid), format="json")
        self.assertEqual(reopen.json()["error"]["code"], "E_DRAFT_CANCELLED")
        self.assertEqual(CivicReport.objects.count(), 0)

    def test_cancelling_after_a_successful_submission_returns_the_reference_and_deletes_nothing(self):
        csid, rendering, items = self.voice_draft()
        self.confirm(csid, rendering)
        created = self.submit(csid).json()
        response = self.cancel(csid)
        self.assertEqual(response.status_code, 409)
        error = response.json()["error"]
        self.assertEqual((error["code"], error["report_reference"], error["report_id"]),
                         ("E_ALREADY_SUBMITTED", created["report_reference"], created["report_id"]))
        self.assertIsNone(ClientSubmission.objects.get().cancelled_at)
        detail = self.api.get(f"/citizen/reports/{created['report_id']}").json()
        voice = next(e for e in detail["evidence"] if e["kind"] == "voice_original")
        content = self.api.get(f"/citizen/reports/{created['report_id']}/evidence/{voice['evidence_id']}")
        self.assertEqual(content.content, items[0]["data"])  # sealed evidence untouched

    def test_a_processing_job_that_finishes_after_cancellation_stores_nothing(self):
        csid = self.open().json()["client_submission_id"]
        items = [self.item(), self.photo()]
        self.upload_all(csid, items)
        subject = SimpleNamespace(subject_type="citizen", subject_id=ClientSubmission.objects.get().reporter_account_id)
        with self.settings(PARAKH_AI_RUNNER="queued-elsewhere"):  # the job stays QUEUED for a worker
            with self.assertRaises(RuntimeError):
                complete_manifest(subject, csid, self.manifest(items))
        artifact_id = VoiceTranscriptionArtifact.objects.get().id
        self.assertEqual(VoiceTranscriptionArtifact.objects.get().processing_status, "QUEUED")
        self.cancel(csid)
        run_processing(artifact_id)  # the worker picks it up late
        self.assertEqual(VoiceTranscriptionArtifact.objects.count(), 0)
        self.assertEqual(_area_files("processing"), [])


class ExpiryTests(ReportingTestCase):  # DG-57 (approved by Hassan Jalal, 2026-10-07): 72 hours without activity
    def test_abandoned_temporary_data_expires_and_the_draft_can_be_sent_again(self):
        csid, rendering, items = self.voice_draft()
        self.assertEqual(settings.PARAKH_TEMPORARY_DATA_TTL_HOURS, 72)
        self.advance(71 * 3600)
        self.assertEqual(purge_expired_drafts(), 0)
        self.advance(2 * 3600)
        self.assertEqual(purge_expired_drafts(), 1)
        self.assertEqual(_area_files("processing"), [])
        self.sign_in_again()
        self.assertEqual(self.api.get(f"/citizen/drafts/{csid}").json()["lifecycle"], "expired")
        self.assertEqual(self.submit(csid).json()["error"]["code"], "E_DRAFT_EXPIRED")
        reopened = self.api.post("/citizen/drafts", self.draft_payload(client_submission_id=csid), format="json")
        self.assertEqual((reopened.status_code, reopened.json()["lifecycle"]), (200, "active"))
        self.upload_all(csid, items)
        self.assertEqual(self.complete(csid, items).json()["pipeline_state"], "AWAITING_REPORTER_REVIEW")

    def _queued_voice_draft(self):
        """A voice draft whose processing job waits for a worker, as with an asynchronous runner."""
        csid = self.open().json()["client_submission_id"]
        items = [self.item(), self.photo()]
        self.upload_all(csid, items)
        subject = SimpleNamespace(subject_type="citizen", subject_id=ClientSubmission.objects.get().reporter_account_id)
        with self.settings(PARAKH_AI_RUNNER="queued-elsewhere"):
            with self.assertRaises(RuntimeError):
                complete_manifest(subject, csid, self.manifest(items))
        return csid, VoiceTranscriptionArtifact.objects.get().id

    def test_an_upload_still_arriving_is_never_purged_however_old_the_draft_is(self):
        csid = self.open().json()["client_submission_id"]
        photo = self.photo()
        size = len(photo["data"]) // 3 + 1
        chunks = [photo["data"][i : i + size] for i in range(0, len(photo["data"]), size)]
        self.assertEqual(len(chunks), 3)
        captured = (self.now - timedelta(hours=3)).isoformat()
        for index, chunk in enumerate(chunks):
            self.advance(70 * 3600)  # each chunk arrives 70 hours after the last activity
            self.assertEqual(purge_expired_drafts(), 0)
            self.sign_in_again()
            body = self.chunk_body(photo, index, chunk, len(chunks), captured_at=captured)
            self.assertEqual(self.api.post(f"/citizen/drafts/{csid}/evidence", body, format="json").status_code, 200)
        draft = ClientSubmission.objects.get(client_submission_id=csid)
        self.assertGreater(self.now - draft.first_seen_at, timedelta(hours=200))  # far older than 72 hours
        self.assertIsNone(draft.expired_at)
        self.advance(72 * 3600 + 1)  # then 72 hours with nothing
        self.assertEqual(purge_expired_drafts(), 1)

    def test_a_job_still_running_is_never_purged_and_its_start_and_end_count_as_activity(self):
        csid, artifact_id = self._queued_voice_draft()
        self.advance(71 * 3600)  # the worker picks the job up just before the 72 hours end
        genuine = ai.SimulatedRenderingAdapter.render
        seen = {}

        def slow_render(adapter, *args, **kwargs):
            self.advance(2 * 3600)  # 73 h after the last upload, with the job still running
            seen["purged"] = purge_expired_drafts()
            return genuine(adapter, *args, **kwargs)

        with mock.patch.object(ai.SimulatedRenderingAdapter, "render", slow_render):
            run_processing(artifact_id)
        self.assertEqual(seen["purged"], 0)
        self.assertEqual(VoiceTranscriptionArtifact.objects.get().processing_status, "COMPLETED")
        self.advance(71 * 3600)  # 72 hours are counted again from the end of the job
        self.assertEqual(purge_expired_drafts(), 0)
        self.advance(2 * 3600)
        self.assertEqual(purge_expired_drafts(), 1)
        self.assertIsNotNone(ClientSubmission.objects.get(client_submission_id=csid).expired_at)

    def test_a_job_stuck_for_more_than_72_hours_does_not_keep_the_data_for_ever(self):
        _csid, artifact_id = self._queued_voice_draft()
        with mock.patch.object(ai.SimulatedRenderingAdapter, "render", side_effect=SystemExit):
            with self.assertRaises(SystemExit):
                run_processing(artifact_id)  # the worker is killed mid-job: the job never ends
        self.assertEqual(VoiceTranscriptionArtifact.objects.get().processing_status, "PROCESSING")
        self.advance(71 * 3600)
        self.assertEqual(purge_expired_drafts(), 0)  # its start was activity
        self.advance(2 * 3600)
        self.assertEqual(purge_expired_drafts(), 1)  # 72 hours after that, it no longer protects the data

    def test_a_job_that_ends_late_counts_its_end_as_activity(self):
        _csid, artifact_id = self._queued_voice_draft()
        with mock.patch.object(ai.SimulatedRenderingAdapter, "render", side_effect=lambda *a, **k: self.advance(73 * 3600)):
            run_processing(artifact_id)  # it produced nothing, but it did end, 73 hours later
        self.assertEqual(VoiceTranscriptionArtifact.objects.get().processing_status, "FAILED")
        self.assertEqual(purge_expired_drafts(), 0)
        self.advance(72 * 3600 + 1)
        self.assertEqual(purge_expired_drafts(), 1)

    def test_activity_extends_the_window_and_submitted_drafts_are_never_purged(self):
        csid, rendering, _ = self.voice_draft()
        self.advance(70 * 3600)
        self.sign_in_again()
        self.assertEqual(self.confirm(csid, rendering).status_code, 201)  # activity
        self.advance(70 * 3600)
        self.assertEqual(purge_expired_drafts(), 0)
        self.sign_in_again()
        self.assertEqual(self.submit(csid).status_code, 201)
        self.advance(1000 * 3600)
        self.assertEqual(purge_expired_drafts(), 0)
        self.assertEqual(CivicReport.objects.count(), 1)


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


class MediaParserTests(SimpleTestCase):
    def test_duration_and_track_types_are_read_from_the_header(self):
        summary = media.summarise(VIDEO_BYTES)
        self.assertEqual((summary.brand, summary.duration_seconds, summary.track_types), ("mp42", 30.0, {"vide", "soun"}))
        self.assertEqual(media.summarise(VOICE_BYTES).track_types, {"soun"})

    def test_truncated_and_oversized_boxes_are_refused(self):
        for data in (VOICE_BYTES[:20], b"\x00\x00\x10\x00ftypmp42" + b"\x00" * 30, b"not media at all"):
            with self.assertRaises(media.MalformedMedia):
                media.summarise(data)
