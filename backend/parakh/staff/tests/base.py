"""Shared staff fixtures: a scope tree, accounts, role assignments and sessions. All synthetic."""
from datetime import timedelta
from types import SimpleNamespace

import uuid

from django.utils import timezone
from rest_framework.test import APIClient

from parakh.authentication.models import AuthSession
from parakh.authentication.tokens import issue_session
from parakh.drafts.models import EvidenceObject
from parakh.reports.models import CivicReport
from parakh.staff.models import ContractorOrganization, GeographicScope, RoleAssignment, StaffAccount


class StaffFixtures:
    def make_scopes(self):
        self.city = GeographicScope.objects.create(type="city", name="Synthetic City")
        self.district = GeographicScope.objects.create(type="district", parent=self.city, name="District A")
        self.tehsil = GeographicScope.objects.create(type="tehsil", parent=self.district, name="Tehsil A1")
        self.uc1 = GeographicScope.objects.create(type="union_council", parent=self.tehsil, name="UC 1")
        self.uc2 = GeographicScope.objects.create(type="union_council", parent=self.tehsil, name="UC 2")
        self.other_district = GeographicScope.objects.create(type="district", parent=self.city, name="District B")

    def make_org(self, status="APPROVED", approved_categories=("water", "drainage"), **extra):
        now = timezone.now()
        org = ContractorOrganization.objects.create(
            legal_name="Synthetic Works Ltd", status=status, valid_from=now - timedelta(days=1),
            valid_until=now + timedelta(days=365), approved_categories=list(approved_categories), **extra,
        )
        org.service_areas.add(self.district)
        return org

    def make_account(self, name="Staff", status="ACTIVE", organization=None):
        return StaffAccount.objects.create(display_name=name, status=status, organization=organization,
                                           invited_at=timezone.now())

    def assign(self, account, role, scope, organization=None, granted=(), status="ACTIVE", days=30):
        now = timezone.now()
        return RoleAssignment.objects.create(
            staff_account=account, role=role, scope=scope, organization=organization, status=status,
            valid_from=now - timedelta(minutes=1), valid_until=now + timedelta(days=days),
            granted_capabilities=list(granted), assigned_at=now,
        )

    def acting(self, assignment):
        """A staff session acting as `assignment`, with the login OTP just satisfied."""
        issue_session("staff", assignment.staff_account_id, AuthSession.Method.STAFF_PASSWORD_OTP)
        session = AuthSession.objects.filter(subject_id=assignment.staff_account_id).order_by("-issued_at").first()
        session.acting_role_assignment_id = assignment.id
        session.save(update_fields=["acting_role_assignment_id"])
        principal = SimpleNamespace(is_authenticated=True, subject_type="staff",
                                    subject_id=assignment.staff_account_id,
                                    acting_role_assignment_id=assignment.id)
        return principal, session

    def place(self, report_id, scope):
        CivicReport.objects.filter(id=report_id).update(uc_scope_id=scope.id)
        return CivicReport.objects.get(id=report_id)

    def client_for(self, assignment, header=True):
        """An HTTP client signed in as the assignment's account, acting in it (Bearer + the acting-role header)."""
        body = issue_session("staff", assignment.staff_account_id, AuthSession.Method.STAFF_PASSWORD_OTP)
        AuthSession.objects.filter(subject_id=assignment.staff_account_id).order_by("-issued_at").update(
            acting_role_assignment_id=assignment.id
        )
        client = APIClient()
        extra = {"HTTP_AUTHORIZATION": f"Bearer {body['access_token']}"}
        if header:
            extra["HTTP_X_ACTING_ROLE_ASSIGNMENT_ID"] = str(assignment.id)
        client.credentials(**extra)
        return client

    def staff_evidence(self, report_id, assignment, kind="photo"):
        """A sealed photo this staff account captured for the report (synthetic; no bytes needed here)."""
        evidence = EvidenceObject.objects.create(
            submission=None, client_evidence_id=uuid.uuid4(), report_id=report_id, kind=kind,
            mime_type="image/jpeg", byte_size=1000, declared_sha256="0" * 64, sha256="0" * 64, chunk_count=1,
            captured_at=timezone.now(), storage_key=uuid.uuid4().hex, status="COMPLETE", uploaded_by_kind="staff",
            uploaded_by_account_id=assignment.staff_account_id, created_at=timezone.now(),
            completed_at=timezone.now(), sealed_at=timezone.now(),
        )
        return str(evidence.id)
