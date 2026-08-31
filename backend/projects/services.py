from django.db import IntegrityError, transaction
from django.utils import timezone

from proposals.models import Proposal
from proposals.services import transition_proposal
from workspaces.context import ActiveWorkspaceContext
from workspaces.models import Membership, Workspace
from workspaces.permissions import can_perform_operational_work

from .models import Project, _project_service_write_boundary


class ProjectAccessDenied(PermissionError):
    """Raised when a caller lacks Project business access."""


class ProjectTransitionError(ValueError):
    """Raised when Project conversion or lifecycle rules are violated."""


def _authorize(context: ActiveWorkspaceContext) -> Workspace:
    try:
        membership = Membership.objects.get(pk=context.membership.pk, workspace=context.workspace)
    except Membership.DoesNotExist as error:
        raise ProjectAccessDenied("Active workspace membership is required.") from error
    if not can_perform_operational_work(membership):
        raise ProjectAccessDenied("Project access requires an owner or operational membership.")
    return context.workspace


def get_projects_for_workspace(context: ActiveWorkspaceContext):
    """Return projects visible to an authorized active workspace context."""
    return Project.objects.for_workspace(_authorize(context))


def _proposal_for_workspace(workspace: Workspace, proposal: Proposal) -> Proposal:
    try:
        return Proposal.objects.for_workspace(workspace).select_for_update().get(pk=proposal.pk)
    except Proposal.DoesNotExist as error:
        raise ProjectAccessDenied("Proposal is not available in the active workspace.") from error


def _project_for_workspace(workspace: Workspace, project: Project, *, lock=False) -> Project:
    queryset = Project.objects.for_workspace(workspace)
    if lock:
        queryset = queryset.select_for_update()
    try:
        return queryset.get(pk=project.pk)
    except Project.DoesNotExist as error:
        raise ProjectAccessDenied("Project is not available in the active workspace.") from error


def convert_accepted_proposal(context: ActiveWorkspaceContext, proposal: Proposal) -> Project:
    """Atomically convert one accepted proposal, returning the same Project on retry."""
    workspace = _authorize(context)
    with transaction.atomic():
        locked_proposal = _proposal_for_workspace(workspace, proposal)
        try:
            return Project.objects.for_workspace(workspace).get(proposal=locked_proposal)
        except Project.DoesNotExist:
            pass
        if locked_proposal.status != Proposal.Status.ACCEPTED:
            raise ProjectTransitionError("Only accepted proposals can be converted.")
        try:
            with transaction.atomic(), _project_service_write_boundary():
                project = Project.objects.create(
                    workspace=locked_proposal.workspace,
                    client=locked_proposal.client,
                    proposal=locked_proposal,
                )
        except IntegrityError:
            try:
                return Project.objects.for_workspace(workspace).get(proposal=locked_proposal)
            except Project.DoesNotExist:
                raise
        transition_proposal(context, locked_proposal, Proposal.Status.CONVERTED)
        return project


def transition_project(context: ActiveWorkspaceContext, project: Project, target_status: str) -> Project:
    workspace = _authorize(context)
    transitions = {
        Project.Status.ACTIVE: {
            Project.Status.COMPLETED: "completed_at",
            Project.Status.CANCELLED: "cancelled_at",
        },
    }
    with transaction.atomic():
        project = _project_for_workspace(workspace, project, lock=True)
        timestamp_field = transitions.get(project.status, {}).get(target_status)
        if timestamp_field is None:
            raise ProjectTransitionError("Invalid project lifecycle transition.")
        project.status = target_status
        setattr(project, timestamp_field, timezone.now())
        with _project_service_write_boundary():
            project.save(update_fields=["status", timestamp_field, "updated_at"])
    return project


def archive_project(context: ActiveWorkspaceContext, project: Project) -> Project:
    workspace = _authorize(context)
    with transaction.atomic():
        project = _project_for_workspace(workspace, project, lock=True)
        if project.status not in (Project.Status.COMPLETED, Project.Status.CANCELLED):
            raise ProjectTransitionError("Only terminal projects can be archived.")
        project.archived_at = timezone.now()
        with _project_service_write_boundary():
            project.save(update_fields=["archived_at", "updated_at"])
    return project
