"""RBAC §2–§8, §10, §14; API Contract §3.3–§4: the six acting-role checks. Synthetic data only."""
from datetime import timedelta

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from parakh.audit.models import AuditEvent
from parakh.authentication.models import AuthSession
from parakh.core.errors import ApiError
from parakh.drafts.tests.base import ReportingTestCase
from parakh.reports.models import CaseAssignment
from parakh.staff import authorization
from parakh.staff.authorization import STEP_UP_WINDOW, authorize
from parakh.staff.models import ConflictExclusion, GeographicScope, RoleAssignment, scope_contains
from parakh.staff.rbac import ACTIONS, NEVER
from parakh.staff.services import change_account_status
from parakh.staff.tests.base import StaffFixtures


class AuthorizationTests(StaffFixtures, ReportingTestCase):
    def setUp(self):
        super().setUp()
        self.make_scopes()
        csid, rendering, _ = self.voice_draft()
        self.confirm(csid, rendering)
        self.report = self.place(self.submit(csid).json()["report_id"], self.uc1)
        self.rep = self.assign(self.make_account("Rep"), "REP", self.uc1)
        self.uco = self.assign(self.make_account("Officer"), "UCO", self.district)
        self.may = self.assign(self.make_account("Mayor"), "MAY", self.city, granted=["CAP_ACCOUNT_ADMIN"])

    def _check(self, assignment, action, report=None, claimed=None, session_edit=None):
        principal, session = self.acting(assignment)
        if session_edit:
            session_edit(session)
        return authorize(principal, session, claimed or assignment.id, action, report or self.report)

    def _denied(self, code, *args, **kwargs):
        with self.assertRaises(ApiError) as caught:
            self._check(*args, **kwargs)
        self.assertEqual(caught.exception.code, code)
        return caught.exception

    def test_each_role_does_its_own_steps_in_scope(self):
        self.assertEqual(self._check(self.rep, "field_verify"), self.rep)
        self.assertEqual(self._check(self.uco, "accept"), self.uco)  # a district officer covers the UC
        self.assertEqual(self._check(self.may, "view_report"), self.may)

    def test_the_matrix_denials(self):  # TEST-RBAC-001, -002, -014, -015; RBAC §2.2
        for action, role in NEVER:
            self.assertNotIn(role, ACTIONS[action].roles, (action, role))
        self._denied("E_FORBIDDEN", self.may, "close")  # Mayor cannot close
        self._denied("E_FORBIDDEN", self.may, "invite_rep")  # Mayor cannot invite a Representative routinely
        self._denied("E_FORBIDDEN", self.rep, "accept")  # only the UC Officer accepts
        self._denied("E_FORBIDDEN", self.uco, "field_verify")
        self._denied("E_FORBIDDEN", self.rep, "not_an_action")  # a missing row is a denial

    def test_an_active_account_with_no_assignment_has_no_privilege(self):  # TEST-RBAC-026
        account = self.make_account("Unassigned")
        principal, session = self.acting(self.rep)
        principal.subject_id, session.subject_id = account.id, account.id
        session.acting_role_assignment_id = None
        with self.assertRaises(ApiError) as caught:
            authorize(principal, session, None, "view_report", self.report)
        self.assertEqual(caught.exception.code, "E_ROLE_ASSIGNMENT_INVALID")

    def test_a_claim_is_never_a_grant(self):  # check 1
        # Another account's assignment, named in the header: denied and audited.
        self._denied("E_ROLE_ASSIGNMENT_INVALID", self.rep, "accept", claimed=self.uco.id)
        self.assertEqual(AuditEvent.objects.filter(action="unauthorised_access_attempt").count(), 1)
        # Own, but not the one selected for this session: denied.
        other = self.assign(self.rep.staff_account, "REP", self.uc2)
        self._denied("E_ROLE_ASSIGNMENT_INVALID", self.rep, "field_verify", claimed=other.id)
        # A session that somehow selected another account's assignment is still refused.
        principal, session = self.acting(self.rep)
        session.acting_role_assignment_id = self.uco.id
        with self.assertRaises(ApiError) as caught:
            authorize(principal, session, self.uco.id, "accept", self.report)
        self.assertEqual(caught.exception.code, "E_ROLE_ASSIGNMENT_INVALID")
        # A citizen principal never passes.
        principal, session = self.acting(self.rep)
        principal.subject_type = "citizen"
        with self.assertRaises(ApiError):
            authorize(principal, session, self.rep.id, "view_report", self.report)

    def test_capabilities_are_never_unioned(self):  # TEST-RBAC-006, -027
        account = self.rep.staff_account
        officer_role = self.assign(account, "UCO", self.district)
        self._denied("E_FORBIDDEN", self.rep, "accept")  # acting as REP, the UCO assignment gives nothing
        self.assertEqual(self._check(officer_role, "accept"), officer_role)

    def test_validity_is_evaluated_at_the_point_of_action(self):  # TEST-RBAC-009
        principal, session = self.acting(self.rep)
        authorize(principal, session, self.rep.id, "field_verify", self.report)
        RoleAssignment.objects.filter(id=self.rep.id).update(valid_until=timezone.now() - timedelta(seconds=1))
        with self.assertRaises(ApiError) as caught:  # mid-session: the next action fails
            authorize(principal, session, self.rep.id, "field_verify", self.report)
        self.assertEqual(caught.exception.code, "E_ROLE_ASSIGNMENT_INVALID")
        for status in ("SUSPENDED", "REVOKED", "EXPIRED", "PENDING"):
            assignment = self.assign(self.make_account(status), "REP", self.uc1, status=status)
            self._denied("E_ROLE_ASSIGNMENT_INVALID", assignment, "field_verify")
        suspended = self.assign(self.make_account("Suspended", status="SUSPENDED"), "REP", self.uc1)
        self._denied("E_ROLE_ASSIGNMENT_INVALID", suspended, "field_verify")

    def test_scope_outside_is_the_uniform_404(self):  # check 4
        far = self.assign(self.make_account("Rep 2"), "REP", self.uc2)
        far_officer = self.assign(self.make_account("Officer B"), "UCO", self.other_district)
        self._denied("E_NOT_FOUND", far, "field_verify")
        self._denied("E_NOT_FOUND", far_officer, "accept")
        unplaced = self.place(self.report.id, self.uc1)
        unplaced.uc_scope_id = None  # a report with no Union Council is in nobody's scope
        self._denied("E_NOT_FOUND", self.uco, "accept", report=unplaced)
        self.assertTrue(scope_contains(self.city.id, self.uc1.id))
        self.assertFalse(scope_contains(self.uc1.id, self.city.id))
        self.assertFalse(scope_contains(self.uc2.id, self.uc1.id))

    def test_a_contractor_sees_only_work_assigned_to_its_organisation(self):  # RBAC §3 row 3, §10
        org = self.make_org()
        con = self.assign(self.make_account("Contractor", organization=org), "CON", self.district, organization=org)
        self._denied("E_NOT_FOUND", con, "view_assigned_work")
        CaseAssignment.objects.create(report=self.report, contractor_organization=org,
                                      assigned_by_account_id=self.uco.staff_account_id,
                                      assigned_by_role_assignment_id=self.uco.id, assigned_at=timezone.now())
        self.assertEqual(self._check(con, "view_assigned_work"), con)
        self._denied("E_FORBIDDEN", con, "view_report")  # never the scope-wide view
        # Organisation suspended after assignment: refused at the point of action.
        org.status = "SUSPENDED"
        org.save(update_fields=["status"])
        self._denied("E_ROLE_ASSIGNMENT_INVALID", con, "work_respond")

    def test_the_reporter_account_is_excluded_under_every_role(self):  # TEST-RBAC-008; RBAC §8
        account = self.uco.staff_account
        as_rep = self.assign(account, "REP", self.uc1)
        ConflictExclusion.objects.create(report=self.report, excluded_staff_account=account,
                                         reason="official_reporter", created_at=timezone.now())
        self._denied("E_CONFLICT_EXCLUDED", self.uco, "accept")
        self._denied("E_CONFLICT_EXCLUDED", as_rep, "field_verify")
        self.assertEqual(self._check(as_rep, "view_report"), as_rep)  # reading is not acting
        # The official reporter's own account, compared directly as well.
        report = self.report
        report.official_reporter_account_id = self.rep.staff_account_id
        self._denied("E_CONFLICT_EXCLUDED", self.rep, "field_verify", report=report)
        with self.assertRaises(RuntimeError):
            ConflictExclusion.objects.get(report=self.report).delete()

    def test_step_up_within_ten_minutes(self):  # TEST-RBAC-011, -012; RBAC §5
        self.assertEqual(self._check(self.uco, "reject"), self.uco)  # the login OTP counts
        stale = lambda s: setattr(s, "mfa_satisfied_at", timezone.now() - STEP_UP_WINDOW - timedelta(seconds=1))
        self._denied("E_STEP_UP_REQUIRED", self.uco, "reject", session_edit=stale)
        self.assertEqual(self._check(self.uco, "accept", session_edit=stale), self.uco)  # no step-up needed
        fresh = lambda s: (stale(s), setattr(s, "step_up_satisfied_at", timezone.now()))
        self.assertEqual(self._check(self.uco, "reject", session_edit=fresh), self.uco)

    def test_the_first_failing_check_decides(self):
        ConflictExclusion.objects.create(report=self.report, excluded_staff_account=self.uco.staff_account,
                                         reason="official_reporter", created_at=timezone.now())
        stale = lambda s: setattr(s, "mfa_satisfied_at", timezone.now() - timedelta(hours=1))
        self._denied("E_CONFLICT_EXCLUDED", self.uco, "reject", session_edit=stale)  # 5 before 6
        far = self.assign(self.uco.staff_account, "UCO", self.other_district)
        self._denied("E_NOT_FOUND", far, "reject", session_edit=stale)  # 4 before 5
        self._denied("E_FORBIDDEN", far, "field_verify")  # 3 before 4

    def test_explicit_grants(self):  # RBAC §2: CAP_ACCOUNT_ADMIN, CAP_ROLE_ASSIGN, CAP_REPORT_OFFICIAL
        plain = self.assign(self.make_account("Mayor 2"), "MAY", self.city)
        self._denied("E_FORBIDDEN", plain, "provision_officer")
        self.assertEqual(self._check(self.may, "provision_officer"), self.may)
        self._denied("E_FORBIDDEN", self.may, "role_assign")  # needs CAP_ROLE_ASSIGN too
        self._denied("E_FORBIDDEN", self.rep, "report_official")
        with self.assertRaises(ValidationError):
            self.assign(self.make_account(), "UCO", self.district, granted=["CAP_ACCOUNT_ADMIN"])
        with self.assertRaises(ValidationError):
            self.assign(self.make_account(), "MAY", self.city, granted=["CAP_ROLE_ASSIGN"])

    def test_data_rules(self):
        with self.assertRaises(ValidationError):
            GeographicScope.objects.create(type="district", name="No parent")
        with self.assertRaises(ValidationError):
            GeographicScope.objects.create(type="district", parent=self.uc1, name="Wider than its parent")
        with self.assertRaises(RuntimeError):
            self.rep.delete()
        with transaction.atomic(), self.assertRaises(IntegrityError):
            self.assign(self.rep.staff_account, "REP", self.uc1)  # a second active duplicate
        with transaction.atomic(), self.assertRaises(IntegrityError):
            self.assign(self.make_account(), "CON", self.district)  # a contractor names its organisation


class AccountStatusTests(StaffFixtures, ReportingTestCase):
    def setUp(self):
        super().setUp()
        self.make_scopes()
        self.admin = self.assign(self.make_account("Admin"), "MAY", self.city, granted=["CAP_ACCOUNT_ADMIN"])

    def test_suspension_ends_every_session_at_once(self):  # TEST-RBAC-010
        rep = self.assign(self.make_account("Rep"), "REP", self.uc1)
        self.acting(rep)
        self.acting(rep)
        change_account_status(rep.staff_account_id, "SUSPENDED", by_account_id=self.admin.staff_account_id,
                              reason="Synthetic test")
        sessions = AuthSession.objects.filter(subject_id=rep.staff_account_id)
        self.assertEqual(sessions.count(), 2)
        self.assertFalse(sessions.filter(revoked_at__isnull=True).exists())
        self.assertEqual(AuditEvent.objects.filter(action="account_suspended").get().details["sessions_ended"], 2)
        principal, session = self.acting(rep)
        with self.assertRaises(ApiError):
            authorization.authorize(principal, session, rep.id, "field_verify")

    def test_the_last_account_admin_cannot_be_removed(self):
        with self.assertRaises(ApiError) as caught:
            change_account_status(self.admin.staff_account_id, "REVOKED", by_account_id=self.admin.staff_account_id,
                                  reason="Synthetic test")
        self.assertEqual(caught.exception.code, "E_LAST_ACCOUNT_ADMIN")
        second = self.assign(self.make_account("Admin 2"), "MAY", self.city, granted=["CAP_ACCOUNT_ADMIN"])
        change_account_status(self.admin.staff_account_id, "REVOKED", by_account_id=second.staff_account_id,
                              reason="Synthetic test")
        with self.assertRaises(ApiError) as caught:
            change_account_status(second.staff_account_id, "SUSPENDED", by_account_id=second.staff_account_id,
                                  reason="Synthetic test")
        self.assertEqual(caught.exception.code, "E_LAST_ACCOUNT_ADMIN")

    def test_a_reason_is_required(self):
        rep = self.assign(self.make_account("Rep"), "REP", self.uc1)
        for reason in ("", "   ", None):
            with self.assertRaises(ApiError):
                change_account_status(rep.staff_account_id, "SUSPENDED", by_account_id=self.admin.staff_account_id,
                                      reason=reason)
