"""T-030: credentials, idempotency keys, codes and numbers never reach a log line."""
import io
import logging

from django.test import SimpleTestCase

from .log_redaction import REDACTED, RedactSecretsFilter, redact

SECRETS = [
    "synthetic-access-token-7Qx",
    "synthetic-refresh-token-9Lp",
    "3f1c9a52-0b7e-4d0a-9d1e-5b2f6c7a8e90",
    "246810",
    "+923001234567",
    "0300 1234567",
    "03001234567",
]


def _emit(logger_name: str, *args, exc: BaseException | None = None) -> str:
    """Log through the handler that settings.LOGGING attached, with its own filters."""
    logger = logging.getLogger(logger_name)
    handler = logger.handlers[0]
    stream = io.StringIO()
    old = handler.setStream(stream)
    try:
        if exc is None:
            logger.error(*args)
        else:
            try:
                raise exc
            except type(exc):
                logger.exception(*args)
    finally:
        handler.setStream(old)
    return stream.getvalue()


class RedactionTests(SimpleTestCase):
    def test_every_configured_handler_carries_the_filter(self):
        for name in ["parakh", "django.request", "django.server"]:
            for handler in logging.getLogger(name).handlers:
                self.assertTrue(
                    any(isinstance(f, RedactSecretsFilter) for f in handler.filters), f"{name}: {handler}"
                )

    def test_headers_tokens_codes_and_numbers_are_redacted(self):
        line = _emit(
            "parakh",
            "Authorization: Bearer %s | X-Idempotency-Key: %s | {'refresh_token': '%s', 'code': '%s'} | %s %s %s",
            "synthetic-access-token-7Qx",
            "3f1c9a52-0b7e-4d0a-9d1e-5b2f6c7a8e90",
            "synthetic-refresh-token-9Lp",
            "246810",
            "+923001234567",
            "0300 1234567",
            "03001234567",
        )
        for secret in SECRETS:
            self.assertNotIn(secret, line)
        self.assertIn(REDACTED, line)
        self.assertIn("[REDACTED-NUMBER]", line)

    def test_request_meta_and_both_idempotency_headers_are_redacted(self):
        text = redact(
            "{'HTTP_AUTHORIZATION': 'Bearer abc.def', 'HTTP_X_CONFIRMATION_IDEMPOTENCY_KEY': 'k-1', "
            "'HTTP_X_SUBMISSION_IDEMPOTENCY_KEY': 'k-2', 'HTTP_COOKIE': 'sessionid=s'}"
        )
        for secret in ["abc.def", "k-1", "k-2", "sessionid=s"]:
            self.assertNotIn(secret, text)

    def test_exception_text_is_redacted(self):
        error = ValueError("bad token=synthetic-access-token-7Qx +923001234567")
        line = _emit("django.request", "Internal Server Error: /x", exc=error)
        self.assertIn("ValueError", line)
        self.assertNotIn("synthetic-access-token-7Qx", line)
        self.assertNotIn("+923001234567", line)

    def test_masked_numbers_error_codes_and_ordinary_text_survive(self):
        text = 'Sent to +92 300 *** 4567; {"code": "E_OTP_INVALID"}; report in UC_REVIEW; 3 attempts remaining'
        self.assertEqual(redact(text), text)

    def test_a_malformed_log_call_is_still_written(self):
        line = _emit("parakh", "two args %s %s", "only-one")
        self.assertIn("two args", line)
