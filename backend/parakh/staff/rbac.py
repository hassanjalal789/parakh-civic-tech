"""The permission matrix as data (RBAC §2, §3; API Contract §8.2). A missing row is a denial.

Each action names the roles that may perform it, the capability it needs, how its scope is
checked, whether the acting account's conflict exclusion bars it, and whether it needs a
fresh step-up OTP (RBAC §5). Workflow state is checked by the state machine
(parakh.reports.lifecycle), not here.

Scope kinds:
- "geo": the report's Union Council lies inside the assignment's geographic scope;
- "org": the report is assigned to the contractor's organisation ("assigned only");
- "none": no record is involved, or the caller checks a target scope itself (invitations,
  role assignment: never above the actor's own).
"""
from __future__ import annotations

from dataclasses import dataclass

REP, UCO, CON, MAY = "REP", "UCO", "CON", "MAY"


@dataclass(frozen=True)
class Action:
    roles: frozenset[str]
    capability: str | None  # None where the matrix names no capability: the role column governs
    scope: str  # "geo" | "org" | "none"
    conflict: bool  # the acting account must not be excluded from the record (RBAC §8)
    step_up: bool  # a fresh OTP within 10 minutes (RBAC §5)
    audit: str
    explicit: str | None = None  # a capability the role holds only when explicitly granted


def _a(roles, capability, scope, conflict, step_up, audit, explicit=None) -> Action:
    return Action(frozenset(roles), capability, scope, conflict, step_up, audit, explicit)


# Rows of RBAC §3 (numbers in comments). Rows 1, 2, 19 and 20 are the reporter's own actions,
# authorised by ownership rather than an acting role; row 4 is a fact about responses.
ACTIONS: dict[str, Action] = {
    "view_report": _a({REP, UCO, MAY}, None, "geo", False, False, "report_viewed"),  # 3
    "view_assigned_work": _a({CON}, None, "org", False, False, "report_viewed"),  # 3: assigned only
    "protected_contact": _a({MAY}, "CAP_PROTECTED_CONTACT", "geo", False, True, "protected_contact_sent"),  # 5
    "play_original_audio": _a({REP, UCO, MAY}, None, "geo", False, False, "audio_played"),  # 6
    "view_rendering": _a({REP, UCO, MAY}, None, "geo", False, False, "rendering_viewed"),  # 7
    "read_asr_output": _a({REP, UCO, MAY}, None, "geo", False, False, "asr_output_viewed"),  # 8
    "transcript_review": _a({UCO, MAY}, "CAP_TRANSCRIPT_REVIEW", "geo", False, False, "transcript_reviewed"),  # 9
    "field_verify": _a({REP}, "CAP_FIELD_VERIFY", "geo", True, False, "field_verified"),  # 10
    "accept": _a({UCO}, "CAP_CASE_ACCEPT", "geo", True, False, "case_accepted"),  # 11
    "reject": _a({UCO}, "CAP_CASE_REJECT", "geo", True, True, "case_rejected"),  # 12
    "clarify": _a({REP, UCO}, "CAP_CASE_CLARIFY", "geo", True, False, "clarification_requested"),  # 13
    "assign": _a({UCO}, "CAP_CASE_ASSIGN", "geo", True, True, "contractor_assigned"),  # 14
    "work_respond": _a({CON}, "CAP_WORK_ACCEPT", "org", False, False, "work_accepted"),  # 15
    "work_progress": _a({CON}, "CAP_WORK_PROGRESS", "org", False, False, "progress_updated"),  # 16
    "work_complete": _a({CON}, "CAP_WORK_COMPLETE", "org", False, False, "completion_submitted"),  # 17
    "completion_verify": _a({REP}, "CAP_COMPLETION_VERIFY", "geo", True, False, "completion_verified"),  # 18
    "close": _a({UCO}, "CAP_CASE_CLOSE", "geo", True, True, "case_closed"),  # 21
    "reopen": _a({UCO, MAY}, "CAP_CASE_REOPEN", "geo", True, True, "case_reopened"),  # 22
    "exceptional_intervention": _a({MAY}, "CAP_EXCEPTIONAL_INTERVENTION", "geo", True, True,
                                   "exceptional_intervention"),  # 23
    "handle_dispute": _a({UCO}, None, "geo", True, True, "dispute_handled"),  # 24
    "appeal_decide": _a({MAY}, "CAP_APPEAL_DECIDE", "geo", True, True, "appeal_decided"),  # 25
    "escalate": _a({REP, UCO, MAY}, "CAP_ESCALATION", "geo", False, False, "case_escalated"),  # 26
    "invite_rep": _a({UCO}, "CAP_REP_INVITE", "none", False, True, "rep_invited"),  # 27
    "provision_officer": _a({MAY}, "CAP_ACCOUNT_ADMIN", "none", False, True, "officer_provisioned",
                            explicit="CAP_ACCOUNT_ADMIN"),  # 28
    "provision_contractor": _a({MAY}, "CAP_ACCOUNT_ADMIN", "none", False, True, "contractor_provisioned",
                               explicit="CAP_ACCOUNT_ADMIN"),  # 29
    "organisation_decide": _a({MAY}, "CAP_ACCOUNT_ADMIN", "none", False, True, "organisation_approved",
                              explicit="CAP_ACCOUNT_ADMIN"),  # 30
    "role_assign": _a({MAY}, "CAP_ROLE_ASSIGN", "none", False, True, "role_assigned",
                      explicit="CAP_ROLE_ASSIGN"),  # 31
    "account_suspend": _a({MAY}, "CAP_ACCOUNT_ADMIN", "none", False, True, "account_suspended",
                          explicit="CAP_ACCOUNT_ADMIN"),  # 32
    "audit_read": _a({UCO, MAY}, "CAP_AUDIT_READ", "geo", False, True, "audit_log_viewed"),  # 33
    "export": _a({MAY}, "CAP_EXPORT", "none", False, True, "export_generated"),  # 34
    "report_official": _a({REP, UCO, CON, MAY}, "CAP_REPORT_OFFICIAL", "none", False, False, "report_submitted",
                          explicit="CAP_REPORT_OFFICIAL"),  # 1 (staff, STF-10)
}

# What the matrix never allows, stated so a test can hold it (RBAC §2.2, §3; TEST-RBAC-001, -002).
NEVER = {
    ("close", MAY), ("reject", MAY), ("assign", MAY), ("accept", MAY), ("invite_rep", MAY),
    ("work_complete", UCO), ("completion_verify", CON), ("field_verify", CON), ("clarify", CON),
    ("view_rendering", CON), ("play_original_audio", CON), ("read_asr_output", CON),
}
