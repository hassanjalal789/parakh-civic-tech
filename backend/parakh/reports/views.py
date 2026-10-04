"""Citizen report routes (API Contract §7, §8.1). Transport class: Citizen-authenticated."""
from django.conf import settings
from django.http import HttpResponse
from rest_framework import status
from rest_framework.response import Response

from parakh.drafts.services import draft_body
from parakh.drafts.storage import get_storage
from parakh.drafts.views import CitizenView, idempotency_key, no_store

from . import services
from .models import CivicReport


class ReportsView(CitizenView):
    """API-140 `POST /citizen/reports` (create) and API-150 `GET /citizen/reports` (own list)."""

    def post(self, request):
        body = request.data if isinstance(request.data, dict) else {}
        key = idempotency_key(request, "X-Submission-Idempotency-Key")
        report, created = services.create_citizen_report(request.user, body.get("client_submission_id"), key)
        code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return no_store(Response(services.creation_body(report), status=code))

    def get(self, request):
        reports = services.owned_reports(request.user).order_by("-created_at")
        drafts = [
            {
                "client_submission_id": d["client_submission_id"],
                "category": d["category"],
                "pipeline_state": d["pipeline_state"],
                "captured_at": d["captured_at"],
            }
            for d in (draft_body(x) for x in services.unsent_drafts(request.user))
        ]
        body = {"reports": [services.summary_item(r) for r in reports], "unsent_drafts": drafts}
        return no_store(Response(body))


class ReportDetailView(CitizenView):
    """API-151 `GET /citizen/reports/{id}` — own report only; anything else is the uniform 404."""

    def get(self, request, report_id):
        return no_store(Response(services.detail_body(services.owned_report(request.user, report_id))))


class ReportEvidenceContentView(CitizenView):
    """`GET /citizen/reports/{id}/evidence/{evidence_id}` — PROPOSED, no API number (DG-43).

    Streams the owner's own evidence, including the original recording, from
    write-once storage. Session-bound (Authorization header), never a public
    URL, never cached.
    """

    def get(self, request, report_id, evidence_id):
        evidence = services.owned_evidence(request.user, report_id, evidence_id)
        response = HttpResponse(get_storage().get_evidence(evidence.storage_key), content_type=evidence.mime_type)
        response["Cache-Control"] = "no-store"
        response["Content-Disposition"] = "inline"
        response["X-Content-Type-Options"] = "nosniff"
        return response


class ReportsSummaryView(CitizenView):
    """`GET /citizen/reports/summary` for CIT-06 — PROPOSED, no API number (DG-43). Counts only."""

    def get(self, request):
        reports = services.owned_reports(request.user)
        closed = [CivicReport.State.CLOSED, CivicReport.State.REJECTED, CivicReport.State.CANCELLED]
        body = {
            "reports": reports.count(),
            "open": reports.exclude(state__in=closed).count(),
            "awaiting_your_confirmation": reports.filter(state=CivicReport.State.PENDING_CITIZEN_CONFIRMATION).count(),
            "unsent_drafts": services.unsent_drafts(request.user).count(),
        }
        return no_store(Response(body))


class CategoriesView(CitizenView):
    """`GET /categories` for CIT-07 — PROPOSED, no API number (DG-43). Labels live in the client."""

    def get(self, request):
        body = {
            "version": settings.PARAKH_CATEGORIES_VERSION,
            "categories": [{"key": key} for key in settings.PARAKH_CATEGORIES],
        }
        return Response(body)
