"""Keyed hashing helpers. Plain hashes of phone numbers are reversible by
enumeration, so every lookup value is an HMAC under a server key."""
from __future__ import annotations

import hashlib
import hmac
import secrets

from django.conf import settings


def hmac_hex(key: str, value: str) -> str:
    return hmac.new(key.encode(), value.encode(), hashlib.sha256).hexdigest()


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def new_token() -> str:
    return secrets.token_urlsafe(32)


def lookup_hmac(value: str) -> str:
    """HMAC used for IP and device rate-limit keys (never stored in clear)."""
    return hmac_hex(settings.PARAKH_PHONE_HMAC_KEY, "aux:" + value)
