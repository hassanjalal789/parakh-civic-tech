"""FR-PORTAL.5–.18, RBAC §3, §9–§10: the staff steps on a report, over HTTP. Synthetic data only."""
import uuid

from django.utils import timezone

from parakh.audit.models import AuditEvent, verify_chain
from parakh.drafts.tests.base import ReportingTestCase
from parakh.reports import lifecycle
from parakh.reports.models import (
    CaseAssignment, CivicReport, CompletionEvidence, ContractorProgress, Dispute, StateChange, Verification,
)
from parakh.staff.tests.base import StaffFixtures

S = CivicReport.State
FORBIDDEN_IN_PACKET = ("citizen_account", "voice_original", "source_asr_text", "measured", "accuracy", "transcription",
                       "phone", "official_reporter", "location_voice", "english_rendering")


class WorkflowTests(StaffFixtures, ReportingTestCase):
    def setUp(self):
        super().setUp()
        self.make_scopes()
        csid, rendering, _ = self.voice_draft()
        self.confirm(csid, rendering)
        self.report_id = self.submit(csid).json()["report_id"]
        self.place(self.report_id, self.uc1)
        CivicReport.objects.filter(id=self.report_id).update(category="water")
        lifecycle.transition(self.report_id, S.UNDER_VERIFICATION, actor="system", expected_state_version=1)
        self.org = self.make_org()
        self.rep = self.assign(self.make_account("Rep"), "REP", self.uc1)
        self.uco = self.assign(self.make_account("Officer"), "UCO", self.district)
        self.con = self.assign(self.make_account("Contractor", organization=self.org), "CON", self.district,
                               organization=self.org)
        self.may = self.assign(self.make_account("Mayor"), "MAY", self.city)
        self.as_rep, self.as_uco = self.client_for(self.rep), self.client_for(self.uco)
        self.as_con, self.as_may = self.client_for(self.con), self.client_for(self.may)

    def version(self):
        return CivicReport.objects.get(id=self.report_id).state_version

    def post(self, client, path, **body):
        return client.post(f"/reports/{self.report_id}/{path}", {"state_version": self.version(), **body},
                           format="json")

    def ok(self, client, path, state, **body):
        response = self.post(client, path, **body)
        self.assertEqual(response.status_code, 200, response.content)
        self.assertEqual(response["Cache-Control"], "no-store")
        self.assertEqual(response.json()["state"], state)
        return response.json()

    def error(self, response, status, code, field=None):
        self.assertEqual((response.status_code, response.json()["error"]["code"]), (status, code), response.content)
        if field:
            self.assertEqual(response.json()["error"]["field"], field)

    def to_in_progress(self):
        self.ok(self.as_rep, "field-verification", S.UC_REVIEW, outcome="verified", reason="Seen on site.")
        self.ok(self.as_uco, "accept", S.ACCEPTED)
        self.ok(self.as_uco, "assign", S.CONTRACTOR_ASSIGNED, contractor_organization_id=str(self.org.id),
                note="Replace the broken pipe section.")
        return self.ok(self.as_con, "work/accept", S.IN_PROGRESS)

    def to_pending_confirmation(self):
        self.to_in_progress()
        self.ok(self.as_con, "completion", S.COMPLETION_VERIFICATION, note="Pipe replaced.",
                evidence_ids=[self.staff_evidence(self.report_id, self.con)])
        self.ok(self.as_rep, "completion-verification", S.PENDING_CITIZEN_CONFIRMATION, outcome="verified",
                reason="Checked; no leak.", evidence_ids=[self.staff_evidence(self.report_id, self.rep)])

    def test_the_whole_lifecycle_in_order(self):  # T3 … T12, DG-56
        packet = self.to_in_progress()
        self.assertEqual(CaseAssignment.objects.get(report_id=self.report_id).status, "ACCEPTED")
        self.ok(self.as_con, "progress", S.IN_PROGRESS, note="Digging started.", percent=30)
        self.ok(self.as_con, "completion", S.COMPLETION_VERIFICATION, note="Pipe replaced.",
                evidence_ids=[self.staff_evidence(self.report_id, self.con)])  # T8, then T9 at once
        self.ok(self.as_rep, "completion-verification", S.PENDING_CITIZEN_CONFIRMATION, outcome="verified",
                reason="Checked; no leak.", evidence_ids=[self.staff_evidence(self.report_id, self.rep)])  # T10
        answer = self.api.post(f"/citizen/reports/{self.report_id}/confirm", {"state_version": self.version()},
                               format="json")
        self.assertEqual(answer.json()["state"], S.RESOLVED_CONFIRMED)  # T11, the citizen
        self.ok(self.as_uco, "close", S.CLOSED, reason="Repaired and confirmed by the reporter.")  # T12
        steps = list(StateChange.objects.filter(report_id=self.report_id).order_by("from_state_version")
                     .values_list("to_state", "actor"))
        self.assertEqual(steps, [
            (S.UNDER_VERIFICATION, "system"), (S.VERIFIED, "REP"), (S.UC_REVIEW, "system"), (S.ACCEPTED, "UCO"),
            (S.CONTRACTOR_ASSIGNED, "UCO"), (S.IN_PROGRESS, "CON"), (S.COMPLETION_SUBMITTED, "CON"),
            (S.COMPLETION_VERIFICATION, "system"), (S.PENDING_CITIZEN_CONFIRMATION, "REP"),
            (S.RESOLVED_CONFIRMED, "citizen"), (S.CLOSED, "UCO"),
        ])
        for event in ("field_verified", "case_queued_for_review", "case_accepted", "contractor_assigned",
                      "work_accepted", "progress_updated", "completion_submitted", "completion_routed",
                      "completion_verified", "resolution_confirmed", "case_closed"):
            self.assertTrue(AuditEvent.objects.filter(action=event).exists(), event)
        accepted = AuditEvent.objects.get(action="case_accepted")
        self.assertEqual((accepted.actor_kind, accepted.details["role"]), ("staff", "UCO"))
        self.assertEqual(accepted.details["acting_role_assignment_id"], str(self.uco.id))
        self.assertNotIn("Repaired", str(AuditEvent.objects.get(action="case_closed").details))  # notes stay out
        self.assertEqual(verify_chain(), (True, None))
        # The contractor's packet: what and where, never who (API §9.1; DG-80).
        self.assertEqual(packet["category"], "water")
        self.assertEqual(packet["work_instructions"], "Replace the broken pipe section.")
        self.assertIn("latitude", packet["location"])
        self.assertTrue(packet["urdu_civic_rendering"])
        for word in FORBIDDEN_IN_PACKET:
            self.assertNotIn(word, str(packet).lower(), word)

    def test_field_verification_outcomes_all_reach_the_uc_officer(self):  # RBAC §9.3; DG-56
        for bad in ({"outcome": "verified"}, {"outcome": "verified", "reason": "  "}, {"outcome": "needs_clarification",
                    "reason": "?"}, {"outcome": "approved", "reason": "x"}):
            self.error(self.post(self.as_rep, "field-verification", **bad), 400, "E_VALIDATION")
        self.error(self.post(self.as_rep, "field-verification", outcome="duplicate_suspected", reason="Same pipe",
                             linked_report_reference="PRK-NONE-0000"), 400, "E_VALIDATION", "linked_report_reference")
        self.ok(self.as_rep, "field-verification", S.UC_REVIEW, outcome="location_inaccessible",
                reason="The lane is closed.")
        self.assertEqual(Verification.objects.get(report_id=self.report_id).outcome, "location_inaccessible")
        self.assertTrue(AuditEvent.objects.filter(action="location_inaccessible").exists())
        self.assertFalse(StateChange.objects.filter(report_id=self.report_id, to_state=S.VERIFIED).exists())

    def test_a_retry_is_the_same_step_never_a_second(self):  # RBAC §9.2
        self.ok(self.as_rep, "field-verification", S.UC_REVIEW, outcome="verified", reason="Seen on site.")
        version = self.version()
        first = self.as_uco.post(f"/reports/{self.report_id}/accept", {"state_version": version}, format="json")
        again = self.as_uco.post(f"/reports/{self.report_id}/accept", {"state_version": version}, format="json")
        self.assertEqual((again.status_code, again.json()), (200, first.json()))
        self.assertEqual(AuditEvent.objects.filter(action="case_accepted").count(), 1)
        other_officer = self.client_for(self.assign(self.make_account("Officer 2"), "UCO", self.district))
        not_theirs = other_officer.post(f"/reports/{self.report_id}/accept", {"state_version": version}, format="json")
        self.error(not_theirs, 409, "E_STALE_STATE")  # someone else's step is not their retry
        stale = self.as_uco.post(f"/reports/{self.report_id}/assign", {
            "state_version": version, "contractor_organization_id": str(self.org.id)}, format="json")
        self.error(stale, 409, "E_STALE_STATE")

    def test_only_eligible_contractors_are_offered_and_accepted(self):  # RBAC §10; BR-020
        self.ok(self.as_rep, "field-verification", S.UC_REVIEW, outcome="verified", reason="Seen on site.")
        self.ok(self.as_uco, "accept", S.ACCEPTED)
        wrong_category = self.make_org(approved_categories=["road"])
        far = self.make_org()
        far.service_areas.set([self.other_district])
        suspended = self.make_org(status="SUSPENDED")
        nobody = self.make_org()  # approved, but no active contractor account
        for org in (wrong_category, far, suspended):
            self.assign(self.make_account("C", organization=org), "CON", self.district, organization=org)
        listed = self.as_uco.get(f"/reports/{self.report_id}/eligible-contractors").json()["contractors"]
        self.assertEqual([c["id"] for c in listed], [str(self.org.id)])
        for org in (wrong_category, far, suspended, nobody):
            self.error(self.post(self.as_uco, "assign", contractor_organization_id=str(org.id)), 400, "E_VALIDATION",
                       "contractor_organization_id")
        self.error(self.post(self.as_may, "assign", contractor_organization_id=str(self.org.id)), 403, "E_FORBIDDEN")
        self.ok(self.as_uco, "assign", S.CONTRACTOR_ASSIGNED, contractor_organization_id=str(self.org.id))
        # Suspended after assignment: refused at the point of action, despite a valid session.
        self.org.status = "SUSPENDED"
        self.org.save(update_fields=["status"])
        self.error(self.post(self.as_con, "work/accept"), 403, "E_ROLE_ASSIGNMENT_INVALID")

    def test_another_organisations_contractor_does_not_see_the_work(self):
        self.to_in_progress()
        rival_org = self.make_org()
        rival = self.client_for(self.assign(self.make_account("R", organization=rival_org), "CON", self.district,
                                            organization=rival_org))
        self.error(self.post(rival, "progress", note="x"), 404, "E_NOT_FOUND")

    def test_completion_needs_the_contractors_own_sealed_evidence(self):  # T8
        self.to_in_progress()
        self.error(self.post(self.as_con, "completion", note="Done."), 400, "E_VALIDATION", "evidence_ids")
        theirs = self.staff_evidence(self.report_id, self.rep)
        self.error(self.post(self.as_con, "completion", note="Done.", evidence_ids=[theirs]), 400, "E_VALIDATION",
                   "evidence_ids")
        self.error(self.post(self.as_con, "completion", note="Done.", evidence_ids=[str(uuid.uuid4())]), 400,
                   "E_VALIDATION", "evidence_ids")
        self.error(self.post(self.as_con, "progress", percent=101), 400, "E_VALIDATION", "percent")
        self.assertFalse(CompletionEvidence.objects.exists())
        self.assertFalse(ContractorProgress.objects.exists())

    def test_the_completer_never_verifies_and_no_eligible_representative_holds_the_case(self):  # RBAC §8, §9.3
        self.to_in_progress()
        # The only Representative in scope is the contractor's own account under another role.
        CivicReport.objects.filter(id=self.report_id).update(uc_scope_id=self.uc2.id)
        completer_as_rep = self.assign(self.con.staff_account, "REP", self.uc2)
        self.place(self.report_id, self.uc2)
        self.org.service_areas.add(self.uc2)
        self.ok(self.as_con, "completion", S.COMPLETION_SUBMITTED, note="Done.",
                evidence_ids=[self.staff_evidence(self.report_id, self.con)])  # held, not routed back
        self.assertTrue(AuditEvent.objects.filter(action="case_unresolvable").exists())
        lifecycle.transition(self.report_id, S.COMPLETION_VERIFICATION, actor="system",
                             expected_state_version=self.version())
        as_completer = self.client_for(completer_as_rep)
        self.error(self.post(as_completer, "completion-verification", outcome="verified", reason="Fine.",
                             evidence_ids=[self.staff_evidence(self.report_id, completer_as_rep)]),
                   403, "E_CONFLICT_EXCLUDED")

    def test_a_rejected_completion_goes_back_to_work(self):
        self.to_in_progress()
        self.ok(self.as_con, "completion", S.COMPLETION_VERIFICATION, note="Done.",
                evidence_ids=[self.staff_evidence(self.report_id, self.con)])
        self.error(self.post(self.as_rep, "completion-verification", outcome="verified", reason="Fine."), 400,
                   "E_VALIDATION", "evidence_ids")  # verification evidence is required
        self.ok(self.as_rep, "completion-verification", S.IN_PROGRESS, outcome="rejected",
                reason="Still leaking.")
        self.assertTrue(AuditEvent.objects.filter(action="completion_rejected").exists())

    def test_a_dispute_is_reworked_or_reassigned(self):  # FR-PORTAL.18; RBAC §9.3
        self.to_pending_confirmation()
        self.api.post(f"/citizen/reports/{self.report_id}/dispute",
                      {"state_version": self.version(), "reason": "Still leaking."}, format="json")
        self.error(self.post(self.as_uco, "dispute/handle", handling="rework"), 400, "E_VALIDATION", "reason")
        self.error(self.post(self.as_may, "dispute/handle", handling="rework", reason="x"), 403, "E_FORBIDDEN")
        self.ok(self.as_uco, "dispute/handle", S.ACCEPTED, handling="reassign", reason="New contractor needed.")
        self.assertEqual(CaseAssignment.objects.get(report_id=self.report_id).status, "ENDED")
        dispute = Dispute.objects.get(report_id=self.report_id)
        self.assertEqual((dispute.handling, dispute.handled_by_account_id), ("reassign", self.uco.staff_account_id))
        self.ok(self.as_uco, "assign", S.CONTRACTOR_ASSIGNED, contractor_organization_id=str(self.org.id))

    def test_rework_needs_the_contractor_still_on_the_job(self):
        self.to_pending_confirmation()
        self.api.post(f"/citizen/reports/{self.report_id}/dispute",
                      {"state_version": self.version(), "reason": "Still leaking."}, format="json")
        CaseAssignment.objects.filter(report_id=self.report_id).update(status="ENDED")
        self.error(self.post(self.as_uco, "dispute/handle", handling="rework", reason="x"), 409,
                   "E_NO_CURRENT_CONTRACTOR")
        CaseAssignment.objects.filter(report_id=self.report_id).update(status="ACCEPTED")
        self.ok(self.as_uco, "dispute/handle", S.IN_PROGRESS, handling="rework", reason="Same contractor to fix.")
        self.assertTrue(AuditEvent.objects.filter(action="dispute_handled").exists())

    def test_closure_and_reopening(self):  # FR-PORTAL.16, .17
        self.to_pending_confirmation()
        self.api.post(f"/citizen/reports/{self.report_id}/confirm", {"state_version": self.version()}, format="json")
        self.error(self.post(self.as_uco, "close"), 400, "E_VALIDATION", "reason")
        self.error(self.post(self.as_may, "close", reason="x"), 403, "E_FORBIDDEN")  # never the Mayor
        self.ok(self.as_uco, "close", S.CLOSED, reason="Done.")
        self.error(self.post(self.as_rep, "reopen", reason="x"), 403, "E_FORBIDDEN")
        self.ok(self.as_may, "reopen", S.REOPENED, reason="Complaint received again.")

    def test_staff_routes_need_a_staff_session_and_an_acting_role(self):
        no_header = self.client_for(self.rep, header=False)
        self.error(self.post(no_header, "field-verification", outcome="verified", reason="x"), 403,
                   "E_ROLE_ASSIGNMENT_INVALID")
        self.assertEqual(self.post(self.api, "field-verification", outcome="verified", reason="x").status_code, 403)
        self.api.credentials()
        self.assertEqual(self.post(self.api, "field-verification", outcome="verified", reason="x").status_code, 401)
        missing = self.as_rep.post(f"/reports/{uuid.uuid4()}/field-verification", {"state_version": 1}, format="json")
        self.error(missing, 404, "E_NOT_FOUND")
        self.assertEqual(CivicReport.objects.get(id=self.report_id).state, S.UNDER_VERIFICATION)
