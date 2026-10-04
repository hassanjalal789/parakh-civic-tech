"""Evidence storage (DR-6: write-once).

Two areas, both addressed by opaque random keys that never contain an
account id, a phone number or a name:

- **evidence** — write-once. A key can be written exactly once and is then
  read-only; there is no overwrite and no delete method.
- **staging** — received chunks before the manifest completes. Deletable.

`LocalStorage` keeps both on the local file system for development and
tests. No object-store backend exists yet, so production refuses to start
(see `check_evidence_storage_configuration`).
"""
from __future__ import annotations

import os
import secrets
from pathlib import Path

from django.conf import settings
from django.core.exceptions import ImproperlyConfigured
from django.utils.module_loading import import_string


def new_storage_key() -> str:
    return secrets.token_hex(16)


class WriteOnceViolation(Exception):
    pass


class LocalStorage:
    """Development and test only."""

    def __init__(self, root: Path | str | None = None):
        if settings.PARAKH_ENV not in {"development", "test"}:
            raise ImproperlyConfigured("LocalStorage is for development and test only")
        self.root = Path(root or settings.PARAKH_EVIDENCE_ROOT)

    def _path(self, area: str, key: str) -> Path:
        if not key.isalnum():
            raise ValueError("storage keys are opaque alphanumeric strings")
        return self.root / area / key[:2] / key

    # --- write-once evidence ---------------------------------------------
    def put_evidence(self, key: str, data: bytes) -> None:
        """Writes once. Writing the identical bytes again is a no-op; different bytes are refused."""
        path = self._path("evidence", key)
        path.parent.mkdir(parents=True, exist_ok=True)
        try:
            with open(path, "xb") as f:  # exclusive create: never overwrites
                f.write(data)
        except FileExistsError as exc:
            if path.read_bytes() != data:
                raise WriteOnceViolation(key) from exc
            return
        os.chmod(path, 0o400)

    def get_evidence(self, key: str) -> bytes:
        return self._path("evidence", key).read_bytes()

    def discard_unsubmitted_evidence(self, key: str) -> None:
        """Only for an item the reporter deleted or retook before any report used it (FR-PUB.6)."""
        path = self._path("evidence", key)
        if path.exists():
            os.chmod(path, 0o600)
            path.unlink()

    # --- deletable staging -------------------------------------------------
    def put_staging(self, key: str, data: bytes) -> None:
        path = self._path("staging", key)
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(data)

    def get_staging(self, key: str) -> bytes:
        return self._path("staging", key).read_bytes()

    def delete_staging(self, key: str) -> None:
        self._path("staging", key).unlink(missing_ok=True)


_DEVELOPMENT_BACKENDS = {"parakh.drafts.storage.LocalStorage"}


def check_evidence_storage_configuration(env: str, backend: str) -> None:
    if env == "production" and (not backend or backend in _DEVELOPMENT_BACKENDS):
        raise ImproperlyConfigured("Production needs a write-once object store for evidence; none is implemented yet")


def get_storage():
    return import_string(settings.PARAKH_EVIDENCE_STORAGE)()
