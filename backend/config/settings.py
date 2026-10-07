"""Django settings for the Parakh backend.

Environment-driven. `PARAKH_ENV` is one of: development, test, production.
No secret is committed: keys come from the environment. In development, if a
key is missing, a random key is generated once and kept in the git-ignored
`backend/.local/dev-keys.json`. In test, random keys are generated per run.
Production refuses to start without real keys and a real SMS backend.
"""
from __future__ import annotations

import json
import os
import secrets
import sys
from pathlib import Path

from cryptography.fernet import Fernet
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent
LOCAL_DIR = BASE_DIR / ".local"

PARAKH_ENV = os.environ.get("PARAKH_ENV") or ("test" if "test" in sys.argv[1:2] else "development")
if PARAKH_ENV not in {"development", "test", "production"}:
    raise ImproperlyConfigured(f"PARAKH_ENV must be development, test or production, not {PARAKH_ENV!r}")

DEBUG = PARAKH_ENV == "development"


def _dev_keys() -> dict[str, str]:
    """Development-only keys, generated once and stored outside version control."""
    LOCAL_DIR.mkdir(exist_ok=True)
    path = LOCAL_DIR / "dev-keys.json"
    if path.exists():
        return json.loads(path.read_text())
    keys = {
        "DJANGO_SECRET_KEY": secrets.token_urlsafe(50),
        "PARAKH_PHONE_HMAC_KEY": secrets.token_urlsafe(32),
        "PARAKH_PHONE_ENC_KEY": Fernet.generate_key().decode(),
        "PARAKH_OTP_HASH_KEY": secrets.token_urlsafe(32),
    }
    path.write_text(json.dumps(keys))
    path.chmod(0o600)
    return keys


def _key(name: str) -> str:
    value = os.environ.get(name)
    if value:
        return value
    if PARAKH_ENV == "production":
        raise ImproperlyConfigured(f"{name} must be set in production")
    if PARAKH_ENV == "test":
        return Fernet.generate_key().decode() if name == "PARAKH_PHONE_ENC_KEY" else secrets.token_urlsafe(32)
    return _dev_keys()[name]


SECRET_KEY = _key("DJANGO_SECRET_KEY")
PARAKH_PHONE_HMAC_KEY = _key("PARAKH_PHONE_HMAC_KEY")
PARAKH_PHONE_ENC_KEY = _key("PARAKH_PHONE_ENC_KEY")
PARAKH_OTP_HASH_KEY = _key("PARAKH_OTP_HASH_KEY")

ALLOWED_HOSTS = [h for h in os.environ.get("DJANGO_ALLOWED_HOSTS", "").split(",") if h] or (
    ["localhost", "127.0.0.1", "10.0.2.2", "testserver"] if PARAKH_ENV != "production" else []
)

INSTALLED_APPS = [
    "django.contrib.contenttypes",
    "rest_framework",
    "parakh.core",
    "parakh.audit",
    "parakh.identity_vault",
    "parakh.accounts",
    "parakh.authentication",
    "parakh.drafts",
    "parakh.reports",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.middleware.common.CommonMiddleware",
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

if os.environ.get("PARAKH_DB_ENGINE") == "postgresql":
    DATABASES = {
        "default": {
            "ENGINE": "django.db.backends.postgresql",
            "NAME": os.environ["PARAKH_DB_NAME"],
            "USER": os.environ["PARAKH_DB_USER"],
            "PASSWORD": os.environ.get("PARAKH_DB_PASSWORD", ""),
            "HOST": os.environ.get("PARAKH_DB_HOST", "localhost"),
            "PORT": os.environ.get("PARAKH_DB_PORT", "5432"),
        }
    }
else:
    # SQLite is a local-development substitute only. PostgreSQL + PostGIS is the
    # specified database (DR-6); it is not installed yet (T-023).
    if PARAKH_ENV == "production":
        raise ImproperlyConfigured("Production requires PARAKH_DB_ENGINE=postgresql")
    LOCAL_DIR.mkdir(exist_ok=True)
    DATABASES = {"default": {"ENGINE": "django.db.backends.sqlite3", "NAME": LOCAL_DIR / "dev.sqlite3"}}

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
USE_TZ = True
TIME_ZONE = "UTC"
LANGUAGE_CODE = "en"

REST_FRAMEWORK = {
    # Deny by default (NFR-42): every view requires authentication unless it
    # explicitly declares a Public-auth or Refresh-only transport class.
    "DEFAULT_AUTHENTICATION_CLASSES": ["parakh.authentication.tokens.BearerSessionAuthentication"],
    "DEFAULT_PERMISSION_CLASSES": ["rest_framework.permissions.IsAuthenticated"],
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PARSER_CLASSES": ["rest_framework.parsers.JSONParser"],
    "EXCEPTION_HANDLER": "parakh.core.errors.exception_handler",
    "UNAUTHENTICATED_USER": None,
}

# --- SMS (DG-15: no provider selected; DG-48: development adapters) ---------
PARAKH_SMS_BACKEND = os.environ.get("PARAKH_SMS_BACKEND") or (
    {
        "development": "parakh.authentication.sms.DevelopmentConsoleSmsSender",
        "test": "parakh.authentication.sms.TestOutboxSmsSender",
        "production": "",
    }[PARAKH_ENV]
)
from parakh.authentication.sms import check_sms_configuration  # noqa: E402

check_sms_configuration(PARAKH_ENV, PARAKH_SMS_BACKEND)  # production refuses development adapters

# --- OTP policy -------------------------------------------------------------
# Fixed by FR-AUTH.8 / NFR-52: six digits, five-minute expiry, single use,
# at most five attempts. The remaining numbers are PROPOSED DEFAULTS taken from
# a proposal in the incoming documents (DR-29); FR-AUTH.8 reserves them for Hassan (DG-13).
PARAKH_OTP = {
    "LENGTH": 6,
    "TTL_SECONDS": 300,
    "MAX_ATTEMPTS": 5,
    "RESEND_COOLDOWN_SECONDS": int(os.environ.get("PARAKH_OTP_RESEND_COOLDOWN_SECONDS", 60)),  # proposed default
    "MAX_PER_NUMBER_PER_HOUR": int(os.environ.get("PARAKH_OTP_MAX_PER_NUMBER_PER_HOUR", 3)),  # proposed default
    "MAX_PER_NUMBER_PER_DAY": int(os.environ.get("PARAKH_OTP_MAX_PER_NUMBER_PER_DAY", 10)),  # proposed default
    "MAX_PER_DEVICE_PER_HOUR": int(os.environ.get("PARAKH_OTP_MAX_PER_DEVICE_PER_HOUR", 5)),  # proposed default
    "MAX_PER_IP_PER_HOUR": int(os.environ.get("PARAKH_OTP_MAX_PER_IP_PER_HOUR", 20)),  # proposed default
}

# --- Sessions (no source value exists; development defaults, labelled) ------
PARAKH_ACCESS_TOKEN_TTL_SECONDS = int(os.environ.get("PARAKH_ACCESS_TOKEN_TTL_SECONDS", 900))
PARAKH_REFRESH_TOKEN_TTL_SECONDS = int(os.environ.get("PARAKH_REFRESH_TOKEN_TTL_SECONDS", 30 * 24 * 3600))

# --- Consent (FR-AUTH.3): versions of the text shown on CIT-02 / CIT-03 -----
# Placeholder version identifier until the human-reviewed consent text exists (T-045).
PARAKH_CONSENT_VERSION = os.environ.get("PARAKH_CONSENT_VERSION", "citizen-consent-draft-1")

# --- Reporting ---------------------------------------------------------------
# FR-PUB.2 fixes the six categories. Their labels live in the client.
PARAKH_CATEGORIES = ["water", "road", "drainage", "streetlight", "waste", "other"]
PARAKH_CATEGORIES_VERSION = "categories-1"

# Two separate retention rules, decided separately by Hassan Jalal. Neither is derived from the
# other, in code or by arithmetic; changing one never changes the other.
#
# 1. Device-side submission retry window (DG-14, 2026-10-04; DG-67, 2026-10-07): the device retries
#    a submission the citizen explicitly sent for 48 hours from the first press of Submit, then
#    deletes its local copy. The device enforces it; the server only answers each replay with the
#    original report, so no server code reads this value.
PARAKH_SUBMISSION_RETRY_WINDOW_HOURS = 48

# 2. Server-side clean-up of abandoned temporary data (DG-57, approved 2026-10-07): temporary
#    processing data (DG-55) with no activity for 72 hours is purged, the same way a cancellation
#    purges it. Activity is an upload chunk, an edit, a manifest update, a correction, a
#    confirmation, or the start or end of a processing job, and each restarts the 72 hours, so data
#    still arriving or being processed is never purged because of its age. A submitted report and
#    its sealed evidence are never purged. The environment may override the value; it must be a
#    positive number of hours.
PARAKH_TEMPORARY_DATA_TTL_HOURS = int(os.environ.get("PARAKH_TEMPORARY_DATA_TTL_HOURS") or 72)
if PARAKH_TEMPORARY_DATA_TTL_HOURS < 1:
    raise ImproperlyConfigured("PARAKH_TEMPORARY_DATA_TTL_HOURS must be a positive number of hours")

# Photo-count bounds (DG-47, Hassan Jalal, 2026-10-04): 1-3 live photos per report.
PARAKH_PHOTO_COUNT_MIN = int(os.environ.get("PARAKH_PHOTO_COUNT_MIN") or 1)
PARAKH_PHOTO_COUNT_MAX = int(os.environ.get("PARAKH_PHOTO_COUNT_MAX") or 3)
# Video (DG-54, Hassan Jalal, 2026-10-04): at most one live video of up to 60 seconds. The
# tolerance covers container rounding (audio priming); it is not a longer limit.
PARAKH_VIDEO_MAX_COUNT = 1
PARAKH_VIDEO_MAX_SECONDS = 60
PARAKH_VIDEO_DURATION_TOLERANCE_SECONDS = 0.5

# Technical upload safeguards — provisional and configurable, not product rules. Per-kind item
# sizes: the video bound matches the client's recording cap (720p H.264 + AAC, at most 40 MiB).
PARAKH_EVIDENCE = {
    "CHUNK_MAX_BYTES": 512 * 1024,
    "ITEM_MAX_BYTES": {
        "photo": 10 * 1024 * 1024,
        "voice_original": 20 * 1024 * 1024,
        "video": 40 * 1024 * 1024,
    },
    "MAX_ITEMS": int(os.environ.get("PARAKH_EVIDENCE_MAX_ITEMS") or 12),
}
if not 1 <= PARAKH_PHOTO_COUNT_MIN <= PARAKH_PHOTO_COUNT_MAX:
    raise ImproperlyConfigured("Photo-count bounds must satisfy 1 <= PARAKH_PHOTO_COUNT_MIN <= PARAKH_PHOTO_COUNT_MAX")
if PARAKH_EVIDENCE["MAX_ITEMS"] < PARAKH_PHOTO_COUNT_MAX + 1 + PARAKH_VIDEO_MAX_COUNT:
    raise ImproperlyConfigured(
        "PARAKH_EVIDENCE_MAX_ITEMS must hold the photo maximum plus one recording and one video"
    )

# Write-once evidence storage (DR-6). Only a local development store exists; production refuses to start.
PARAKH_EVIDENCE_STORAGE = os.environ.get("PARAKH_EVIDENCE_STORAGE") or (
    {"development": "parakh.drafts.storage.LocalStorage", "test": "parakh.drafts.storage.LocalStorage",
     "production": ""}[PARAKH_ENV]
)
if PARAKH_ENV == "test":
    import atexit
    import shutil
    import tempfile

    PARAKH_EVIDENCE_ROOT = Path(tempfile.mkdtemp(prefix="parakh-test-evidence-"))
    atexit.register(shutil.rmtree, PARAKH_EVIDENCE_ROOT, True)
else:
    PARAKH_EVIDENCE_ROOT = Path(os.environ.get("PARAKH_EVIDENCE_ROOT") or LOCAL_DIR / "evidence")

from parakh.drafts.storage import check_evidence_storage_configuration  # noqa: E402

check_evidence_storage_configuration(PARAKH_ENV, PARAKH_EVIDENCE_STORAGE)

# AI processing (DG-16: no provider; DG-48: the only adapter is SIMULATED and development/test only).
PARAKH_AI_BACKEND = os.environ.get("PARAKH_AI_BACKEND") or (
    {"development": "parakh.drafts.ai.SimulatedRenderingAdapter", "test": "parakh.drafts.ai.SimulatedRenderingAdapter",
     "production": ""}[PARAKH_ENV]
)
PARAKH_AI_RUNNER = "inline"  # a queue worker (Celery/Redis, T-023) replaces this
PARAKH_SIMULATED_AI_OUTCOME = os.environ.get("PARAKH_SIMULATED_AI_OUTCOME") or "complete"
if PARAKH_SIMULATED_AI_OUTCOME not in {"complete", "fail", "review_required"}:
    raise ImproperlyConfigured("PARAKH_SIMULATED_AI_OUTCOME must be complete, fail or review_required")
# Below this confidence a critical field is marked and gets a targeted question (FR-PUB.18). No source value exists.
PARAKH_LOW_CONFIDENCE_THRESHOLD = float(os.environ.get("PARAKH_LOW_CONFIDENCE_THRESHOLD") or 0.6)
if not 0 < PARAKH_LOW_CONFIDENCE_THRESHOLD <= 1:
    raise ImproperlyConfigured("PARAKH_LOW_CONFIDENCE_THRESHOLD must be greater than 0 and at most 1")

from parakh.drafts.ai import check_ai_configuration  # noqa: E402

check_ai_configuration(PARAKH_ENV, PARAKH_AI_BACKEND)

# --- Logging: nothing request-body-related is logged (NFR-58) --------------
# Every handler redacts credentials, idempotency keys, codes and numbers (T-030).
LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "filters": {"redact": {"()": "parakh.core.log_redaction.RedactSecretsFilter"}},
    "formatters": {
        "server": {"()": "django.utils.log.ServerFormatter", "format": "[{server_time}] {message}", "style": "{"}
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "filters": ["redact"]},
        "server": {"class": "logging.StreamHandler", "filters": ["redact"], "formatter": "server"},
    },
    "loggers": {
        "django.request": {"handlers": ["console"], "level": "ERROR", "propagate": False},
        "django.server": {"handlers": ["server"], "level": "INFO", "propagate": False},
        "parakh": {"handlers": ["console"], "level": "INFO" if DEBUG else "WARNING"},
    },
}

SECURE_CONTENT_TYPE_NOSNIFF = True
if PARAKH_ENV == "production":
    SECURE_SSL_REDIRECT = True
    SECURE_HSTS_SECONDS = 31536000
