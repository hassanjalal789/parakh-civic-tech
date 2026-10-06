"""Report text in Urdu and English, confirmed by the reporter (DG-61, DG-62; Mobile SRS v2.3.0).

The AI adapter is SIMULATED: its translations are labelled echoes, never real
ones. These tests prove what the server does with the texts — which are
kept, which may change, and what the reporter must confirm.
"""
import uuid

from django.test import override_settings

from parakh.audit.models import AuditEvent
from parakh.core.tests import _start
from parakh.drafts import ai
from parakh.drafts.models import RenderingConfirmation, VoiceTranscriptionArtifact
from parakh.drafts.services import rendering_hash, run_processing
from parakh.drafts.tests.base import ReportingTestCase
from parakh.reports.models import CivicReport

URDU_TEXT = "سکول کے سامنے پانی کا پائپ پھٹ گیا ہے"
ENGLISH_TEXT = "Pipe burst near the school"
ALL_TEXTS = ["transcription", "ur", "en"]


class BilingualRenderingTests(ReportingTestCase):
    def test_a_voice_report_gets_a_transcription_and_both_languages(self):
        _, rendering, _ = self.voice_draft()
        self.assertTrue(rendering["transcription"] and rendering["urdu_civic_rendering"] and rendering["english_rendering"])
        self.assertEqual(rendering["source_language"], "ur")
        self.assertEqual(rendering["text_origins"],
                         {"transcription": "ai_transcription", "ur": "ai_transcription", "en": "ai_translation"})
        self.assertEqual(rendering["ai_generated_texts"], {"transcription": True, "ur": True, "en": True})
        self.assertTrue(rendering["ai_generated"])
        self.assertTrue(rendering["english_rendering"].startswith(ai.SIMULATED_EN))  # never passed off as real
        self.assertNotIn("source_asr_text", rendering)

    def test_typed_urdu_is_kept_verbatim_and_only_the_english_is_ai(self):
        _, rendering, _ = self.typed_draft(URDU_TEXT)
        self.assertEqual(rendering["transcription"], URDU_TEXT)
        self.assertEqual(rendering["urdu_civic_rendering"], URDU_TEXT)
        self.assertEqual(rendering["text_origins"], {"transcription": "reporter", "ur": "reporter", "en": "ai_translation"})
        self.assertEqual(rendering["ai_generated_texts"], {"transcription": False, "ur": False, "en": True})
        self.assertTrue(rendering["ai_generated"])  # the English still carries the AI label

    def test_typed_english_is_kept_verbatim_and_only_the_urdu_is_ai(self):
        _, rendering, _ = self.typed_draft(ENGLISH_TEXT)
        self.assertEqual((rendering["transcription"], rendering["english_rendering"]), (ENGLISH_TEXT, ENGLISH_TEXT))
        self.assertTrue(rendering["urdu_civic_rendering"].startswith(ai.SIMULATED_UR))
        self.assertEqual(rendering["text_origins"], {"transcription": "reporter", "ur": "ai_translation", "en": "reporter"})

    def test_text_in_neither_script_is_kept_and_both_versions_are_ai(self):
        _, rendering, _ = self.typed_draft("12 - 34 - 56")
        self.assertEqual(rendering["transcription"], "12 - 34 - 56")
        self.assertEqual(rendering["text_origins"], {"transcription": "reporter", "ur": "ai_rendering", "en": "ai_rendering"})

    def test_one_hash_covers_all_three_texts(self):
        _, rendering, _ = self.voice_draft()
        texts = (rendering["transcription"], rendering["urdu_civic_rendering"], rendering["english_rendering"])
        self.assertEqual(rendering["rendering_content_hash"], rendering_hash(*texts))
        for i in range(3):
            changed = list(texts)
            changed[i] = changed[i] + " ۔"
            self.assertNotEqual(rendering_hash(*changed), rendering_hash(*texts))
        # The texts are bound to their roles, not just concatenated.
        self.assertNotEqual(rendering_hash("a", "b", "c"), rendering_hash("b", "a", "c"))


class ConfirmationTests(ReportingTestCase):
    def test_confirmation_must_name_the_transcription_and_both_languages(self):
        csid, rendering, _ = self.voice_draft()
        for bad in (None, [], ["ur", "en"], ["transcription", "ur", "ur"], ["transcription", "ur", "en", "x"],
                    "transcription,ur,en", [1, 2, 3], {"ur": True}):
            body = {"reviewed_texts": bad} if bad is not None else {}
            response = self.confirm(csid, rendering, **body) if bad is not None else self._confirm_without(csid, rendering)
            self.assertEqual(response.status_code, 400, (bad, response.content))
            self.assertEqual((response.json()["error"]["code"], response.json()["error"]["field"]),
                             ("E_VALIDATION", "reviewed_texts"), bad)
        self.assertFalse(RenderingConfirmation.objects.exists())

        ok = self.confirm(csid, rendering, reviewed_texts=["en", "transcription", "ur"])  # any order
        self.assertEqual(ok.status_code, 201, ok.content)
        self.assertEqual(RenderingConfirmation.objects.get().reviewed_texts, ["en", "transcription", "ur"])

    def _confirm_without(self, csid, rendering):
        body = self.confirmation_body(csid, rendering)
        body.pop("reviewed_texts")
        return self.api.post(f"/citizen/drafts/{csid}/rendering/confirm", body, format="json",
                             HTTP_X_CONFIRMATION_IDEMPOTENCY_KEY=str(uuid.uuid4()))

    def test_a_replay_with_other_reviewed_texts_is_a_different_request(self):
        csid, rendering, _ = self.voice_draft()
        key = str(uuid.uuid4())
        self.assertEqual(self.confirm(csid, rendering, key=key).status_code, 201)
        self.assertEqual(self.confirm(csid, rendering, key=key).status_code, 200)  # the same request again
        reordered = self.confirm(csid, rendering, key=key, reviewed_texts=["ur", "en", "transcription"])
        self.assertEqual(reordered.status_code, 200)  # the same set, so the same request


class CorrectionTests(ReportingTestCase):
    def correct_texts(self, csid, rendering, **texts):
        body = {
            "voice_transcription_artifact_id": rendering["voice_transcription_artifact_id"],
            "rendering_version": rendering["rendering_version"],
            "rendering_content_hash": rendering["rendering_content_hash"],
            **texts,
        }
        return self.api.post(f"/citizen/drafts/{csid}/rendering/corrections", body, format="json")

    def test_correcting_the_urdu_keeps_the_rest_and_needs_a_new_confirmation(self):
        csid, v1, _ = self.voice_draft()
        self.confirm(csid, v1)
        v2 = self.correct_texts(csid, v1, urdu_civic_rendering="پانی کا پائپ سکول کے سامنے ٹوٹا ہوا ہے").json()
        self.assertEqual(v2["rendering_version"], 2)
        self.assertEqual(v2["english_rendering"], v1["english_rendering"])  # not silently changed
        self.assertEqual(v2["transcription"], v1["transcription"])
        self.assertEqual(v2["text_origins"]["ur"], "reporter")
        self.assertFalse(v2["ai_generated_texts"]["ur"])
        self.assertEqual(self.api.get(f"/citizen/drafts/{csid}").json()["pipeline_state"], "AWAITING_REPORTER_REVIEW")
        stale = self.confirm(csid, v1)
        self.assertEqual(stale.json()["error"]["code"], "E_RENDERING_SUPERSEDED")
        self.assertEqual(self.submit(csid).json()["error"]["code"], "E_RENDERING_NOT_CONFIRMED")
        self.assertEqual(self.confirm(csid, v2).status_code, 201)
        self.assertEqual(self.submit(csid).status_code, 201)

    def test_a_requested_rederivation_is_a_new_ai_version_that_must_be_confirmed(self):
        csid, v1, _ = self.voice_draft()
        corrected = "پانی کا پائپ سکول کے سامنے ٹوٹا ہوا ہے"
        v2 = self.correct_texts(csid, v1, urdu_civic_rendering=corrected, derive_from="ur").json()
        self.assertEqual(v2["processing_status"], "COMPLETED")
        self.assertEqual(v2["english_rendering"], ai.SIMULATED_EN + corrected)
        self.assertEqual(v2["text_origins"], {"transcription": "ai_transcription", "ur": "reporter", "en": "ai_translation"})
        self.assertTrue(v2["ai_generated_texts"]["en"])
        self.assertEqual(v2["transcription"], v1["transcription"])  # the reporter's words are never back-translated
        self.assertEqual(self.submit(csid).json()["error"]["code"], "E_RENDERING_NOT_CONFIRMED")

    def test_ai_never_overwrites_a_text_the_reporter_wrote(self):
        # Typed English: the English is the reporter's own, so re-deriving from a corrected Urdu leaves it alone.
        csid, v1, _ = self.typed_draft(ENGLISH_TEXT)
        v2 = self.correct_texts(csid, v1, urdu_civic_rendering="سکول کے قریب پائپ پھٹ گیا", derive_from="ur").json()
        self.assertEqual(v2["english_rendering"], ENGLISH_TEXT)
        self.assertEqual(v2["text_origins"]["en"], "reporter")

        # Voice: the reporter corrects the English, then the Urdu with a re-derivation; the English stays theirs.
        csid, w1, _ = self.voice_draft()
        mine = "The water pipe in front of the school is broken"
        w2 = self.correct_texts(csid, w1, english_rendering=mine).json()
        w3 = self.correct_texts(csid, w2, urdu_civic_rendering="سکول کے سامنے پائپ ٹوٹا ہے", derive_from="ur").json()
        self.assertEqual(w3["english_rendering"], mine)
        self.assertEqual(w3["text_origins"]["en"], "reporter")

    def test_correcting_a_voice_transcription_can_rederive_both_languages(self):
        csid, v1, _ = self.voice_draft()
        words = "سکول کے سامنے پانی بہہ رہا ہے"
        v2 = self.correct_texts(csid, v1, transcription=words, derive_from="transcription").json()
        self.assertEqual(v2["transcription"], words)
        self.assertEqual((v2["urdu_civic_rendering"], v2["english_rendering"]),
                         (ai.SIMULATED_UR + words, ai.SIMULATED_EN + words))
        self.assertEqual(v2["text_origins"], {"transcription": "reporter", "ur": "ai_translation", "en": "ai_translation"})

    def test_a_typed_reports_transcription_is_changed_through_the_draft_not_here(self):
        csid, v1, _ = self.typed_draft(ENGLISH_TEXT)
        response = self.correct_texts(csid, v1, transcription="Something else")
        self.assertEqual((response.status_code, response.json()["error"]["field"]), (400, "transcription"))
        self.assertEqual(VoiceTranscriptionArtifact.objects.filter(submission__client_submission_id=csid).count(), 1)

    def test_malformed_corrections_are_refused_without_a_new_version(self):
        csid, v1, _ = self.voice_draft()
        for body in ({}, {"derive_from": "ur"}, {"urdu_civic_rendering": "متن", "derive_from": "en"},
                     {"urdu_civic_rendering": "متن", "derive_from": ["ur"]}, {"english_rendering": "   "},
                     {"english_rendering": 5}, {"transcription": {"x": 1}}):
            response = self.correct_texts(csid, v1, **body)
            self.assertEqual(response.status_code, 400, (body, response.content))
        self.assertEqual(VoiceTranscriptionArtifact.objects.count(), 1)

    @override_settings(PARAKH_SIMULATED_AI_OUTCOME="complete")
    def test_a_failed_rederivation_invents_nothing_and_blocks_submission(self):
        csid, v1, _ = self.voice_draft()
        with self.settings(PARAKH_SIMULATED_AI_OUTCOME="fail"):
            v2 = self.correct_texts(csid, v1, urdu_civic_rendering="درست متن", derive_from="ur").json()
        self.assertEqual(v2["processing_status"], "FAILED")
        self.assertIsNone(v2["english_rendering"])  # no plausible replacement text
        failed = VoiceTranscriptionArtifact.objects.get(rendering_version=2)
        self.assertEqual(failed.english_rendering, "")  # the old AI text is not left in the new version
        self.assertEqual(VoiceTranscriptionArtifact.objects.get(rendering_version=1).english_rendering,
                         v1["english_rendering"])  # the earlier version is untouched
        self.assertEqual(self.submit(csid).json()["error"]["code"], "E_RENDERING_NOT_CONFIRMED")


class EnglishMissingAdapter(ai.SimulatedRenderingAdapter):
    """A test adapter whose output lacks the English text."""

    def render(self, audio, mime_type, hints):
        result = super().render(audio, mime_type, hints)
        return ai.RenderingResult(**{**result.__dict__, "english_rendering": "  "})


class IncompleteOutputTests(ReportingTestCase):
    @override_settings(PARAKH_AI_BACKEND="parakh.drafts.tests.test_bilingual.EnglishMissingAdapter")
    def test_an_output_missing_a_language_fails_and_nothing_is_filled_in(self):
        csid = self.open().json()["client_submission_id"]
        items = [self.item(), self.photo()]
        self.upload_all(csid, items)
        draft = self.complete(csid, items).json()
        self.assertEqual(draft["rendering"]["processing_status"], "FAILED")
        self.assertEqual(draft["rendering"]["failure_code"], "INCOMPLETE_OUTPUT")
        self.assertIsNone(draft["rendering"]["english_rendering"])
        self.assertEqual(draft["pipeline_state"], "SUBMISSION_FAILED")


class SubmittedTextTests(ReportingTestCase):
    def test_the_report_carries_exactly_the_confirmed_texts_and_they_cannot_change(self):
        csid, rendering, _ = self.typed_draft(URDU_TEXT)
        self.confirm(csid, rendering)
        created = self.submit(csid).json()
        detail = self.api.get(f"/citizen/reports/{created['report_id']}").json()["description"]
        self.assertEqual((detail["transcription"], detail["urdu_civic_rendering"], detail["english_rendering"]),
                         (rendering["transcription"], rendering["urdu_civic_rendering"], rendering["english_rendering"]))
        self.assertEqual(detail["rendering_status"], "reporter_confirmed")

        late = self.api.post(f"/citizen/drafts/{csid}/rendering/corrections", {
            "voice_transcription_artifact_id": rendering["voice_transcription_artifact_id"],
            "rendering_version": rendering["rendering_version"],
            "rendering_content_hash": rendering["rendering_content_hash"],
            "english_rendering": "A different text"}, format="json")
        self.assertEqual(late.status_code, 409)
        artifact = VoiceTranscriptionArtifact.objects.get(id=rendering["voice_transcription_artifact_id"])
        started = artifact.processing_started_at
        produced = AuditEvent.objects.filter(action="rendering_produced").count()
        self.advance(60)  # a re-run would stamp a new start time
        run_processing(artifact.id)  # processing never touches a completed, confirmed version
        artifact.refresh_from_db()
        self.assertEqual(artifact.rendering_content_hash, rendering["rendering_content_hash"])
        self.assertEqual((artifact.processing_status, artifact.processing_started_at), ("COMPLETED", started))
        self.assertEqual(AuditEvent.objects.filter(action="rendering_produced").count(), produced)
        self.assertEqual(VoiceTranscriptionArtifact.objects.count(), 1)

    def test_another_citizen_cannot_read_correct_or_confirm_the_texts(self):
        csid, rendering, _ = self.voice_draft()
        other = self.as_other_citizen()
        self.assertEqual(other.get(f"/citizen/drafts/{csid}/rendering").status_code, 404)
        correction = other.post(f"/citizen/drafts/{csid}/rendering/corrections", {
            "voice_transcription_artifact_id": rendering["voice_transcription_artifact_id"],
            "rendering_version": 1, "rendering_content_hash": rendering["rendering_content_hash"],
            "urdu_civic_rendering": "متن"}, format="json")
        self.assertEqual(correction.status_code, 404)
        # With the owner's id the body disagrees with the session (FR-PUB.21); with their own id the
        # draft is simply not theirs, and the answer is the uniform 404.
        self.assertEqual(self.confirm(csid, rendering, client=other).status_code, 400)
        own_id = other.get("/citizen/profile").json()["account_id"]
        self.assertEqual(self.confirm(csid, rendering, client=other, reporter_account_id=own_id).status_code, 404)
        self.assertFalse(RenderingConfirmation.objects.exists())
        self.assertEqual(VoiceTranscriptionArtifact.objects.count(), 1)

    def test_a_lost_submission_response_is_found_by_a_status_check_not_resubmitted(self):  # DG-65
        csid, rendering, _ = self.voice_draft()
        self.confirm(csid, rendering)
        key = str(uuid.uuid4())
        first = self.submit(csid, key).json()  # the device never saw this response
        status = self.api.get(f"/citizen/drafts/{csid}").json()
        self.assertEqual((status["lifecycle"], status["submitted"]), ("submitted", True))
        self.assertNotIn("report_reference", status)  # a draft body never carries a reference
        replay = self.submit(csid, key)
        self.assertEqual((replay.status_code, replay.json()), (200, first))
        self.assertEqual(CivicReport.objects.count(), 1)

    def test_cancelling_after_submission_keeps_the_report_and_its_texts(self):  # DG-55, DG-65
        csid, rendering, _ = self.voice_draft()
        self.confirm(csid, rendering)
        created = self.submit(csid).json()
        response = self.cancel(csid)
        self.assertEqual(response.status_code, 409)
        self.assertEqual(response.json()["error"]["report_reference"], created["report_reference"])
        detail = self.api.get(f"/citizen/reports/{created['report_id']}").json()["description"]
        self.assertEqual(detail["english_rendering"], rendering["english_rendering"])


class CleanUpTimingTests(ReportingTestCase):
    def test_server_clean_up_is_not_tied_to_the_retry_window(self):  # Hassan Jalal, 2026-10-06
        self.assertIn("started", _start({"PARAKH_TEMPORARY_DATA_TTL_HOURS": "24"}).stdout)
        refused = _start({"PARAKH_TEMPORARY_DATA_TTL_HOURS": "0"})
        self.assertNotEqual(refused.returncode, 0)
        self.assertIn("positive number of hours", refused.stderr)
