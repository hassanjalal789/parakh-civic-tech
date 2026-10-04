"""Append-only, hash-chained audit trail (NFR-56, NFR-86).

Application code can only append. Editing or deleting an event raises an
error, and `verify_chain()` detects any row changed behind the model's back.
The database-role restriction (INSERT/SELECT only) arrives with PostgreSQL
in T-028/T-029; on SQLite it is not enforceable.

No event may contain a phone number, OTP, password, token or rendering text.
"""
from __future__ import annotations

import hashlib
import json

from django.db import models, transaction


class AuditEvent(models.Model):
    sequence = models.BigAutoField(primary_key=True)
    prev_hash = models.CharField(max_length=64)
    hash = models.CharField(max_length=64, unique=True)
    actor_kind = models.CharField(max_length=24)  # citizen | staff | system
    actor_account_id = models.UUIDField(null=True, blank=True)
    action = models.CharField(max_length=64)
    details = models.JSONField(default=dict)
    created_at = models.DateTimeField()

    class Meta:
        ordering = ["sequence"]

    GENESIS = "0" * 64

    def compute_hash(self) -> str:
        payload = json.dumps(
            {
                "prev": self.prev_hash,
                "actor_kind": self.actor_kind,
                "actor": str(self.actor_account_id) if self.actor_account_id else None,
                "action": self.action,
                "details": self.details,
                "at": self.created_at.isoformat(),
            },
            sort_keys=True,
            separators=(",", ":"),
        )
        return hashlib.sha256(payload.encode()).hexdigest()

    def save(self, *args, **kwargs):
        if not self._state.adding:
            raise RuntimeError("AuditEvent is append-only; existing events cannot be modified")
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        raise RuntimeError("AuditEvent is append-only; events cannot be deleted")


FORBIDDEN_DETAIL_KEYS = {"phone", "phone_e164", "mobile", "code", "otp", "password", "token", "access_token", "refresh_token", "rendering"}


def record(action: str, *, actor_kind: str = "system", actor_account_id=None, **details) -> AuditEvent:
    from django.utils import timezone

    bad = FORBIDDEN_DETAIL_KEYS & set(details)
    if bad:
        raise ValueError(f"audit details must not contain {sorted(bad)}")
    with transaction.atomic():
        last = AuditEvent.objects.select_for_update().order_by("-sequence").first()
        event = AuditEvent(
            prev_hash=last.hash if last else AuditEvent.GENESIS,
            actor_kind=actor_kind,
            actor_account_id=actor_account_id,
            action=action,
            details=details,
            created_at=timezone.now(),
        )
        event.hash = event.compute_hash()
        event.save()
        return event


def verify_chain() -> tuple[bool, int | None]:
    """Return (ok, first_bad_sequence)."""
    prev = AuditEvent.GENESIS
    for event in AuditEvent.objects.order_by("sequence").iterator():
        if event.prev_hash != prev or event.compute_hash() != event.hash:
            return False, event.sequence
        prev = event.hash
    return True, None
