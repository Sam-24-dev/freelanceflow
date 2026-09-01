"""Read-only active-workspace fiscal configuration endpoint."""

from django.utils.decorators import method_decorator

from fiscal.services import (
    FiscalAccessDenied,
    FiscalConfigurationNotConfigured,
    get_current_fiscal_configuration,
)
from workspaces.context import WorkspaceContextError, resolve_active_workspace_context
from workspaces.permissions import WorkspacePermissionDenied

from .auth_views import JsonMethodView, require_api_auth
from .http import json_data, json_error


READ_FIELDS = (
    "public_id",
    "version",
    "legal_name",
    "tax_identifier",
    "tax_regime",
    "applies_vat",
    "vat_rate",
    "withholding_rate",
)


def _serialize(configuration):
    return {field: getattr(configuration, field) for field in READ_FIELDS}


class FiscalConfigurationView(JsonMethodView):
    @method_decorator(require_api_auth)
    def get(self, request):
        if request.GET:
            return json_error("invalid_request", status=400)
        try:
            context = resolve_active_workspace_context(request)
            configuration = get_current_fiscal_configuration(context)
        except WorkspacePermissionDenied:
            return json_error("permission_denied", status=403)
        except FiscalAccessDenied:
            return json_error("permission_denied", status=403)
        except FiscalConfigurationNotConfigured:
            return json_error("fiscal_configuration_not_configured", status=404)
        except WorkspaceContextError:
            return json_error("workspace_required", status=400)
        return json_data(_serialize(configuration))
