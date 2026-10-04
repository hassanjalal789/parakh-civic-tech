"""API-140, API-150, API-151: one transaction, one report, own reports only."""
import re
import uuid

from django.db import IntegrityError, transaction

from parakh.drafts.models import ClientSubmission, EvidenceObject, RenderingConfirmation
from parakh.drafts.storage import WriteOnceViolation, get_storage
from parakh.drafts.tests.base import ReportingTestCase
from parakh.reports.models import CivicReport, ReportOwnership, ReportTimelineEntry

REFERENCE = re.compile(r"^PRK-[0-9A-HJKMNP-TV-Z]{4}-[0-9A-HJKMNP-TV-Z]{4}$")


class CreationTests(ReportingTestCase):
    def test_a_report_needs_a_confirmed_rendering(self):  # TEST-API-014
        csid, _, _ = self.voice_draft()
        response = self.submit(csid)
        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"]["code"], "E_RENDERING_NOT_CONFIRMED")
        self.assertEqual(CivicReport.objects.count(), 0)

    def test_a_confirmed_draft_becomes_exactly_one_submitted_report_in_one_transaction(self):
        csid, rendering, items = self.voice_draft(photos=1)
        self.confirm(csid, rendering)
        response = self.submit(csid)
        self.assertEqual(response.status_code, 201)
        body = response.json()
        self.assertEqual(set(body), {"report_id", "report_reference", "state", "created_at"})
        self.assertEqual(body["state"], "SUBMITTED")
        self.assertRegex(body["report_reference"], REFERENCE)

        report = CivicReport.objects.get()
        draft = ClientSubmission.objects.get()
        confirmation = RenderingConfirmation.objects.get()
        self.assertEqual(report.state, "SUBMITTED")
        self.assertEqual((report.confirmed_rendering_artifact_id, report.confirmed_rendering_version),
                         (uuid.UUID(rendering["voice_transcription_artifact_id"]), 1))
        self.assertEqual(draft.resulting_report_id, report.id)
        self.assertEqual(confirmation.resulting_report_id, report.id)
        self.assertTrue(ReportOwnership.objects.filter(report=report, subject_id=report.citizen_account_id).exists())
        self.assertEqual(list(ReportTimelineEntry.objects.values_list("state", flat=True)), ["SUBMITTED"])
        self.assertEqual(set(EvidenceObject.objects.values_list("report_id", flat=True)), {report.id})
        self.assertEqual(report.evidence_completeness, "photographic")
        # Capture time is operative; the received time is kept separately (FR-PUB.25).
        self.assertEqual(report.captured_at, draft.captured_at)
        self.assertNotEqual(report.captured_at, report.received_at)

    def test_a_replay_returns_the_original_report_and_never_a_second_one(self):  # TEST-API-013, TEST-DATA-025
        csid, rendering, _ = self.voice_draft()
        self.confirm(csid, rendering)
        key = str(uuid.uuid4())
        first = self.submit(csid, key).json()
        replay = self.submit(csid, key)
        self.assertEqual(replay.status_code, 200)
        self.assertEqual(replay.json(), first)
        new_key = self.submit(csid)  # a lost response retried with a fresh key: still the original
        self.assertEqual(new_key.json()["report_reference"], first["report_reference"])
        self.assertEqual(CivicReport.objects.count(), 1)

    def test_a_key_already_used_for_another_draft_is_refused(self):
        key = str(uuid.uuid4())
        a, ra, _ = self.voice_draft()
        b, rb, _ = self.voice_draft()
        self.confirm(a, ra)
        self.confirm(b, rb)
        self.assertEqual(self.submit(a, key).status_code, 201)
        self.assertEqual(self.submit(b, key).json()["error"]["code"], "E_IDEMPOTENCY_CONFLICT")
        self.assertEqual(CivicReport.objects.count(), 1)

    def test_confirming_an_older_version_does_not_permit_submission(self):
        csid, v1, _ = self.voice_draft()
        self.confirm(csid, v1)
        self.correct(csid, v1, "درست شدہ متن")
        self.assertEqual(self.api.get(f"/citizen/drafts/{csid}").json()["pipeline_state"], "AWAITING_REPORTER_REVIEW")
        self.assertEqual(self.submit(csid).json()["error"]["code"], "E_RENDERING_NOT_CONFIRMED")

    def test_a_typed_report_needs_a_photo_and_a_confirmed_rendering(self):  # DG-53, DG-47
        csid, rendering, _ = self.typed_draft("Pipe burst near the school")
        self.assertEqual(self.submit(csid).json()["error"]["code"], "E_RENDERING_NOT_CONFIRMED")
        self.confirm(csid, rendering)
        self.assertEqual(self.submit(csid).status_code, 201)
        report = CivicReport.objects.get()
        self.assertEqual((report.description_mode, report.evidence_completeness), ("typed", "photographic"))
        self.assertEqual(report.typed_description, "Pipe burst near the school")
        self.assertEqual(str(report.confirmed_rendering_artifact_id), rendering["voice_transcription_artifact_id"])
        detail = self.api.get(f"/citizen/reports/{report.id}").json()["description"]
        self.assertEqual((detail["mode"], detail["typed_description"], detail["rendering_status"]),
                         ("typed", "Pipe burst near the school", "reporter_confirmed"))

    def test_creation_seals_the_evidence_and_removes_the_temporary_copies(self):  # DG-55
        csid, rendering, items = self.voice_draft(photos=2, video=True)
        self.confirm(csid, rendering)
        self.submit(csid)
        storage = get_storage()
        for ev in EvidenceObject.objects.all():
            self.assertIsNotNone(ev.sealed_at)
            original = next(i["data"] for i in items if i["evidence_id"] == str(ev.client_evidence_id))
            self.assertEqual(storage.get_evidence(ev.storage_key), original)
            self.assertFalse((storage.root / "processing" / ev.storage_key[:2] / ev.storage_key).exists())
            with self.assertRaises(WriteOnceViolation):
                storage.seal(ev.storage_key, b"something else")

    def test_an_incomplete_upload_cannot_become_a_report(self):
        csid = self.open().json()["client_submission_id"]
        self.assertEqual(self.submit(csid).json()["error"]["code"], "E_UPLOAD_INCOMPLETE")

    def test_another_citizens_draft_is_the_uniform_404(self):
        csid, rendering, _ = self.voice_draft()
        self.confirm(csid, rendering)
        other = self.as_other_citizen()
        self.assertEqual(self.submit(csid, client=other).status_code, 404)
        self.assertEqual(CivicReport.objects.count(), 0)


class LifecycleRuleTests(ReportingTestCase):
    def test_there_is_no_draft_state_and_no_other_creation_state(self):  # TEST-DATA-021, TEST-API-015
        self.assertNotIn("DRAFT", CivicReport.State.values)
        self.assertEqual(len(CivicReport.State.values), 15)
        csid, rendering, _ = self.voice_draft()
        self.confirm(csid, rendering)
        report = CivicReport.objects.get(id=self.submit(csid).json()["report_id"])
        clone = CivicReport(**{f.attname: getattr(report, f.attname) for f in CivicReport._meta.concrete_fields
                               if f.attname != "id"})
        clone.state = CivicReport.State.UNDER_VERIFICATION
        with self.assertRaises(ValueError):
            clone.save()
        with self.assertRaises(ValueError):
            CivicReport.objects.bulk_create([clone])

    def test_only_one_attribution_shape_is_accepted(self):
        csid, rendering, _ = self.voice_draft()
        self.confirm(csid, rendering)
        report = CivicReport.objects.get(id=self.submit(csid).json()["report_id"])
        report.official_reporter_account_id = uuid.uuid4()
        with self.assertRaises(IntegrityError), transaction.atomic():
            report.save()

    def test_draft_responses_never_carry_a_reference(self):  # TEST-API-016
        csid, rendering, _ = self.voice_draft()
        self.confirm(csid, rendering)
        reference = self.submit(csid).json()["report_reference"]
        draft = self.api.get(f"/citizen/drafts/{csid}")
        self.assertTrue(draft.json()["submitted"])
        self.assertNotIn(reference, draft.content.decode())
        self.assertNotIn("report_reference", draft.content.decode())


class OwnReportsTests(ReportingTestCase):
    def _report(self, photos=1):
        csid, rendering, items = self.voice_draft(photos=photos)
        self.confirm(csid, rendering)
        return self.submit(csid).json(), items

    def test_the_list_shows_reports_and_unsent_drafts_distinctly(self):  # FR-PUB.31
        created, _ = self._report()
        unsent = self.open().json()["client_submission_id"]
        body = self.api.get("/citizen/reports").json()
        self.assertEqual([r["report_reference"] for r in body["reports"]], [created["report_reference"]])
        self.assertEqual([d["client_submission_id"] for d in body["unsent_drafts"]], [unsent])
        self.assertNotIn("report_reference", body["unsent_drafts"][0])
        other = self.as_other_citizen()
        self.assertEqual(other.get("/citizen/reports").json(), {"reports": [], "unsent_drafts": []})

    def test_detail_is_for_the_owner_only_and_is_sanitised(self):  # FR-PUB.32, TEST-API-019
        created, _ = self._report()
        mine = self.api.get(f"/citizen/reports/{created['report_id']}")
        self.assertEqual(mine.status_code, 200)
        self.assertEqual(mine["Cache-Control"], "no-store")
        detail = mine.json()
        self.assertEqual(detail["description"]["rendering_status"], "reporter_confirmed")
        self.assertEqual([t["state"] for t in detail["timeline"]], ["SUBMITTED"])
        self.assertNotIn("source_asr_text", mine.content.decode())
        self.assertNotIn("citizen_account", mine.content.decode())
        other = self.as_other_citizen()
        not_owned = other.get(f"/citizen/reports/{created['report_id']}")
        missing = other.get(f"/citizen/reports/{uuid.uuid4()}")
        self.assertEqual((not_owned.status_code, not_owned.json()), (missing.status_code, missing.json()))
        self.assertEqual(not_owned.status_code, 404)

    def test_the_owner_plays_back_the_original_recording_byte_for_byte(self):  # FR-PUB.10, FR-PUB.32
        created, items = self._report(photos=1)
        detail = self.api.get(f"/citizen/reports/{created['report_id']}").json()
        voice = next(e for e in detail["evidence"] if e["kind"] == "voice_original")
        response = self.api.get(f"/citizen/reports/{created['report_id']}/evidence/{voice['evidence_id']}")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.content, items[0]["data"])
        self.assertEqual(response["Cache-Control"], "no-store")
        other = self.as_other_citizen()
        self.assertEqual(
            other.get(f"/citizen/reports/{created['report_id']}/evidence/{voice['evidence_id']}").status_code, 404
        )

    def test_summary_counts_and_categories(self):
        self._report()
        self.open()
        self.assertEqual(
            self.api.get("/citizen/reports/summary").json(),
            {"reports": 1, "open": 1, "awaiting_your_confirmation": 0, "unsent_drafts": 1},
        )
        categories = self.api.get("/categories").json()
        self.assertEqual([c["key"] for c in categories["categories"]],
                         ["water", "road", "drainage", "streetlight", "waste", "other"])
