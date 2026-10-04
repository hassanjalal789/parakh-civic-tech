"""URL routes. Each route belongs to one transport class (API Contract §2)."""
from django.urls import path

from parakh.accounts import views as account_views
from parakh.authentication import views as auth_views
from parakh.core.views import health

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
]
