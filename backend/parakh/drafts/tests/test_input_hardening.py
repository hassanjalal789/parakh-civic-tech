"""Malformed input gets a 400, never a 500 (independent review of 2026-10-04, findings 1-3)."""
from django.test import SimpleTestCase

from parakh.drafts import media
from parakh.drafts.models import EvidenceObject
from parakh.reports.models import CivicReport

from .base import ReportingTestCase, _box


def _empty_mvhd_video() -> bytes:
    """The review's fixture: a valid ftyp, then a moov whose mvhd is empty and ends the file."""
    return _box(b"ftyp", b"mp42" + b"\x00" * 4 + b"isom") + _box(b"moov", _box(b"mvhd", b""))


class InputHardeningTests(ReportingTestCase):
    def setUp(self):
        super().setUp()
        self.api.raise_request_exception = False  # a server error must show up as a 500, not as a test crash

    def test_an_impossible_calendar_date_is_a_validation_error(self):  # finding 1
        for field_value in ("2026-02-30T09:00:00+00:00", "2026-13-01T09:00:00+00:00", "2026-10-04T25:00:00+00:00"):
            response = self.open(captured_at=field_value)
            self.assertEqual(response.status_code, 400, field_value)
            self.assertEqual(response.json()["error"]["field"], "captured_at")

    def test_a_collection_valued_kind_is_a_validation_error(self):  # finding 2
        csid = self.open().json()["client_submission_id"]
        it = self.item()
        chunk = it["data"][:1000]
        for bad in ([], {}, ["photo"], {"kind": "photo"}, 7, None):
            body = self.chunk_body(it, 0, chunk, 3, kind=bad)
            response = self.api.post(f"/citizen/drafts/{csid}/evidence", body, format="json")
            self.assertEqual(response.status_code, 400, bad)
            self.assertEqual(response.json()["error"]["field"], "kind")
            body = self.chunk_body(it, 0, chunk, 3, mime_type=bad)
            response = self.api.post(f"/citizen/drafts/{csid}/evidence", body, format="json")
            self.assertEqual(response.status_code, 400, bad)
        valid = self.chunk_body(it, 0, chunk, 3, chunk_sha256=None)  # still validated as a sha, not a crash
        self.assertEqual(self.api.post(f"/citizen/drafts/{csid}/evidence", valid, format="json").status_code, 400)

    def test_a_collection_valued_manifest_kind_is_a_validation_error(self):  # finding 2, manifest boundary
        csid = self.open().json()["client_submission_id"]
        items = [self.item(), self.photo()]
        self.upload_all(csid, items)
        for bad in ([], {}, ["photo"]):
            body = self.manifest(items)
            body["manifest"][1]["kind"] = bad
            response = self.api.post(f"/citizen/drafts/{csid}/evidence/complete", body, format="json")
            self.assertEqual(response.status_code, 400, bad)
            self.assertEqual(response.json()["error"]["field"], "manifest")
        self.assertEqual(self.complete(csid, items).status_code, 200)  # the valid manifest still completes

    def test_an_empty_or_truncated_movie_header_is_a_validation_error(self):  # finding 3
        csid = self.open().json()["client_submission_id"]
        items = [self.item(), self.photo(), self.item("video", data=_empty_mvhd_video())]
        self.upload_all(csid, items)
        response = self.complete(csid, items)
        self.assertEqual(response.status_code, 400)
        self.assertEqual(response.json()["error"]["field"], "evidence_type")
        retried = items[:2]  # without the broken video the same draft still completes
        self.assertEqual(self.complete(csid, retried).status_code, 200)

    def test_a_late_partial_upload_is_never_attached_to_the_report(self):  # review: retain this regression
        csid, rendering, items = self.voice_draft(photos=3)
        self.confirm(csid, rendering)
        late = self.photo(9)
        self.upload(csid, late, skip=range(1, 99))  # one chunk only: RECEIVING, not in the manifest
        response = self.submit(csid)
        self.assertEqual(response.status_code, 201)
        report = CivicReport.objects.get()
        attached = set(EvidenceObject.objects.filter(report_id=report.id).values_list("client_evidence_id", flat=True))
        self.assertEqual({str(x) for x in attached}, {i["evidence_id"] for i in items})
        leftover = EvidenceObject.objects.get(client_evidence_id=late["evidence_id"])
        self.assertIsNone(leftover.report_id)
        self.assertIsNone(leftover.sealed_at)
        self.assertIsNotNone(leftover.deleted_at)  # discarded at submission: no orphan temporary data
        self.assertFalse(leftover.chunks.exists())


class MovieHeaderParserTests(SimpleTestCase):  # finding 3, unit level
    def test_every_truncated_header_raises_malformed_media(self):
        ftyp = _box(b"ftyp", b"mp42" + b"\x00" * 4 + b"isom")
        cases = [
            ftyp + _box(b"moov", _box(b"mvhd", b"")),  # empty mvhd at the end of the file
            ftyp + _box(b"moov", _box(b"mvhd", b"\x00")),  # version byte only
            ftyp + _box(b"moov", _box(b"mvhd", b"\x01" + b"\x00" * 10)),  # version 1, truncated
            ftyp + _box(b"moov", _box(b"trak", _box(b"mdia", _box(b"hdlr", b"\x00" * 3)))),  # tiny hdlr, no mvhd
            ftyp + _box(b"moov", b""),  # empty moov
            _box(b"ftyp", b""),  # empty ftyp
        ]
        for data in cases:
            with self.assertRaises(media.MalformedMedia, msg=data[:40]):
                media.summarise(data)


class TypeConfusionSweepTests(ReportingTestCase):
    """Every field of every reporting route, given the wrong type, gets a 4xx — never a 500."""

    BAD_VALUES = ([], {}, ["x"], {"a": 1}, 1.5, True, None, -1, "x" * 5000, "")

    def setUp(self):
        super().setUp()
        self.api.raise_request_exception = False

    def _sweep(self, method, path, body, headers=None):
        failures = []
        for field in list(body):
            for bad in self.BAD_VALUES:
                response = getattr(self.api, method)(path, {**body, field: bad}, format="json", **(headers or {}))
                if response.status_code >= 500:
                    failures.append((path.rsplit("/", 1)[-1], field, repr(bad)[:20], response.status_code))
        self.assertEqual(failures, [])

    def test_no_reporting_route_answers_a_wrong_type_with_a_server_error(self):
        csid, rendering, items = self.voice_draft()
        self._sweep("post", "/citizen/drafts", self.draft_payload())
        self._sweep("post", "/citizen/drafts", {**self.draft_payload(), "location": {"latitude": [], "source": {}}})
        it = self.photo(5)
        self._sweep("post", f"/citizen/drafts/{csid}/evidence", self.chunk_body(it, 0, it["data"][:1000], 1))
        manifest = self.manifest(items)
        self._sweep("post", f"/citizen/drafts/{csid}/evidence/complete", manifest)
        self._sweep("post", f"/citizen/drafts/{csid}/evidence/complete",
                    {**manifest, "manifest": [dict(manifest["manifest"][0], byte_size=[], sha256={})]})
        self._sweep("post", f"/citizen/drafts/{csid}/rendering/corrections", {
            "voice_transcription_artifact_id": rendering["voice_transcription_artifact_id"],
            "rendering_version": 1, "rendering_content_hash": rendering["rendering_content_hash"],
            "urdu_civic_rendering": "متن", "corrected_fields": ["location"]})
        self._sweep("post", f"/citizen/drafts/{csid}/rendering/confirm", self.confirmation_body(csid, rendering),
                    {"HTTP_X_CONFIRMATION_IDEMPOTENCY_KEY": "5f2b1a3e-0c4d-4e5f-8a9b-0c1d2e3f4a5b"})
        self._sweep("post", "/citizen/reports", {"client_submission_id": csid},
                    {"HTTP_X_SUBMISSION_IDEMPOTENCY_KEY": "6f2b1a3e-0c4d-4e5f-8a9b-0c1d2e3f4a5b"})
