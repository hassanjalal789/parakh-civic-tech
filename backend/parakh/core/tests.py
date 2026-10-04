import os
import subprocess
import sys
from pathlib import Path

from cryptography.fernet import Fernet
from django.test import SimpleTestCase

BACKEND = Path(__file__).resolve().parents[2]


def _start(env_overrides: dict) -> subprocess.CompletedProcess:
    """Start Django in a fresh process with only the given PARAKH/DJANGO variables."""
    env = {k: v for k, v in os.environ.items() if not k.startswith(("PARAKH_", "DJANGO_"))}
    env.update({"DJANGO_SETTINGS_MODULE": "config.settings", **env_overrides})
    return subprocess.run(
        [sys.executable, "-c", "import django; django.setup(); print('started')"],
        cwd=BACKEND, env=env, capture_output=True, text=True, timeout=60,
    )


PRODUCTION_KEYS = {
    "PARAKH_ENV": "production",
    "DJANGO_SECRET_KEY": "x" * 50,
    "PARAKH_PHONE_HMAC_KEY": "y" * 32,
    "PARAKH_PHONE_ENC_KEY": Fernet.generate_key().decode(),  # throwaway, generated per run
    "PARAKH_OTP_HASH_KEY": "z" * 32,
    "PARAKH_DB_ENGINE": "postgresql",
    "PARAKH_DB_NAME": "parakh",
    "PARAKH_DB_USER": "parakh",
}


class HealthTests(SimpleTestCase):
    def test_health_is_public(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})


class ProductionStartupTests(SimpleTestCase):
    def test_production_refuses_to_start_without_keys(self):
        result = _start({"PARAKH_ENV": "production"})
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("must be set in production", result.stderr)

    def test_production_refuses_the_development_sms_adapter(self):
        result = _start({**PRODUCTION_KEYS, "PARAKH_SMS_BACKEND": "parakh.authentication.sms.DevelopmentConsoleSmsSender"})
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Production requires a real SMS backend", result.stderr)

    def test_production_refuses_a_missing_sms_backend(self):
        result = _start(PRODUCTION_KEYS)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Production requires a real SMS backend", result.stderr)

    def test_production_refuses_sqlite(self):
        keys = {k: v for k, v in PRODUCTION_KEYS.items() if not k.startswith("PARAKH_DB_")}
        result = _start(keys)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn("Production requires PARAKH_DB_ENGINE=postgresql", result.stderr)

    def test_production_refuses_the_test_outbox_and_an_empty_sms_backend(self):
        for backend in ["parakh.authentication.sms.TestOutboxSmsSender", ""]:
            result = _start({**PRODUCTION_KEYS, "PARAKH_SMS_BACKEND": backend})
            self.assertNotEqual(result.returncode, 0, backend)
            self.assertIn("Production requires a real SMS backend", result.stderr)

    def test_production_refuses_a_missing_or_local_evidence_store(self):
        base = {**PRODUCTION_KEYS, "PARAKH_SMS_BACKEND": "provider.module.SmsSender"}
        for store in [None, "", "parakh.drafts.storage.LocalStorage"]:
            env = base if store is None else {**base, "PARAKH_EVIDENCE_STORAGE": store}
            result = _start(env)
            self.assertNotEqual(result.returncode, 0, store)
            self.assertIn("Production needs a write-once object store for evidence", result.stderr)

    def test_production_refuses_a_missing_or_simulated_ai_adapter(self):
        base = {**PRODUCTION_KEYS, "PARAKH_SMS_BACKEND": "provider.module.SmsSender",
                "PARAKH_EVIDENCE_STORAGE": "provider.module.ObjectStore"}
        for adapter in [None, "parakh.drafts.ai.SimulatedRenderingAdapter"]:
            env = base if adapter is None else {**base, "PARAKH_AI_BACKEND": adapter}
            result = _start(env)
            self.assertNotEqual(result.returncode, 0, adapter)
            self.assertIn("Production needs a real AI provider", result.stderr)

    def test_with_every_adapter_named_only_the_missing_postgresql_driver_stops_start_up(self):
        # Proves the adapter checks pass when real adapters are named. PostgreSQL's
        # driver is not installed on the development Mac yet (T-023).
        result = _start({**PRODUCTION_KEYS, "PARAKH_SMS_BACKEND": "provider.module.SmsSender",
                         "PARAKH_EVIDENCE_STORAGE": "provider.module.ObjectStore",
                         "PARAKH_AI_BACKEND": "provider.module.Renderer"})
        for refusal in ["real SMS backend", "write-once object store", "real AI provider"]:
            self.assertNotIn(refusal, result.stderr)
        if result.returncode != 0:
            self.assertIn("psycopg", result.stderr)
