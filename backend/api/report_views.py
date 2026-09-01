"""Read-only active-workspace cash activity reporting."""

import re
from datetime import date
from decimal import Decimal

from django.utils.decorators import method_decorator

from reports.services import (
    CashActivityAccessDenied,
    CashActivityValidationError,
    get_cash_activity_report,
)
from workspaces.context import WorkspaceContextError, resolve_active_workspace_context

from .auth_views import JsonMethodView, require_api_auth
from .http import json_data, json_error


DATE_PATTERN = re.compile(r"\d{4}-\d{2}-\d{2}\Z")
MAX_PERIOD_DAYS = 366


def _period(request):
    if set(request.GET) != {"start_date", "end_date"}:
        return None, json_error("invalid_request", status=400)
    if any(len(request.GET.getlist(key)) != 1 for key in ("start_date", "end_date")):
        return None, json_error("invalid_request", status=400)
    try:
        start_value = request.GET["start_date"]
        end_value = request.GET["end_date"]
        if not DATE_PATTERN.fullmatch(start_value) or not DATE_PATTERN.fullmatch(end_value):
            raise ValueError
        start_date = date.fromisoformat(start_value)
        end_date = date.fromisoformat(end_value)
        if (
            end_date < start_date
            or end_date == date.max
            or (end_date - start_date).days + 1 > MAX_PERIOD_DAYS
        ):
            raise ValueError
    except (KeyError, TypeError, ValueError):
        return None, json_error("invalid_request", status=400)
    return (start_date, end_date), None


def _money(value: Decimal) -> str:
    return f"{value:.2f}"


def _group(item):
    return {
        "cash_in": _money(item.cash_in),
        "cash_out": _money(item.cash_out),
        "net": _money(item.net),
    }


def _serialize(report):
    return {
        "start_date": report.start_date.isoformat(),
        "end_date": report.end_date.isoformat(),
        "timezone": report.timezone,
        "as_of": report.as_of.isoformat(),
        "cash_in": _money(report.cash_in),
        "cash_out": _money(report.cash_out),
        "net": _money(report.net),
        "by_client": [_group(item) for item in report.by_client],
        "by_project": [_group(item) for item in report.by_project],
        "by_category": [_group(item) for item in report.by_category],
    }


class CashActivityReportView(JsonMethodView):
    @method_decorator(require_api_auth)
    def get(self, request):
        period, error_response = _period(request)
        if error_response is not None:
            return error_response
        try:
            context = resolve_active_workspace_context(request)
            report = get_cash_activity_report(
                context,
                start_date=period[0],
                end_date=period[1],
            )
        except CashActivityValidationError:
            return json_error("invalid_request", status=400)
        except CashActivityAccessDenied:
            return json_error("permission_denied", status=403)
        except WorkspaceContextError:
            return json_error("workspace_required", status=400)
        return json_data(_serialize(report))
