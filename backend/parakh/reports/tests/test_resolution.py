"""FR-PUB.34, T11: the reporter confirms or disputes a verified repair (API-153, API-154). Synthetic data."""
import uuid

from parakh.audit.models import AuditEvent, verify_chain
from parakh.drafts.services import MAX_TYPED_DESCRIPTION
from parakh.drafts.tests.base import ReportingTestCase
from parakh.reports import lifecycle
from parakh.reports.models import CitizenConfirmation, CivicReport, Dispute, ReportTimelineEntry

S = CivicReport.State
TO_PENDING = [
    (S.UNDER_VERIFICATION, "system"), (S.VERIFIED, "REP"), (S.UC_REVIEW, "system"), (S.ACCEPTED, "UCO"),
    (S.CONTRACTOR_ASSIGNED, "UCO"), (S.IN_PROGRESS, "CON"), (S.COMPLETION_SUBMITTED, "CON"),
    (S.COMPLETION_VERIFICATION, "system"), (S.PENDING_CITIZEN_CONFIRMATION, "REP"),
]


class ResolutionTests(ReportingTestCase):
    def setUp(self):
        super().setUp()
        csid, rendering, _ = self.voice_draft()
        self.confirm(csid, rendering)
        self.report_id = self.submit(csid).json()["report_id"]

    def _advance(self, steps=TO_PENDING):
        for to_state, actor in steps:
            version = CivicReport.objects.get(id=self.report_id).state_version
            lifecycle.transition(self.report_id, to_state, actor=actor, expected_state_version=version)
        return CivicReport.objects.get(id=self.report_id).state_version

    def _answer(self, kind, client=None, **body):
        return (client or self.api).post(f"/citizen/reports/{self.report_id}/{kind}", body, format="json")

    def test_the_reporter_confirms_the_repair(self):  # T11
        version = self._advance()
        detail = self.api.get(f"/citizen/reports/{self.report_id}").json()
        self.assertEqual((detail["state"], detail["state_version"]), (S.PENDING_CITIZEN_CONFIRMATION, version))
        response = self._answer("confirm", state_version=version)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Cache-Control"], "no-store")
        self.assertEqual(response.json(), {"state": S.RESOLVED_CONFIRMED, "state_version": version + 1})
        answer = CitizenConfirmation.objects.get(report_id=self.report_id)
        self.assertEqual((answer.outcome, answer.reason, answer.from_state_version), ("confirmed", "", version))
        self.assertFalse(Dispute.objects.exists())
        self.assertEqual(ReportTimelineEntry.objects.filter(report_id=self.report_id).last().state, S.RESOLVED_CONFIRMED)
        event = AuditEvent.objects.filter(action="resolution_confirmed").get()
        self.assertEqual((event.actor_kind, event.details["new_state"]), ("citizen", S.RESOLVED_CONFIRMED))
        self.assertEqual(verify_chain(), (True, None))

    def test_a_dispute_needs_a_reason_kept_as_written_and_reopens_the_report(self):
        version = self._advance()
        for bad in ({}, {"reason": ""}, {"reason": "  \n "}, {"reason": 5}, {"reason": "x" * (MAX_TYPED_DESCRIPTION + 1)}):
            response = self._answer("dispute", state_version=version, **bad)
            self.assertEqual((response.status_code, response.json()["error"]["code"], response.json()["error"]["field"]),
                             (400, "E_VALIDATION", "reason"))
        reason = "  The pipe still leaks near the school gate.\r\n"
        response = self._answer("dispute", state_version=version, reason=reason)
        self.assertEqual(response.json(), {"state": S.REOPENED, "state_version": version + 1})
        dispute = Dispute.objects.get(report_id=self.report_id)
        self.assertEqual((dispute.reason, dispute.appeal_status), (reason, "NOT_FILED"))
        self.assertEqual(CitizenConfirmation.objects.get(report_id=self.report_id).reason, reason)
        event = AuditEvent.objects.filter(action="resolution_disputed").get()
        self.assertNotIn("leaks", str(event.details))  # the citizen's words stay out of the audit trail

    def test_only_in_pending_confirmation_and_only_at_the_version_seen(self):
        version = self._advance(TO_PENDING[:6])  # IN_PROGRESS
        for kind, extra in (("confirm", {}), ("dispute", {"reason": "not fixed"})):
            response = self._answer(kind, state_version=version, **extra)
            self.assertEqual((response.status_code, response.json()["error"]["code"]), (409, "E_STALE_STATE"))
        version = self._advance(TO_PENDING[6:])
        stale = self._answer("confirm", state_version=version - 1)
        self.assertEqual((stale.status_code, stale.json()["error"]["code"]), (409, "E_STALE_STATE"))
        for bad in (None, "3", 0, -1, True):
            response = self._answer("confirm", state_version=bad)
            self.assertEqual((response.status_code, response.json()["error"]["field"]), (400, "state_version"))
        self.assertEqual(CivicReport.objects.get(id=self.report_id).state, S.PENDING_CITIZEN_CONFIRMATION)

    def test_a_retry_returns_the_original_answer_and_never_a_second(self):  # idempotent under retry
        version = self._advance()
        first = self._answer("confirm", state_version=version)
        again = self._answer("confirm", state_version=version)
        self.assertEqual((again.status_code, again.json()), (200, first.json()))
        self.assertEqual(CitizenConfirmation.objects.filter(report_id=self.report_id).count(), 1)
        self.assertEqual(AuditEvent.objects.filter(action="resolution_confirmed").count(), 1)
        changed_mind = self._answer("dispute", state_version=version, reason="not fixed")
        self.assertEqual((changed_mind.status_code, changed_mind.json()["error"]["code"]), (409, "E_STALE_STATE"))
        self.assertFalse(Dispute.objects.exists())

    def test_a_disputed_report_waits_for_the_next_round(self):
        version = self._advance()
        self._answer("dispute", state_version=version, reason="not fixed")
        # Rework by the UC Officer, then a new completion and a new round of confirmation.
        version = self._advance([(S.IN_PROGRESS, "UCO"), (S.COMPLETION_SUBMITTED, "CON"),
                                 (S.COMPLETION_VERIFICATION, "system"), (S.PENDING_CITIZEN_CONFIRMATION, "REP")])
        self.assertEqual(self._answer("confirm", state_version=version).json()["state"], S.RESOLVED_CONFIRMED)
        self.assertEqual(list(CitizenConfirmation.objects.filter(report_id=self.report_id)
                              .order_by("created_at").values_list("outcome", flat=True)), ["disputed", "confirmed"])

    def test_only_the_reporter_and_anything_else_is_the_uniform_404(self):
        version = self._advance()
        other = self.as_other_citizen()
        not_owned = self._answer("confirm", client=other, state_version=version)
        missing = other.post(f"/citizen/reports/{uuid.uuid4()}/confirm", {"state_version": version}, format="json")
        self.assertEqual((not_owned.status_code, not_owned.json()), (missing.status_code, missing.json()))
        self.assertEqual(not_owned.status_code, 404)
        self.assertEqual(self._answer("dispute", client=other, state_version=version, reason="x").status_code, 404)
        self.api.credentials()
        self.assertEqual(self._answer("confirm", state_version=version).status_code, 401)
        self.assertEqual(CivicReport.objects.get(id=self.report_id).state, S.PENDING_CITIZEN_CONFIRMATION)
