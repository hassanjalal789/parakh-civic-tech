"""DG-56 and SRS §6.2.8: the state machine, with no verification stage skipped."""
from parakh.core.errors import ApiError
from parakh.drafts.tests.base import ReportingTestCase
from parakh.reports import lifecycle
from parakh.reports.models import CivicReport, ReportTimelineEntry

S = CivicReport.State

HAPPY_PATH = [
    (S.UNDER_VERIFICATION, "system"),
    (S.VERIFIED, "REP"),
    (S.UC_REVIEW, "system"),
    (S.ACCEPTED, "UCO"),
    (S.CONTRACTOR_ASSIGNED, "UCO"),
    (S.IN_PROGRESS, "CON"),
    (S.COMPLETION_SUBMITTED, "CON"),
    (S.COMPLETION_VERIFICATION, "system"),
    (S.PENDING_CITIZEN_CONFIRMATION, "REP"),
    (S.RESOLVED_CONFIRMED, "citizen"),
    (S.CLOSED, "UCO"),
]


class LifecycleTests(ReportingTestCase):
    def setUp(self):
        super().setUp()
        csid, rendering, _ = self.voice_draft()
        self.confirm(csid, rendering)
        self.report_id = self.submit(csid).json()["report_id"]

    def _move(self, to_state, actor):
        version = CivicReport.objects.get(id=self.report_id).state_version
        return lifecycle.transition(self.report_id, to_state, actor=actor, expected_state_version=version)

    def _refused(self, to_state, actor, code):
        with self.assertRaises(ApiError) as caught:
            self._move(to_state, actor)
        self.assertEqual(caught.exception.code, code)

    def test_the_canonical_path_runs_in_order_and_is_recorded(self):
        for to_state, actor in HAPPY_PATH:
            self._move(to_state, actor)
        report = CivicReport.objects.get(id=self.report_id)
        self.assertEqual((report.state, report.state_version), (S.CLOSED, len(HAPPY_PATH) + 1))
        self.assertEqual(list(ReportTimelineEntry.objects.filter(report=report).values_list("state", flat=True)),
                         [S.SUBMITTED] + [s for s, _ in HAPPY_PATH])

    def test_no_verification_stage_can_be_skipped(self):  # DG-56
        for to_state in (S.VERIFIED, S.UC_REVIEW, S.ACCEPTED, S.CONTRACTOR_ASSIGNED, S.IN_PROGRESS, S.CLOSED):
            self._refused(to_state, "UCO", "E_TRANSITION_NOT_ALLOWED")
        self._move(S.UNDER_VERIFICATION, "system")
        for to_state in (S.ACCEPTED, S.CONTRACTOR_ASSIGNED):  # the UC Officer cannot act before verification ends
            self._refused(to_state, "UCO", "E_TRANSITION_NOT_ALLOWED")
        self._move(S.VERIFIED, "REP")
        self._refused(S.ACCEPTED, "UCO", "E_TRANSITION_NOT_ALLOWED")  # the UC review stage cannot be skipped
        self._move(S.UC_REVIEW, "system")
        self._refused(S.CONTRACTOR_ASSIGNED, "UCO", "E_TRANSITION_NOT_ALLOWED")  # acceptance cannot be skipped

    def test_a_failed_verification_still_goes_to_the_uc_officer(self):
        self._move(S.UNDER_VERIFICATION, "system")
        self._move(S.UC_REVIEW, "REP")  # verification failed, inaccessible or duplicate suspected
        self._move(S.REJECTED, "UCO")
        self.assertEqual(CivicReport.objects.get(id=self.report_id).state, S.REJECTED)

    def test_each_step_belongs_to_its_role(self):
        self._move(S.UNDER_VERIFICATION, "system")
        self._refused(S.VERIFIED, "UCO", "E_FORBIDDEN")  # only the Street Representative verifies
        self._move(S.VERIFIED, "REP")
        self._move(S.UC_REVIEW, "system")
        self._refused(S.ACCEPTED, "REP", "E_FORBIDDEN")  # only the UC Officer accepts
        self._refused(S.ACCEPTED, "MAY", "E_FORBIDDEN")

    def test_ordinary_closure_is_uc_officer_only(self):
        for to_state, actor in HAPPY_PATH[:-1]:
            self._move(to_state, actor)
        self._refused(S.CLOSED, "MAY", "E_FORBIDDEN")
        self._move(S.CLOSED, "UCO")

    def test_a_stale_state_version_is_refused(self):
        with self.assertRaises(ApiError) as caught:
            lifecycle.transition(self.report_id, S.UNDER_VERIFICATION, actor="system", expected_state_version=99)
        self.assertEqual(caught.exception.code, "E_STALE_STATE")

    def test_the_table_holds_no_prohibited_transition(self):  # SRS §6.2.8 "Prohibited transitions"
        for prohibited in [(S.SUBMITTED, S.CONTRACTOR_ASSIGNED), (S.UC_REVIEW, S.CONTRACTOR_ASSIGNED),
                           (S.IN_PROGRESS, S.RESOLVED_CONFIRMED)]:
            self.assertNotIn(prohibited, lifecycle.TRANSITIONS)
        self.assertEqual(lifecycle.TRANSITIONS[(S.RESOLVED_CONFIRMED, S.CLOSED)], frozenset({"UCO"}))
        self.assertFalse(any(to == S.SUBMITTED for _, to in lifecycle.TRANSITIONS))  # creation only, never a transition
