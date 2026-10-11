"""Staff report routes (API Contract §8.2). Transport class: Staff-authenticated with an acting role.

Every request carries `Authorization: Bearer` and `X-Acting-Role-Assignment-ID` — a claim, never a
grant; the six checks run in the workflow services. Responses are filtered on the server: a
contractor receives the work packet only (API Contract §9.1; DG-80, DG-83). No route here logs a
request body, and every response is `Cache-Control: no-store`.
"""
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from parakh.drafts.models import VoiceTranscriptionArtifact
from parakh.drafts.views import no_store

from . import workflow
from .models import CivicReport


class IsStaff(BasePermission):
    def has_permission(self, request, view):
        return bool(getattr(request.user, "is_authenticated", False)) and request.user.subject_type == "staff"


def state_body(report: CivicReport) -> dict:
    return {"report_id": str(report.id), "state": report.state, "state_version": report.state_version}


def work_packet(report: CivicReport) -> dict:
    """What a contractor needs to fix the issue and where — nothing about who reported it (API §9.1).

    Location: the citizen's final reported position only (DG-80); without coordinates, the written
    description (DG-83); a location given only by voice is marked so, with no recording (DG-83).
    Photos and video are not included until their redaction is decided (API §9.1, "redacted").
    """
    artifact = VoiceTranscriptionArtifact.objects.get(id=report.confirmed_rendering_artifact_id)
    if report.reported_latitude is not None and report.reported_longitude is not None:
        location = {"latitude": str(report.reported_latitude), "longitude": str(report.reported_longitude)}
    elif report.location_description:
        location = {"description": report.location_description}
    else:
        location = {"spoken_only": True}  # staff provide the operational location (DG-83)
    case = workflow.current_assignment(report)
    return {
        **state_body(report),
        "report_reference": report.report_reference,
        "category": report.category,
        "location": location,
        "urdu_civic_rendering": artifact.urdu_civic_rendering,
        "work_instructions": case.note if case else "",
    }


class StaffStepView(APIView):
    permission_classes = [IsStaff]
    step = None  # a workflow function
    packet = False  # contractor routes answer with the work packet

    def post(self, request, report_id):
        claim = request.headers.get("X-Acting-Role-Assignment-ID")
        report = type(self).step(request.user, request.auth, claim, report_id, request.data)
        return no_store(Response(work_packet(report) if self.packet else state_body(report)))


def step_view(function, packet=False):
    return type(f"{function.__name__.title()}View", (StaffStepView,), {"step": staticmethod(function),
                                                                         "packet": packet}).as_view()


class EligibleContractorsView(APIView):
    """`GET /reports/{id}/eligible-contractors` — PROPOSED, no API number (DG-43). The picker for API-163:
    eligible organisations only, in name order, never ranked or recommended (BR-020)."""

    permission_classes = [IsStaff]

    def get(self, request, report_id):
        claim = request.headers.get("X-Acting-Role-Assignment-ID")
        orgs = workflow.eligible_organisations(request.user, request.auth, claim, report_id)
        return no_store(Response({"contractors": [{"id": str(o.id), "legal_name": o.legal_name} for o in orgs]}))
