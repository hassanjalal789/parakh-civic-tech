"""Redaction of credentials and personal data from log records (T-030, FR-COMMON.17).

Attached to every handler in ``settings.LOGGING``. It rewrites the formatted
message and any exception text before a handler sees them, so a credential
or number that reaches a log call by mistake is not written out.

This is a backstop, not permission: code still must not log request bodies,
headers, numbers, codes or tokens in the first place (API Contract §2.1).
"""
from __future__ import annotations

import logging
import re

REDACTED = "[REDACTED]"

# Request headers that carry a credential or a replay-sensitive key.
SENSITIVE_HEADERS = (
    "authorization",
    "cookie",
    "set-cookie",
    "x-idempotency-key",
    "x-confirmation-idempotency-key",
    "x-submission-idempotency-key",
)

_HEADER_NAMES = "|".join(re.escape(h) for h in SENSITIVE_HEADERS)
_META_NAMES = "|".join("HTTP_" + h.upper().replace("-", "_") for h in SENSITIVE_HEADERS if h != "set-cookie")

_PATTERNS: tuple[tuple[re.Pattern[str], str], ...] = (
    # "Authorization: Bearer x", "'x-idempotency-key': 'y'", "HTTP_AUTHORIZATION=z"
    (
        re.compile(
            rf"""(?ix)(["']?(?:{_HEADER_NAMES}|{_META_NAMES})["']?\s*[:=]\s*)(["']?)[^"'\r\n,}}]*"""
        ),
        rf"\1\2{REDACTED}",
    ),
    (re.compile(r"(?i)\bbearer\s+[A-Za-z0-9._~+/=-]+"), f"Bearer {REDACTED}"),
    # Token fields in JSON or key=value form, whatever their value.
    (
        re.compile(
            r"""(?ix)(["']?(?:access_token|refresh_token|token|password|idempotency_key)["']?\s*[:=]\s*)(["']?)[^"'\s,}&]+"""
        ),
        rf"\1\2{REDACTED}",
    ),
    # One-time codes. Only digits are redacted, so error codes such as E_OTP_INVALID stay readable.
    (re.compile(r"""(?ix)(["']?(?:code|otp)["']?\s*[:=]\s*)(["']?)\d{4,8}(?!\d)"""), rf"\1\2{REDACTED}"),
    # Pakistani mobile numbers, E.164 or national form. Masked forms ("+92 300 *** 4567") do not match.
    (re.compile(r"(?<![\d*])(?:\+|00)?92[\s-]?3\d{2}[\s-]?\d{7}(?!\d)"), "[REDACTED-NUMBER]"),
    (re.compile(r"(?<![\d*])03\d{2}[\s-]?\d{7}(?!\d)"), "[REDACTED-NUMBER]"),
)


def redact(text: str) -> str:
    for pattern, replacement in _PATTERNS:
        text = pattern.sub(replacement, text)
    return text


class RedactSecretsFilter(logging.Filter):
    """Rewrites a record's message and exception text. Never drops a record."""

    _formatter = logging.Formatter()

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            message = record.getMessage()
        except Exception:  # a malformed call must not hide the event
            message = str(record.msg)
        record.msg = redact(message)
        record.args = None
        if record.exc_info and not record.exc_text:
            record.exc_text = self._formatter.formatException(record.exc_info)
        if record.exc_text:
            record.exc_text = redact(record.exc_text)
        if record.stack_info:
            record.stack_info = redact(record.stack_info)
        return True
