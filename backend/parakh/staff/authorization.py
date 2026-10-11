"""The six acting-role checks on every privileged staff request (API Contract §3.3, §4; RBAC §7).

In the order of API Contract §4 and RBAC §7, denying on the first failure:

1. the claimed acting assignment is the session's selected one and belongs to the account;
2. it is ACTIVE and unexpired — and so is the account, and a contractor's organisation —
   evaluated now, at the point of action;
3. its role may perform this action, with any explicitly granted capability it needs;
4. its scope covers the record (otherwise the uniform 404, so no route is an oracle);
5. the acting **account** is not excluded from the record (RBAC §8);
6. a fresh OTP within the last 10 minutes where the action needs step-up (RBAC §5).

RBAC §14.5 lists the same checks with the capability last; the contract's order is used,
and both orders deny exactly the same requests. Capabilities are never unioned across
assignments: only the acting assignment counts.
"""
from __future__ import annotations

from datetime import timedelta

from django.utils import timezone

from parakh.audit.models import record
from parakh.core.errors import ApiError

from .models import ConflictExclusion, RoleAssignment, scope_contains
from .rbac import ACTIONS

STEP_UP_WINDOW = timedelta(minutes=10)  # RBAC §5


def role_assignment_invalid() -> ApiError:
    return ApiError("E_ROLE_ASSIGNMENT_INVALID", "Your role has changed. Please sign in again.", 403)


def forbidden() -> ApiError:
    return ApiError("E_FORBIDDEN", "This action is not available.", 403)


def conflict_excluded() -> ApiError:
    return ApiError("E_CONFLICT_EXCLUDED", "You reported this issue, so you cannot act on it.", 403)


def step_up_required() -> ApiError:
    return ApiError("E_STEP_UP_REQUIRED", "Please confirm the code we just sent you.", 401)


def not_found() -> ApiError:
    return ApiError("E_NOT_FOUND", "Not found.", 404)


def assigned_organization_id(report):
    """The contractor organisation the report is currently assigned to, if any."""
    from parakh.reports.models import CaseAssignment

    current = (
        CaseAssignment.objects.filter(report_id=report.id, status__in=CaseAssignment.CURRENT)
        .order_by("-assigned_at")
        .values_list("contractor_organization_id", flat=True)
        .first()
    )
    return current


def is_excluded(account_id, report) -> bool:
    """RBAC §8: the official reporter's account, and any recorded exclusion, at account level."""
    if report.official_reporter_account_id is not None and report.official_reporter_account_id == account_id:
        return True
    return ConflictExclusion.objects.filter(report_id=report.id, excluded_staff_account_id=account_id).exists()


def authorize(principal, session, claimed_assignment_id, action_key: str, report=None, now=None) -> RoleAssignment:
    """Returns the acting assignment, or raises the first failing check's error."""
    now = now or timezone.now()
    action = ACTIONS.get(action_key)
    if action is None:
        raise forbidden()  # deny by default

    # 1. The claim names the session's own selected assignment, held by this account.
    if getattr(principal, "subject_type", None) != "staff" or session is None:
        raise role_assignment_invalid()
    assignment = None
    if claimed_assignment_id and str(claimed_assignment_id) == str(session.acting_role_assignment_id or ""):
        assignment = (
            RoleAssignment.objects.select_related("staff_account", "organization")
            .filter(id=session.acting_role_assignment_id)
            .first()
        )
    if assignment is None or assignment.staff_account_id != principal.subject_id:
        if claimed_assignment_id and RoleAssignment.objects.filter(id=_uuid_or_none(claimed_assignment_id)).exclude(
            staff_account_id=principal.subject_id
        ).exists():
            record("unauthorised_access_attempt", actor_kind="staff", actor_account_id=principal.subject_id,
                   attempted_action=action_key)
        raise role_assignment_invalid()

    # 2. Active and unexpired, now: the assignment, the account, and a contractor's organisation.
    account = assignment.staff_account
    if not assignment.valid_at(now) or not account.active_at(now):
        raise role_assignment_invalid()
    if assignment.role == RoleAssignment.Role.CON and (
        account.organization_id != assignment.organization_id or not assignment.organization.approved_at_time(now)
    ):
        raise role_assignment_invalid()

    # 3. The role may perform this action (and holds any explicit grant it needs).
    if assignment.role not in action.roles:
        raise forbidden()
    if action.explicit and action.explicit not in (assignment.granted_capabilities or []):
        raise forbidden()

    # 4. Scope covers the record; outside it, the record does not exist for this actor.
    if report is not None:
        if action.scope == "geo" and not scope_contains(assignment.scope_id, report.uc_scope_id):
            raise not_found()
        if action.scope == "org" and assigned_organization_id(report) != assignment.organization_id:
            raise not_found()

    # 5. The acting account is not excluded, whichever role it acts in.
    if action.conflict and report is not None and is_excluded(account.id, report):
        raise conflict_excluded()

    # 6. Step-up: a fresh OTP within the window (the login OTP counts).
    if action.step_up:
        recent = max((t for t in (session.mfa_satisfied_at, session.step_up_satisfied_at) if t), default=None)
        if recent is None or now - recent > STEP_UP_WINDOW:
            raise step_up_required()
    return assignment


def _uuid_or_none(value):
    import uuid

    try:
        return uuid.UUID(str(value))
    except ValueError:
        return None
