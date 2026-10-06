"""Shared helpers for the reporting pipeline. All data is synthetic; no real citizen data is used."""
import base64
import hashlib
import shutil
import struct
import tempfile
import uuid
from datetime import timedelta
from pathlib import Path

from django.test import TestCase, TransactionTestCase, override_settings

from parakh.authentication.tests.base import NUMBER, OTHER_NUMBER, AuthTestMixin
from parakh.drafts.services import manifest_hash


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def _box(kind: bytes, payload: bytes) -> bytes:
    return struct.pack(">I", 8 + len(payload)) + kind + payload


def mp4(seconds: float, tracks=("soun",), brand: bytes = b"M4A ", padding: int = 100_000) -> bytes:
    """A structurally valid ISO base-media file with no real media in it.

    ftyp, then moov (mvhd with the duration, one trak per handler type), then an mdat of filler.
    """
    ftyp = _box(b"ftyp", brand + struct.pack(">I", 0) + brand + b"isom")
    mvhd = _box(b"mvhd", b"\x00\x00\x00\x00" + struct.pack(">IIII", 0, 0, 1000, int(seconds * 1000)) + b"\x00" * 80)
    traks = b"".join(
        _box(b"trak", _box(b"mdia", _box(b"hdlr", b"\x00" * 8 + t.encode() + b"\x00" * 12))) for t in tracks
    )
    filler = (b"synthetic-media-not-a-recording " * (padding // 32 + 1))[:padding]
    return ftyp + _box(b"moov", mvhd + traks) + _box(b"mdat", filler)


VOICE_BYTES = mp4(30)  # ~100 KB: three chunks of 48 KB
VIDEO_BYTES = mp4(30, tracks=("vide", "soun"), brand=b"mp42", padding=150_000)
PHOTO_BYTES = b"\xff\xd8\xff\xe0 synthetic-jpeg-not-a-photo " * 2500

MIME = {"voice_original": "audio/mp4", "photo": "image/jpeg", "video": "video/mp4"}
DATA = {"voice_original": VOICE_BYTES, "photo": PHOTO_BYTES, "video": VIDEO_BYTES}


class ReportingMixin(AuthTestMixin):
    def setUp(self):
        super().setUp()
        root = Path(tempfile.mkdtemp(prefix="parakh-test-evidence-"))  # each test its own storage
        self.addCleanup(shutil.rmtree, root, True)
        isolated = override_settings(PARAKH_EVIDENCE_ROOT=root)
        isolated.enable()
        self.addCleanup(isolated.disable)
        self.bearer(self.sign_up()["access_token"])

    def sign_in_again(self):
        """After a long clock jump the access token has expired; sign the same citizen in again."""
        self.api.credentials()
        self.bearer(self.sign_up(NUMBER)["access_token"])

    def as_other_citizen(self):
        """Signs up a second synthetic citizen on a separate client."""
        from rest_framework.test import APIClient

        mine = self.api
        self.api = APIClient()
        tokens = self.sign_up(OTHER_NUMBER)
        other = APIClient()
        other.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access_token']}")
        self.api = mine
        return other

    # --- API-130 -------------------------------------------------------------
    def draft_payload(self, **overrides) -> dict:
        body = {
            "client_submission_id": str(uuid.uuid4()),
            "category": "water",
            "description_mode": "voice",
            "captured_at": (self.now - timedelta(hours=3)).isoformat(),
            "location": {"latitude": 31.520370, "longitude": 74.358749, "accuracy_m": 12.5, "source": "device"},
        }
        body.update(overrides)
        return body

    def open(self, client=None, **overrides):
        return (client or self.api).post("/citizen/drafts", self.draft_payload(**overrides), format="json")

    def open_typed(self, text: str = "Pipe burst near the school", **overrides):
        return self.open(description_mode="typed", typed_description=text, **overrides)

    # --- API-131 / API-132 ------------------------------------------------------
    @staticmethod
    def item(kind: str = "voice_original", data: bytes | None = None, mime: str | None = None) -> dict:
        data = data if data is not None else DATA[kind]
        return {"evidence_id": str(uuid.uuid4()), "kind": kind, "mime_type": mime or MIME[kind], "data": data,
                "sha256": sha(data)}

    def photo(self, n: int = 0) -> dict:
        return self.item("photo", data=PHOTO_BYTES + str(n).encode())

    def chunk_body(self, item: dict, index: int, chunk: bytes, count: int, **overrides) -> dict:
        body = {
            "evidence_id": item["evidence_id"],
            "kind": item["kind"],
            "mime_type": item["mime_type"],
            "byte_size": len(item["data"]),
            "sha256": item["sha256"],
            "captured_at": (self.now - timedelta(hours=3)).isoformat(),
            "chunk_index": index,
            "chunk_count": count,
            "chunk_sha256": sha(chunk),
            "chunk_base64": base64.b64encode(chunk).decode(),
        }
        body.update(overrides)
        return body

    def upload(self, csid: str, item: dict, chunk_size: int = 48 * 1024, skip=(), client=None):
        data = item["data"]
        chunks = [data[i : i + chunk_size] for i in range(0, len(data), chunk_size)]
        responses = []
        for index, chunk in enumerate(chunks):
            if index in skip:
                continue
            responses.append(
                (client or self.api).post(
                    f"/citizen/drafts/{csid}/evidence",
                    self.chunk_body(item, index, chunk, len(chunks)),
                    format="json",
                )
            )
        return responses

    def upload_all(self, csid: str, items: list[dict]) -> None:
        for it in items:
            for r in self.upload(csid, it):
                assert r.status_code == 200, r.content

    @staticmethod
    def manifest(items: list[dict]) -> dict:
        entries = [
            {"evidence_id": i["evidence_id"], "kind": i["kind"], "sha256": i["sha256"], "byte_size": len(i["data"])}
            for i in items
        ]
        digest = manifest_hash([(e["evidence_id"], e["kind"], e["sha256"], e["byte_size"]) for e in entries])
        return {"manifest": entries, "manifest_sha256": digest}

    def complete(self, csid: str, items: list[dict], client=None):
        return (client or self.api).post(f"/citizen/drafts/{csid}/evidence/complete", self.manifest(items), format="json")

    def voice_draft(self, photos: int = 1, video: bool = False) -> tuple[str, dict, list[dict]]:
        """A voice draft uploaded and processed: (client_submission_id, active rendering, items)."""
        csid = self.open().json()["client_submission_id"]
        items = [self.item()] + [self.photo(n) for n in range(photos)] + ([self.item("video")] if video else [])
        self.upload_all(csid, items)
        done = self.complete(csid, items)
        assert done.status_code == 200, done.content
        assert done.json()["pipeline_state"] == "AWAITING_REPORTER_REVIEW", done.content
        return csid, done.json()["rendering"], items

    def typed_draft(self, text: str = "Pipe burst near the school", photos: int = 1):
        csid = self.open_typed(text).json()["client_submission_id"]
        items = [self.photo(n) for n in range(photos)]
        self.upload_all(csid, items)
        done = self.complete(csid, items)
        assert done.status_code == 200, done.content
        assert done.json()["pipeline_state"] == "AWAITING_REPORTER_REVIEW", done.content
        return csid, done.json()["rendering"], items

    # --- API-135 / API-140 ---------------------------------------------------------
    def confirmation_body(self, csid: str, rendering: dict, **overrides) -> dict:
        draft = self.api.get(f"/citizen/drafts/{csid}").json()
        body = {
            "voice_transcription_artifact_id": rendering["voice_transcription_artifact_id"],
            "client_submission_id": csid,
            "rendering_version": rendering["rendering_version"],
            "rendering_content_hash": rendering["rendering_content_hash"],
            "reporter_subject_type": draft["reporter_subject_type"],
            "reporter_account_id": draft["reporter_account_id"],
            "confirmed_at": self.now.isoformat(),
            "reviewed_texts": ["transcription", "ur", "en"],  # the reporter reviewed all three (DG-62)
        }
        body.update(overrides)
        return body

    def confirm(self, csid: str, rendering: dict, key: str | None = None, client=None, **overrides):
        return (client or self.api).post(
            f"/citizen/drafts/{csid}/rendering/confirm",
            self.confirmation_body(csid, rendering, **overrides),
            format="json",
            HTTP_X_CONFIRMATION_IDEMPOTENCY_KEY=key or str(uuid.uuid4()),
        )

    def submit(self, csid: str, key: str | None = None, client=None):
        return (client or self.api).post(
            "/citizen/reports",
            {"client_submission_id": csid},
            format="json",
            HTTP_X_SUBMISSION_IDEMPOTENCY_KEY=key or str(uuid.uuid4()),
        )

    def cancel(self, csid: str, client=None):
        return (client or self.api).delete(f"/citizen/drafts/{csid}")

    def correct(self, csid: str, rendering: dict, text: str, fields=("location",)):
        return self.api.post(
            f"/citizen/drafts/{csid}/rendering/corrections",
            {
                "voice_transcription_artifact_id": rendering["voice_transcription_artifact_id"],
                "rendering_version": rendering["rendering_version"],
                "rendering_content_hash": rendering["rendering_content_hash"],
                "urdu_civic_rendering": text,
                "corrected_fields": list(fields),
            },
            format="json",
        )


class ReportingTestCase(ReportingMixin, TestCase):
    pass


class ReportingTransactionTestCase(ReportingMixin, TransactionTestCase):
    pass
