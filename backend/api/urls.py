from django.urls import path

from .auth_views import SessionLoginView, SessionLogoutView, SessionView

app_name = "api"

urlpatterns = [
    path("session/", SessionView.as_view(), name="session"),
    path("session/login/", SessionLoginView.as_view(), name="session-login"),
    path("session/logout/", SessionLogoutView.as_view(), name="session-logout"),
]
