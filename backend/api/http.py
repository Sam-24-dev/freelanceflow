from django.http import JsonResponse
from django.views import defaults as default_views
from django.views.csrf import csrf_failure as default_csrf_failure


def is_api_request(request) -> bool:
    return request.path.startswith("/api/v1/")


def json_response(data: dict, *, status: int = 200) -> JsonResponse:
    response = JsonResponse(data, status=status, content_type="application/json; charset=utf-8")
    response["Cache-Control"] = "no-store"
    return response


def json_data(data: dict, *, status: int = 200) -> JsonResponse:
    return json_response({"data": data}, status=status)


def json_error(code: str, *, status: int) -> JsonResponse:
    return json_response({"error": {"code": code}}, status=status)


def csrf_failure(request, reason=""):
    if is_api_request(request):
        return json_error("csrf_failed", status=403)
    return default_csrf_failure(request, reason=reason)


def bad_request(request, exception=None):
    if is_api_request(request):
        return json_error("bad_request", status=400)
    return default_views.bad_request(request, exception)


def permission_denied(request, exception=None):
    if is_api_request(request):
        return json_error("permission_denied", status=403)
    return default_views.permission_denied(request, exception)


def page_not_found(request, exception=None):
    if is_api_request(request):
        return json_error("not_found", status=404)
    return default_views.page_not_found(request, exception)


def server_error(request):
    if is_api_request(request):
        return json_error("internal_error", status=500)
    return default_views.server_error(request)
