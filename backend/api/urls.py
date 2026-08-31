from django.urls import path

from .auth_views import SessionLoginView, SessionLogoutView, SessionView
from .client_views import ClientListView
from .invoice_views import InvoiceListView
from .notification_views import NotificationListView
from .payment_views import PaymentListView
from .proposal_views import ProposalListView
from .project_views import ProjectListView
from .service_views import ServiceListView
from .workspace_views import ActiveWorkspaceSelectionView, WorkspaceListView

app_name = "api"

urlpatterns = [
    path("session/", SessionView.as_view(), name="session"),
    path("session/login/", SessionLoginView.as_view(), name="session-login"),
    path("session/logout/", SessionLogoutView.as_view(), name="session-logout"),
    path("workspaces/", WorkspaceListView.as_view(), name="workspace-list"),
    path("workspaces/active/", ActiveWorkspaceSelectionView.as_view(), name="workspace-active"),
    path("notifications/", NotificationListView.as_view(), name="notification-list"),
    path("payments/", PaymentListView.as_view(), name="payment-list"),
    path("clients/", ClientListView.as_view(), name="client-list"),
    path("services/", ServiceListView.as_view(), name="service-list"),
    path("proposals/", ProposalListView.as_view(), name="proposal-list"),
    path("projects/", ProjectListView.as_view(), name="project-list"),
    path("invoices/", InvoiceListView.as_view(), name="invoice-list"),
]
