"""Staff account state changes (Data Model §2.3; RBAC §3 row 32, §14.4; API-172 core).

Suspending or revoking an account ends every one of its sessions at once (TEST-RBAC-010).
The last account administrator cannot be suspended or revoked. Every change is audited.
The route, with its acting-role checks and step-up, arrives with the staff portals.
"""
from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from parakh.audit.models import record
from parakh.authentication.models import AuthSession
from parakh.authentication.tokens import revoke
from parakh.core.errors import ApiError

from .models import RoleAssignment, StaffAccount


def _is_account_admin(account_id, now) -> bool:
    return any(
        "CAP_ACCOUNT_ADMIN" in (a.granted_capabilities or []) and a.valid_at(now)
        for a in RoleAssignment.objects.filter(staff_account_id=account_id, role=RoleAssignment.Role.MAY)
    )


def other_account_admins(account_id, now) -> int:
    count = 0
    for account in StaffAccount.objects.filter(status=StaffAccount.Status.ACTIVE).exclude(id=account_id):
        if account.active_at(now) and _is_account_admin(account.id, now):
            count += 1
    return count


def end_sessions(account_id, reason: str) -> int:
    sessions = AuthSession.objects.filter(subject_type="staff", subject_id=account_id, revoked_at__isnull=True)
    ended = 0
    for session in sessions.select_related("refresh_family"):
        revoke(session, reason)
        ended += 1
    return ended


def change_account_status(account_id, new_status: str, *, by_account_id, reason: str) -> StaffAccount:
    """Suspends or revokes a staff account, ending its sessions; refuses to remove the last account admin."""
    if new_status not in (StaffAccount.Status.SUSPENDED, StaffAccount.Status.REVOKED):
        raise ApiError("E_VALIDATION", "Some information is missing or invalid.", 400, field="status")
    if not isinstance(reason, str) or not reason.strip():
        raise ApiError("E_VALIDATION", "Some information is missing or invalid.", 400, field="reason")
    now = timezone.now()
    with transaction.atomic():
        account = StaffAccount.objects.select_for_update().get(id=account_id)
        if account.status == StaffAccount.Status.REVOKED:
            raise ApiError("E_STALE_STATE", "This has changed since you last looked. Refreshing.", 409)
        if _is_account_admin(account.id, now) and other_account_admins(account.id, now) == 0:
            raise ApiError("E_LAST_ACCOUNT_ADMIN", "The last account administrator cannot be removed.", 409)
        previous = account.status
        account.status = new_status
        account.reason = reason
        field = "suspended_at" if new_status == StaffAccount.Status.SUSPENDED else "revoked_at"
        setattr(account, field, now)
        account.save(update_fields=["status", "reason", field])
        ended = end_sessions(account.id, f"account_{new_status.lower()}")
        record("account_suspended" if new_status == StaffAccount.Status.SUSPENDED else "account_revoked",
               actor_kind="staff", actor_account_id=by_account_id, staff_account_id=str(account.id),
               prev_status=previous, new_status=new_status, sessions_ended=ended)
    return account
