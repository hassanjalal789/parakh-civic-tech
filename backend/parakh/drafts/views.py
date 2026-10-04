"""Citizen draft routes (API Contract §5, §6). Transport class: Citizen-authenticated.

Bodies on these routes carry evidence and rendering text, so nothing here
logs a request body, and every response is `Cache-Control: no-store`
(API Contract §2.1).
"""
import uuid

from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from parakh.accounts.views import IsCitizen
from parakh.core.errors import ApiError

from . import services


def no_store(response: Response) -> Response:
    response["Cache-Control"] = "no-store"
    return response


def idempotency_key(request, header: str) -> uuid.UUID:
    """The operation's own header (DG-10 proposal), or the single X-Idempotency-Key the contract also names."""
    raw = request.headers.get(header) or request.headers.get("X-Idempotency-Key")
    try:
        key = uuid.UUID(raw or "")
    except ValueError:
        raise ApiError("E_VALIDATION", "Some information is missing or invalid.", 400, field="idempotency_key") from None
    if key.version != 4:
        raise ApiError("E_VALIDATION", "Some information is missing or invalid.", 400, field="idempotency_key")
    return key


class CitizenView(APIView):
    permission_classes = [IsCitizen]


class DraftsView(CitizenView):
    """API-130 `POST /citizen/drafts` — open a draft, idempotent on client_submission_id."""

    def post(self, request):
        draft, created = services.open_draft(request.user, request.data)
        code = status.HTTP_201_CREATED if created else status.HTTP_200_OK
        return no_store(Response(services.draft_body(draft), status=code))


class DraftView(CitizenView):
    """API-133 `GET` — poll the draft. `DELETE` — cancel it (DG-55; named by path, no API number).

    Cancellation before final submission purges the temporary content. After a successful
    submission it changes nothing and answers 409 E_ALREADY_SUBMITTED with the reference.
    """

    def get(self, request, client_submission_id):
        return no_store(Response(services.draft_body(services.owned_draft(request.user, client_submission_id))))

    def delete(self, request, client_submission_id):
        services.cancel_draft(request.user, client_submission_id)
        return Response(status=status.HTTP_204_NO_CONTENT)


class EvidenceView(CitizenView):
    """API-131 `POST /citizen/drafts/{client_submission_id}/evidence` — one evidence chunk."""

    def post(self, request, client_submission_id):
        return no_store(Response(services.receive_chunk(request.user, client_submission_id, request.data)))


class EvidenceCompleteView(CitizenView):
    """API-132 `POST /citizen/drafts/{client_submission_id}/evidence/complete` — finalise the manifest."""

    def post(self, request, client_submission_id):
        draft = services.complete_manifest(request.user, client_submission_id, request.data)
        return no_store(Response(services.draft_body(draft)))


class RenderingView(CitizenView):
    """API-134 `GET /citizen/drafts/{client_submission_id}/rendering` — the active version."""

    def get(self, request, client_submission_id):
        draft = services.owned_draft(request.user, client_submission_id)
        artifact = services.active_artifact(draft)
        if artifact is None:
            raise services.not_found()
        return no_store(Response(services.rendering_body(artifact)))


class RenderingCorrectionView(CitizenView):
    """`POST /citizen/drafts/{client_submission_id}/rendering/corrections` — PROPOSED, no API number (DG-43)."""

    def post(self, request, client_submission_id):
        artifact = services.correct_rendering(request.user, client_submission_id, request.data)
        return no_store(Response(services.rendering_body(artifact), status=status.HTTP_201_CREATED))


class RenderingConfirmView(CitizenView):
    """API-135 `POST /citizen/drafts/{client_submission_id}/rendering/confirm` — one exact version."""

    def post(self, request, client_submission_id):
        key = idempotency_key(request, "X-Confirmation-Idempotency-Key")
        confirmation, created = services.confirm_rendering(
            request.user, client_submission_id, request.data, key, request.headers.get("X-Client-App-Version", "")
        )
        body = {
            "rendering_confirmation_id": str(confirmation.id),
            "client_submission_id": str(confirmation.submission.client_submission_id),
            "voice_transcription_artifact_id": str(confirmation.artifact_id),
            "rendering_version": confirmation.rendering_version,
            "rendering_content_hash": confirmation.rendering_content_hash,
            "confirmed_at": confirmation.confirmed_at.isoformat(),
            "pipeline_state": confirmation.submission.pipeline_state,
        }
        return no_store(Response(body, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK))
