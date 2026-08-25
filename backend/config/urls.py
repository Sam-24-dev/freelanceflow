"""URL configuration for the Django project."""

from django.urls import include, path

urlpatterns = [
    path("api/v1/", include("api.urls")),
]

handler400 = "api.http.bad_request"
handler403 = "api.http.permission_denied"
handler404 = "api.http.page_not_found"
handler500 = "api.http.server_error"
