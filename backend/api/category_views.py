"""Read-only active-workspace category directory."""

from django.utils.decorators import method_decorator

from categories.services import CategoryAccessDenied, get_categories_for_workspace
from workspaces.context import WorkspaceContextError, resolve_active_workspace_context
from workspaces.permissions import WorkspacePermissionDenied, can_perform_operational_work, require_workspace_permission

from .auth_views import JsonMethodView, require_api_auth
from .http import json_data, json_error


READ_FIELDS = ("public_id", "name", "description", "default_deductible", "monthly_budget", "status")


def _selectable_only(request):
    if not request.GET:
        return False, None
    if set(request.GET) != {"selectable_only"} or len(request.GET.getlist("selectable_only")) != 1:
        return None, json_error("invalid_request", status=400)
    value = request.GET["selectable_only"]
    if value not in ("true", "false"):
        return None, json_error("invalid_request", status=400)
    return value == "true", None


class CategoryListView(JsonMethodView):
    @method_decorator(require_api_auth)
    def get(self, request):
        selectable_only, error_response = _selectable_only(request)
        if error_response is not None:
            return error_response
        try:
            context = resolve_active_workspace_context(request)
            require_workspace_permission(context.membership, can_perform_operational_work)
            categories = get_categories_for_workspace(context, selectable_only=selectable_only).order_by("name", "pk")
        except (CategoryAccessDenied, WorkspacePermissionDenied):
            return json_error("permission_denied", status=403)
        except WorkspaceContextError:
            return json_error("workspace_required", status=400)
        return json_data({"items": list(categories.values(*READ_FIELDS))})
