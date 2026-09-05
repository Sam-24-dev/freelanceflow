"""URL configuration for the Django project."""

from django.urls import include, path, re_path
from django.views.generic import RedirectView, TemplateView


FRONTEND_PAGES = (
    "acceso",
    "ajustes",
    "bitacora",
    "categorias",
    "clientes",
    "configuracion-fiscal",
    "cuenta",
    "dashboard",
    "facturas",
    "notificaciones",
    "propuestas",
    "proyectos",
    "reportes",
    "servicios",
    "transacciones",
)
ASSET_ALIAS_PATH = r"(?P<path>(?!.*\.\.)[A-Za-z0-9][A-Za-z0-9._/-]*)"

urlpatterns = [
    path("api/v1/", include("api.urls")),
    path("", TemplateView.as_view(template_name="index.html")),
    path("index.html", TemplateView.as_view(template_name="index.html")),
    path("site.webmanifest", TemplateView.as_view(
        template_name="site.webmanifest", content_type="application/manifest+json"
    )),
    path("robots.txt", TemplateView.as_view(
        template_name="robots.txt", content_type="text/plain; charset=utf-8"
    )),
    re_path(
        rf"^assets/{ASSET_ALIAS_PATH}$",
        RedirectView.as_view(url="/static/assets/%(path)s", permanent=True),
    ),
    re_path(
        rf"^img/{ASSET_ALIAS_PATH}$",
        RedirectView.as_view(url="/static/img/%(path)s", permanent=True),
    ),
    *[
        path(f"pages/{page}.html", TemplateView.as_view(template_name=f"pages/{page}.html"))
        for page in FRONTEND_PAGES
    ],
]

handler400 = "api.http.bad_request"
handler403 = "api.http.permission_denied"
handler404 = "api.http.page_not_found"
handler500 = "api.http.server_error"
