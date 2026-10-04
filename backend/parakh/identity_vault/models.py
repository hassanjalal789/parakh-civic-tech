"""Identity vault: the only place a citizen's mobile number exists (SRS §6.2.2).

- `phone_lookup_hmac` — HMAC(server key, E.164), UNIQUE; used for lookup.
- `phone_e164_encrypted` — authenticated encryption (Fernet); no index on it.
- `phone_masked_display` — the only form a human ever sees, and only its owner.

The account row (`accounts.CitizenAccount`) never holds the number. This app
is a module boundary: only `parakh.identity_vault.services` reads these rows.
The separate PostgreSQL schema and database role (NFR-45) are task T-028; on
SQLite this separation is a code boundary only.
"""
import uuid

from django.db import models


class CitizenPhoneCredential(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    citizen_account_id = models.UUIDField(unique=True)
    phone_e164_encrypted = models.TextField()
    phone_lookup_hmac = models.CharField(max_length=64, unique=True)
    phone_masked_display = models.CharField(max_length=32)
    verified_at = models.DateTimeField()
    previous_phone_lookup_hmac = models.CharField(max_length=64, blank=True, default="")
    changed_at = models.DateTimeField(null=True, blank=True)

    def __str__(self) -> str:  # never render the number
        return f"CitizenPhoneCredential({self.id})"
