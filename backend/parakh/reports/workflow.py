"""Staff steps on a report (RBAC §3, §9–§10; API Contract §8.2; FR-PORTAL.5–.18; DG-56).

Every step runs, in one transaction: the six acting-role checks (parakh.staff.authorization)
→ the state machine (the state_version seen, an allowed transition) → the step's own record →
its named audit event. A retry of a step already taken returns the result and changes nothing.
A person's free text (a reason, a note) stays on the step's record, never in the audit trail.

Not here, because the sources leave them undecided (see docs/planning/DECISIONS_AND_GAPS.md):
the coded rejection reasons, the contractor's allowed decline reasons and response window,
the defined cancellation conditions, what "escalate" does, appeal filing, and how a report gets
its Union Council (uc_scope_id) for automatic routing (T2).
"""
from __future__ import annotations

import uuid

from django.db import transaction
from django.utils import timezone

from parakh.audit.models import record
from parakh.core.errors import ApiError
from parakh.drafts.models import EvidenceObject
from parakh.drafts.services import MAX_TYPED_DESCRIPTION, invalid, not_found, stale
from parakh.staff.authorization import authorize, conflict_excluded, is_excluded
from parakh.staff.models import ContractorOrganization, RoleAssignment, scope_contains

from . import lifecycle
from .models import CaseAssignment, CivicReport, CompletionEvidence, ContractorProgress, Dispute, Verification

S = CivicReport.State


# --- request parsing --------------------------------------------------------------------------
def _version(body) -> int:
    version = body.get("state_version")
    if isinstance(version, bool) or not isinstance(version, int) or version < 1:
        raise invalid("state_version")
    return version


def _text(body, field: str, required: bool) -> str:
    """A person's words, kept exactly as written (DG-76), bounded like typed report text."""
    value = body.get(field, "")
    if value is None:
        value = ""
    if not isinstance(value, str) or len(value) > MAX_TYPED_DESCRIPTION or (required and not value.strip()):
        raise invalid(field)
    return value


def _body(body) -> dict:
    if not isinstance(body, dict):
        raise invalid("body")
    return body


def _report(report_id) -> CivicReport:
    try:
        rid = uuid.UUID(str(report_id))
    except ValueError:
        raise not_found() from None
    report = CivicReport.objects.filter(id=rid).first()
    if report is None:
        raise not_found()
    return report


def _evidence(body, report: CivicReport, account_id, required: bool) -> list[str]:
    """Evidence this account captured for this report, sealed (write-once), photo or video."""
    raw = body.get("evidence_ids", [])
    if not isinstance(raw, list) or len(raw) > 10 or (required and not raw):
        raise invalid("evidence_ids")
    try:
        ids = list(dict.fromkeys(uuid.UUID(str(x)) for x in raw))
    except ValueError:
        raise invalid("evidence_ids") from None
    found = EvidenceObject.objects.filter(
        id__in=ids, report_id=report.id, submission__isnull=True, uploaded_by_kind="staff",
        uploaded_by_account_id=account_id, sealed_at__isnull=False, deleted_at__isnull=True,
        kind__in=[EvidenceObject.Kind.PHOTO, EvidenceObject.Kind.VIDEO],
    ).count()
    if found != len(ids):
        raise invalid("evidence_ids")
    return [str(x) for x in ids]


def _step(principal, session, claim, report_id, action: str, body):
    body = _body(body)
    report = _report(report_id)
    assignment = authorize(principal, session, claim, action, report)
    return body, report, assignment


def _move(report, to_state, assignment, version, event, reason="", note=""):
    return lifecycle.apply(
        report.id, to_state, actor=assignment.role, expected_state_version=version,
        actor_account_id=assignment.staff_account_id, acting_role_assignment_id=assignment.id,
        event=event, reason=reason, note=note,
    )


def _system(report, to_state, event):
    """A server-driven step (T4, T9), taken at once in the same transaction."""
    return lifecycle.apply(report.id, to_state, actor="system", expected_state_version=report.state_version,
                           event=event)[0]


def _require_state(report, version, *states):
    if report.state not in states or report.state_version != version:
        raise stale()


# --- routing helpers --------------------------------------------------------------------------
def eligible_representatives(report: CivicReport, excluding=()) -> list[RoleAssignment]:
    """Street Representatives able to act on the report now: valid, in scope, not excluded."""
    now = timezone.now()
    eligible = []
    for assignment in RoleAssignment.objects.select_related("staff_account").filter(
        role=RoleAssignment.Role.REP, status=RoleAssignment.Status.ACTIVE
    ):
        account_id = assignment.staff_account_id
        if (
            assignment.valid_at(now)
            and assignment.staff_account.active_at(now)
            and scope_contains(assignment.scope_id, report.uc_scope_id)
            and account_id not in excluding
            and not is_excluded(account_id, report)
        ):
            eligible.append(assignment)
    return eligible


def _hold_unresolvable(report: CivicReport, needed: str):
    """RBAC §8, §9.3: no eligible actor — flagged and held; never auto-approved, never routed back."""
    record("case_unresolvable", actor_kind="system", report_id=str(report.id), state=report.state, needed=needed)


# --- T3 and its alternatives: field verification (API-160; FR-PORTAL.5) ---------------------------
FIELD_OUTCOMES = {
    "verified": (S.VERIFIED, "field_verified"),
    "not_verified": (S.UC_REVIEW, "field_verification_failed"),
    "location_inaccessible": (S.UC_REVIEW, "location_inaccessible"),
    "duplicate_suspected": (S.UC_REVIEW, "duplicate_suspected"),
}


def field_verification(principal, session, claim, report_id, body):
    body, report, assignment = _step(principal, session, claim, report_id, "field_verify", body)
    version = _version(body)
    outcome = body.get("outcome")
    if outcome not in FIELD_OUTCOMES:
        raise invalid("outcome")  # "needs clarification" is the clarification route, not an outcome here
    reason = _text(body, "reason", required=True)
    linked = None
    if outcome == "duplicate_suspected":  # flagged, never silently deleted; the original is named
        reference = body.get("linked_report_reference")
        original = CivicReport.objects.filter(report_reference=reference).exclude(id=report.id).first() \
            if isinstance(reference, str) else None
        if original is None or not scope_contains(assignment.scope_id, original.uc_scope_id):
            raise invalid("linked_report_reference")
        linked = original.id
    evidence = _evidence(body, report, assignment.staff_account_id, required=False)
    to_state, event = FIELD_OUTCOMES[outcome]
    with transaction.atomic():
        report, applied = _move(report, to_state, assignment, version, event, reason=outcome)
        if applied:
            Verification.objects.create(
                report=report, verification_kind=Verification.Kind.FIELD,
                verified_by_account_id=assignment.staff_account_id, role_assignment_id=assignment.id,
                outcome=outcome, note=reason, evidence_ids=evidence, linked_report_id=linked,
                created_at=timezone.now(),
            )
            if report.state == S.VERIFIED:
                report = _system(report, S.UC_REVIEW, "case_queued_for_review")  # T4
    return report


# --- T5: accept (API-161; FR-PORTAL.8) ---------------------------------------------------------
def accept(principal, session, claim, report_id, body):
    body, report, assignment = _step(principal, session, claim, report_id, "accept", body)
    version = _version(body)
    note = _text(body, "note", required=False)
    return _move(report, S.ACCEPTED, assignment, version, "case_accepted", note=note)[0]


# --- T6: assign a contractor (API-163; FR-PORTAL.11; RBAC §10) -----------------------------------
def organisation_eligible(org: ContractorOrganization, report: CivicReport, now) -> bool:
    """All five checks of RBAC §10, at the point of action. No selection, ranking or score (BR-020)."""
    if not org.approved_at_time(now) or report.category not in (org.approved_categories or []):
        return False
    if not any(scope_contains(area_id, report.uc_scope_id) for area_id in org.service_areas.values_list("id", flat=True)):
        return False
    return any(
        a.valid_at(now) and a.staff_account.active_at(now) and a.staff_account.organization_id == org.id
        for a in RoleAssignment.objects.select_related("staff_account").filter(
            role=RoleAssignment.Role.CON, organization=org, status=RoleAssignment.Status.ACTIVE
        )
    )


def eligible_organisations(principal, session, claim, report_id) -> list[ContractorOrganization]:
    """The contractor picker: only eligible organisations, in name order — never ranked or recommended."""
    report = _report(report_id)
    authorize(principal, session, claim, "assign", report)
    now = timezone.now()
    return [org for org in ContractorOrganization.objects.order_by("legal_name") if organisation_eligible(org, report, now)]


def assign(principal, session, claim, report_id, body):
    body, report, assignment = _step(principal, session, claim, report_id, "assign", body)
    version = _version(body)
    note = _text(body, "note", required=False)
    try:
        org = ContractorOrganization.objects.get(id=uuid.UUID(str(body.get("contractor_organization_id"))))
    except (ValueError, ContractorOrganization.DoesNotExist):
        raise invalid("contractor_organization_id") from None
    with transaction.atomic():
        if not organisation_eligible(org, report, timezone.now()):  # re-checked on submit, regardless
            raise invalid("contractor_organization_id")
        report, applied = _move(report, S.CONTRACTOR_ASSIGNED, assignment, version, "contractor_assigned", note=note)
        if applied:
            CaseAssignment.objects.create(
                report=report, contractor_organization=org, assigned_by_account_id=assignment.staff_account_id,
                assigned_by_role_assignment_id=assignment.id, note=note, assigned_at=timezone.now(),
            )
    return report


# --- T7: the contractor accepts the work (API-164; FR-PORTAL.12) ---------------------------------
def current_assignment(report) -> CaseAssignment | None:
    return CaseAssignment.objects.filter(report=report, status__in=CaseAssignment.CURRENT).order_by("-assigned_at").first()


def work_accept(principal, session, claim, report_id, body):
    body, report, assignment = _step(principal, session, claim, report_id, "work_respond", body)
    version = _version(body)
    with transaction.atomic():
        case = current_assignment(report)
        if case is None or case.status != CaseAssignment.Status.OFFERED:
            raise stale()
        if not organisation_eligible(case.contractor_organization, report, timezone.now()):  # at acceptance too
            raise ApiError("E_CONTRACTOR_INELIGIBLE", "This work can no longer be accepted.", 409)
        report, applied = _move(report, S.IN_PROGRESS, assignment, version, "work_accepted")
        if applied:
            case.status, case.accepted_at = CaseAssignment.Status.ACCEPTED, timezone.now()
            case.save(update_fields=["status", "accepted_at"])
    return report


# --- progress (API-165; FR-PORTAL.13) ----------------------------------------------------------
def progress(principal, session, claim, report_id, body):
    body, report, assignment = _step(principal, session, claim, report_id, "work_progress", body)
    if report.state != S.IN_PROGRESS:
        raise stale()
    note = _text(body, "note", required=False)
    percent = body.get("percent")
    if percent is not None and (isinstance(percent, bool) or not isinstance(percent, int) or not 0 <= percent <= 100):
        raise invalid("percent")
    evidence = _evidence(body, report, assignment.staff_account_id, required=False)
    if not note.strip() and percent is None and not evidence:
        raise invalid("note")
    with transaction.atomic():
        entry = ContractorProgress.objects.create(
            report=report, submitted_by_account_id=assignment.staff_account_id, role_assignment_id=assignment.id,
            note=note, percent=percent, evidence_ids=evidence, created_at=timezone.now(),
        )
        record("progress_updated", actor_kind="staff", actor_account_id=assignment.staff_account_id,
               report_id=str(report.id), acting_role_assignment_id=str(assignment.id), progress_id=str(entry.id))
    return report


# --- T8 then T9: completion, routed to a conflict-free Representative (API-166; FR-PORTAL.14) -----------
def complete(principal, session, claim, report_id, body):
    body, report, assignment = _step(principal, session, claim, report_id, "work_complete", body)
    version = _version(body)
    note = _text(body, "note", required=True)
    evidence = _evidence(body, report, assignment.staff_account_id, required=True)  # T8: required
    with transaction.atomic():
        report, applied = _move(report, S.COMPLETION_SUBMITTED, assignment, version, "completion_submitted")
        if applied:
            CompletionEvidence.objects.create(
                report=report, submitted_by_account_id=assignment.staff_account_id,
                role_assignment_id=assignment.id, evidence_ids=evidence, note=note, submitted_at=timezone.now(),
            )
            report = route_completion(report)
    return report


def route_completion(report: CivicReport) -> CivicReport:
    """T9: to completion verification when a Representative other than the completer can act; else held."""
    if report.state != S.COMPLETION_SUBMITTED:
        return report
    completers = set(CompletionEvidence.objects.filter(report=report).values_list("submitted_by_account_id", flat=True))
    if eligible_representatives(report, excluding=completers):
        return _system(report, S.COMPLETION_VERIFICATION, "completion_routed")
    _hold_unresolvable(report, "REP")
    return report


# --- T10 or its rejection: completion verification (API-167; FR-PORTAL.15) -------------------------
def completion_verification(principal, session, claim, report_id, body):
    body, report, assignment = _step(principal, session, claim, report_id, "completion_verify", body)
    version = _version(body)
    outcome = body.get("outcome")
    if outcome not in ("verified", "rejected"):
        raise invalid("outcome")
    reason = _text(body, "reason", required=True)
    completers = set(CompletionEvidence.objects.filter(report=report).values_list("submitted_by_account_id", flat=True))
    if assignment.staff_account_id in completers:
        raise conflict_excluded()  # the completer never verifies their own completion
    if report.reporter_kind == CivicReport.ReporterKind.STAFF_OFFICIAL and outcome == "verified":
        # Who confirms a staff-official report's resolution is undecided (DG-20); it is not routed onward.
        raise ApiError("E_DECISION_PENDING", "This step is not available yet.", 409)
    evidence = _evidence(body, report, assignment.staff_account_id, required=outcome == "verified")
    to_state = S.PENDING_CITIZEN_CONFIRMATION if outcome == "verified" else S.IN_PROGRESS
    event = "completion_verified" if outcome == "verified" else "completion_rejected"
    with transaction.atomic():
        report, applied = _move(report, to_state, assignment, version, event, reason=outcome)
        if applied:
            Verification.objects.create(
                report=report, verification_kind=Verification.Kind.COMPLETION,
                verified_by_account_id=assignment.staff_account_id, role_assignment_id=assignment.id,
                outcome=outcome, note=reason, evidence_ids=evidence, created_at=timezone.now(),
            )
    return report


# --- T12: ordinary closure, UC Officer only (API-168; FR-PORTAL.16) ---------------------------------
def close(principal, session, claim, report_id, body):
    body, report, assignment = _step(principal, session, claim, report_id, "close", body)
    version = _version(body)
    reason = _text(body, "reason", required=True)
    return _move(report, S.CLOSED, assignment, version, "case_closed", note=reason)[0]


# --- reopen after closure (API-169; FR-PORTAL.17) -------------------------------------------------
def reopen(principal, session, claim, report_id, body):
    body, report, assignment = _step(principal, session, claim, report_id, "reopen", body)
    version = _version(body)
    reason = _text(body, "reason", required=True)
    if report.state != S.CLOSED and report.state_version == version:
        raise stale()  # only a closed report is reopened here; a disputed one is already REOPENED
    return _move(report, S.REOPENED, assignment, version, "case_reopened", note=reason)[0]


# --- rework or reassign a reopened report (RBAC §3 row 24, §9.3; FR-PORTAL.18) ----------------------
def handle_dispute(principal, session, claim, report_id, body):
    body, report, assignment = _step(principal, session, claim, report_id, "handle_dispute", body)
    version = _version(body)
    handling = body.get("handling")
    if handling not in ("rework", "reassign"):
        raise invalid("handling")
    reason = _text(body, "reason", required=True)
    with transaction.atomic():
        case = current_assignment(report)
        if handling == "rework" and (case is None or case.status != CaseAssignment.Status.ACCEPTED):
            raise ApiError("E_NO_CURRENT_CONTRACTOR", "There is no contractor to rework this.", 409)
        to_state = S.IN_PROGRESS if handling == "rework" else S.ACCEPTED
        report, applied = _move(report, to_state, assignment, version, "dispute_handled", reason=handling, note=reason)
        if applied:
            if handling == "reassign" and case is not None:
                case.status = CaseAssignment.Status.ENDED
                case.save(update_fields=["status"])
            dispute = Dispute.objects.filter(report=report, handled_by_account_id__isnull=True).order_by("-created_at").first()
            if dispute is not None:
                dispute.handled_by_account_id, dispute.handling = assignment.staff_account_id, handling
                dispute.save(update_fields=["handled_by_account_id", "handling"])
    return report
