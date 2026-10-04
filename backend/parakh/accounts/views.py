"""Citizen-authenticated account routes."""
from rest_framework.permissions import BasePermission
from rest_framework.response import Response
from rest_framework.views import APIView

from parakh.identity_vault.services import masked_number_for

from .models import CitizenAccount


class IsCitizen(BasePermission):
    """Transport class 2 — Citizen-authenticated. A staff session is refused."""

    def has_permission(self, request, view):
        return bool(request.user and getattr(request.user, "subject_type", None) == "citizen")


class CitizenProfileView(APIView):
    """API-155 `GET /citizen/profile` — the citizen's own masked number only.

    PATCH (preferred_language) is not implemented yet.
    """

    permission_classes = [IsCitizen]

    def get(self, request):
        account = CitizenAccount.objects.get(id=request.user.subject_id)
        consents = {
            c.consent_type: {"version": c.consent_version, "granted": c.granted_at is not None and c.withdrawn_at is None}
            for c in account.consents.order_by("granted_at")
        }
        response = Response(
            {
                "masked_mobile_number": masked_number_for(account.id),
                "preferred_language": account.preferred_language,
                "status": account.status,
                "consents": consents,
            }
        )
        response["Cache-Control"] = "no-store"
        return response
