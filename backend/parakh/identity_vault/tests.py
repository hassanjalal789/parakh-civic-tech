import uuid

from django.test import TestCase
from django.utils import timezone

from parakh.core.errors import ApiError

from . import services


class IdentityVaultTests(TestCase):
    def test_normalisation(self):
        for raw in ["03001234567", "0300-1234567", "+92 300 1234567", "923001234567", "00923001234567"]:
            self.assertEqual(services.normalise_pk_mobile(raw), "+923001234567", raw)
        for raw in ["3001234567x", "+9204235761234", "042 35761234", "+44 7700 900123", "0300123456"]:
            with self.assertRaises(ApiError, msg=raw):
                services.normalise_pk_mobile(raw)

    def test_number_is_encrypted_at_rest_and_found_by_hmac(self):
        account_id = uuid.uuid4()
        credential = services.create_credential("+923001234567", account_id, timezone.now())
        self.assertNotIn("3001234567", credential.phone_e164_encrypted)
        self.assertNotIn("3001234567", credential.phone_lookup_hmac)
        self.assertEqual(services._fernet().decrypt(credential.phone_e164_encrypted.encode()).decode(), "+923001234567")
        self.assertEqual(services.find_credential("+923001234567").id, credential.id)
        self.assertEqual(services.masked_number_for(account_id), "+92 300 *** 4567")
        self.assertNotIn("3001234567", str(credential))
