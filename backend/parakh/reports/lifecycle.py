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

from .models import CivicReport, ReportTimelineEntry

S = CivicReport.State

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
    # "rework / reassign (UCO, separately audited)" — read as back to work, or to a new assignment.
    (S.REOPENED, S.IN_PROGRESS): frozenset({"UCO"}),
    (S.REOPENED, S.CONTRACTOR_ASSIGNED): frozenset({"UCO"}),
    (S.RESOLVED_CONFIRMED, S.CLOSED): frozenset({"UCO"}),  # T12: UC Officer only
    (S.CLOSED, S.REOPENED): frozenset({"UCO", "MAY"}),
    (S.UC_REVIEW, S.CANCELLED): frozenset({"UCO"}),  # defined conditions only
    (S.ACCEPTED, S.CANCELLED): frozenset({"UCO"}),
    (S.REOPENED, S.CANCELLED): frozenset({"UCO"}),
}


def allowed(from_state: str, to_state: str, actor: str) -> bool:
    return actor in TRANSITIONS.get((from_state, to_state), frozenset())


def transition(report_id, to_state: str, *, actor: str, expected_state_version: int, actor_account_id=None,
               reason: str = "") -> CivicReport:
    """Moves one report one step. Guarded by state_version (E_STALE_STATE) and the table above."""
    with transaction.atomic():
        report = CivicReport.objects.select_for_update().get(id=report_id)
        if report.state_version != expected_state_version:
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
        record("report_state_changed", actor_kind=actor, actor_account_id=actor_account_id,
               report_id=str(report.id), prev_state=previous, new_state=to_state, reason=reason)
    return report
