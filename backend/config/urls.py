"""URL routes. Each route belongs to one transport class (API Contract §2)."""
from django.urls import path

from parakh.accounts import views as account_views
from parakh.authentication import views as auth_views
from parakh.core.views import health
from parakh.drafts import views as draft_views
from parakh.reports import views as report_views

urlpatterns = [
    path("health", health),  # Public, liveness only
    # Public-auth
    path("auth/citizen/otp/request", auth_views.CitizenOtpRequestView.as_view()),  # API-121
    path("auth/citizen/otp/verify", auth_views.CitizenOtpVerifyView.as_view()),  # API-122
    # Refresh-only
    path("auth/refresh", auth_views.RefreshView.as_view()),  # API-003
    # Bearer
    path("auth/logout", auth_views.LogoutView.as_view()),  # API-004
    path("auth/sessions", auth_views.SessionsView.as_view()),  # API-128
    # Citizen-authenticated
    path("citizen/profile", account_views.CitizenProfileView.as_view()),  # API-155 (read part)
    path("categories", report_views.CategoriesView.as_view()),  # PROPOSED path (DG-43)
    path("citizen/drafts", draft_views.DraftsView.as_view()),  # API-130
    path("citizen/drafts/<uuid:client_submission_id>", draft_views.DraftView.as_view()),  # API-133
    path("citizen/drafts/<uuid:client_submission_id>/evidence", draft_views.EvidenceView.as_view()),  # API-131
    path(
        "citizen/drafts/<uuid:client_submission_id>/evidence/complete", draft_views.EvidenceCompleteView.as_view()
    ),  # API-132
    path("citizen/drafts/<uuid:client_submission_id>/rendering", draft_views.RenderingView.as_view()),  # API-134
    path(
        "citizen/drafts/<uuid:client_submission_id>/rendering/corrections",
        draft_views.RenderingCorrectionView.as_view(),
    ),  # PROPOSED path (DG-43)
    path(
        "citizen/drafts/<uuid:client_submission_id>/rendering/confirm", draft_views.RenderingConfirmView.as_view()
    ),  # API-135
    path("citizen/reports", report_views.ReportsView.as_view()),  # API-140 (POST), API-150 (GET)
    path("citizen/reports/summary", report_views.ReportsSummaryView.as_view()),  # PROPOSED path (DG-43)
    path("citizen/reports/<uuid:report_id>", report_views.ReportDetailView.as_view()),  # API-151
    path("citizen/reports/<uuid:report_id>/confirm", report_views.ResolutionView.as_view()),  # API-153
    path("citizen/reports/<uuid:report_id>/dispute", report_views.DisputeView.as_view()),  # API-154
    path(
        "citizen/reports/<uuid:report_id>/evidence/<uuid:evidence_id>",
        report_views.ReportEvidenceContentView.as_view(),
    ),  # PROPOSED path (DG-43)
]
