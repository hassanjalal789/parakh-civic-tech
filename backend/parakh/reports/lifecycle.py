"""The CivicReport state machine (Mobile SRS v2.3.0 §6.2.8; RBAC §9.2–§9.3).

Hassan Jalal's decision of 2026-10-04 (DG-56): the Street Representative
verifies a submitted report first; the UC Officer then reviews and accepts it
before contractor assignment or any later stage. No verification stage is
skipped. Only the transitions listed here exist; everything else — including
every "prohibited transition" of §6.2.8 — is refused.

This module is the only place a report's state changes. The staff routes that
call it arrive with the portal tasks (T-093…T-097); creation in SUBMITTED is
API-140's transaction, not a transition.

Actor keys: "system" (a server-driven step), "REP" (Street Representative),
"UCO" (UC Officer), "CON" (Contractor), "MAY" (Mayor & Operations),
"citizen" (the reporter).
"""
from __future__ import annotations

from django.db import transaction
from django.utils import timezone

from parakh.audit.models import record
from parakh.core.errors import ApiError

from .models import CivicReport, ReportTimelineEntry, StateChange

S = CivicReport.State
STAFF_ROLES = frozenset({"REP", "UCO", "CON", "MAY"})

TRANSITIONS: dict[tuple[str, str], frozenset[str]] = {
    (S.SUBMITTED, S.UNDER_VERIFICATION): frozenset({"system"}),  # T2: a conflict-free Street Representative
    (S.UNDER_VERIFICATION, S.VERIFIED): frozenset({"REP"}),  # T3
    # Verification failed, the site was inaccessible, or a duplicate is suspected: the Street
    # Representative's outcome still goes to the UC Officer — the stage is not skipped.
    (S.UNDER_VERIFICATION, S.UC_REVIEW): frozenset({"REP"}),
    (S.VERIFIED, S.UC_REVIEW): frozenset({"system"}),  # T4
    (S.UC_REVIEW, S.ACCEPTED): frozenset({"UCO"}),  # T5
    (S.UC_REVIEW, S.REJECTED): frozenset({"UCO"}),  # coded reason, step-up
    (S.ACCEPTED, S.CONTRACTOR_ASSIGNED): frozenset({"UCO"}),  # T6: step-up, eligibility
    (S.CONTRACTOR_ASSIGNED, S.IN_PROGRESS): frozenset({"CON"}),  # T7
    (S.CONTRACTOR_ASSIGNED, S.ACCEPTED): frozenset({"CON", "system"}),  # decline, or the response window lapses
    (S.IN_PROGRESS, S.COMPLETION_SUBMITTED): frozenset({"CON"}),  # T8: completion evidence
    (S.COMPLETION_SUBMITTED, S.COMPLETION_VERIFICATION): frozenset({"system"}),  # T9: a conflict-free REP
    (S.COMPLETION_VERIFICATION, S.PENDING_CITIZEN_CONFIRMATION): frozenset({"REP"}),  # T10
    (S.COMPLETION_VERIFICATION, S.IN_PROGRESS): frozenset({"REP"}),  # completion rejected
    (S.PENDING_CITIZEN_CONFIRMATION, S.RESOLVED_CONFIRMED): frozenset({"citizen"}),  # T11
    (S.PENDING_CITIZEN_CONFIRMATION, S.REOPENED): frozenset({"citizen"}),  # dispute
    # Rework or reassign, a separate, separately audited UC Officer decision (RBAC §9.3): back to the
    # same contractor's work, or back to ACCEPTED for a new assignment (with its step-up and eligibility).
    # (Until 2026-10-11 this read REOPENED → CONTRACTOR_ASSIGNED, from SRS §6.2.8's "rework / reassign".)
    (S.REOPENED, S.IN_PROGRESS): frozenset({"UCO"}),
    (S.REOPENED, S.ACCEPTED): frozenset({"UCO"}),
    (S.RESOLVED_CONFIRMED, S.CLOSED): frozenset({"UCO"}),  # T12: UC Officer only
    (S.CLOSED, S.REOPENED): frozenset({"UCO", "MAY"}),
    (S.UC_REVIEW, S.CANCELLED): frozenset({"UCO"}),  # defined conditions only
    (S.ACCEPTED, S.CANCELLED): frozenset({"UCO"}),
    (S.REOPENED, S.CANCELLED): frozenset({"UCO"}),
}


def allowed(from_state: str, to_state: str, actor: str) -> bool:
    return actor in TRANSITIONS.get((from_state, to_state), frozenset())


def transition(report_id, to_state: str, *, actor: str, expected_state_version: int, actor_account_id=None,
               reason: str = "", event: str = "report_state_changed", acting_role_assignment_id=None,
               note: str = "") -> CivicReport:
    return apply(report_id, to_state, actor=actor, expected_state_version=expected_state_version,
                 actor_account_id=actor_account_id, reason=reason, event=event,
                 acting_role_assignment_id=acting_role_assignment_id, note=note)[0]


def apply(report_id, to_state: str, *, actor: str, expected_state_version: int, actor_account_id=None,
          reason: str = "", event: str = "report_state_changed", acting_role_assignment_id=None,
          note: str = "") -> tuple[CivicReport, bool]:
    """Moves one report one step. Guarded by state_version (E_STALE_STATE) and the table above.

    Idempotent under retry (RBAC §9.2): the same step by the same account from the same version
    returns the report with `applied = False` and changes nothing. `event` is the audit event the
    RBAC matrix names. `reason` is a code or a short label; a person's free text (`note`) is kept on
    the StateChange record, never in the audit trail. Returns (report, applied).
    """
    with transaction.atomic():
        report = CivicReport.objects.select_for_update().get(id=report_id)
        if report.state_version != expected_state_version:
            done = StateChange.objects.filter(report=report, from_state_version=expected_state_version).first()
            if done is not None and done.to_state == to_state and done.actor == actor and (
                str(done.actor_account_id or "") == str(actor_account_id or "")
            ):
                return report, False  # a retry of the step already taken
            raise ApiError("E_STALE_STATE", "This has changed since you last looked. Refreshing.", 409)
        if (report.state, to_state) not in TRANSITIONS:
            raise ApiError("E_TRANSITION_NOT_ALLOWED", "This step is not possible from the report's current state.",
                           409, state=report.state)
        if not allowed(report.state, to_state, actor):
            raise ApiError("E_FORBIDDEN", "This action is not available.", 403)
        previous = report.state
        report.state = to_state
        report.state_version += 1
        report.save(update_fields=["state", "state_version"])
        now = timezone.now()
        ReportTimelineEntry.objects.create(report=report, state=to_state, occurred_at=now)
        StateChange.objects.create(
            report=report, from_state=previous, to_state=to_state, from_state_version=expected_state_version,
            actor=actor, actor_account_id=actor_account_id, acting_role_assignment_id=acting_role_assignment_id,
            note=note, created_at=now,
        )
        staff = actor in STAFF_ROLES
        details = dict(report_id=str(report.id), prev_state=previous, new_state=to_state, reason=reason)
        if staff:
            details.update(role=actor, acting_role_assignment_id=str(acting_role_assignment_id or ""))
        record(event, actor_kind="staff" if staff else actor, actor_account_id=actor_account_id, **details)
    return report, True
