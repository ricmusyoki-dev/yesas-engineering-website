from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from .models import (
    PROJECT_CONTENT_FIELDS,
    Project,
    ProjectAvailability,
    ProjectCategory,
    ProjectRevision,
    ProjectRevisionStatus,
    ProjectTag,
)
from .validators import validate_publish_relationships


class ActiveProjectDraftExists(Exception):
    pass


class ProjectSlugConflict(Exception):
    pass


def _set_revision_relations(revision, source):
    revision.related_services.set(source.related_services.all())
    revision.tags.set(source.tags.all())


def _assign_revision_relations(revision, services, tags):
    if len(services) > 20:
        raise ValidationError(
            {"related_services": "Select no more than 20 related services."}
        )
    if len(tags) > 20:
        raise ValidationError({"tags": "Select no more than 20 project tags."})
    revision.save()
    revision.related_services.set(services)
    revision.tags.set(tags)


def create_project_draft(slug: str, user, content: dict) -> ProjectRevision:
    content = content.copy()
    services = content.pop("related_services", ())
    tags = content.pop("tags", ())
    try:
        with transaction.atomic():
            project = Project(
                slug=slug,
                created_by=user,
                updated_by=user,
            )
            project.full_clean()
            project.save()
            revision = ProjectRevision(
                project=project,
                status=ProjectRevisionStatus.DRAFT,
                created_by=user,
                updated_by=user,
                **content,
            )
            revision.full_clean()
            _assign_revision_relations(revision, services, tags)
            return revision
    except IntegrityError as error:
        raise ProjectSlugConflict from error


def create_revision_draft(project: Project, user) -> ProjectRevision:
    try:
        with transaction.atomic():
            locked_project = Project.objects.select_for_update().get(pk=project.pk)
            if locked_project.availability == ProjectAvailability.ARCHIVED:
                raise ValidationError("Archived projects cannot be edited.")
            if locked_project.revisions.filter(
                status=ProjectRevisionStatus.DRAFT
            ).exists():
                raise ActiveProjectDraftExists

            published = locked_project.revisions.filter(
                status=ProjectRevisionStatus.PUBLISHED
            ).first()
            values = (
                {
                    field: getattr(published, field)
                    for field in PROJECT_CONTENT_FIELDS
                }
                if published
                else {}
            )
            revision = ProjectRevision(
                project=locked_project,
                status=ProjectRevisionStatus.DRAFT,
                created_by=user,
                updated_by=user,
                **values,
            )
            revision.full_clean()
            revision.save()
            if published:
                _set_revision_relations(revision, published)
            return revision
    except IntegrityError as error:
        raise ActiveProjectDraftExists from error


def publish_project_draft(project: Project, user) -> ProjectRevision | None:
    with transaction.atomic():
        locked_project = Project.objects.select_for_update().get(pk=project.pk)
        if locked_project.availability == ProjectAvailability.ARCHIVED:
            raise ValidationError("Archived projects cannot be published.")
        draft = (
            ProjectRevision.objects.select_for_update()
            .filter(
                project=locked_project,
                status=ProjectRevisionStatus.DRAFT,
            )
            .first()
        )
        if draft is None:
            return None

        draft.status = ProjectRevisionStatus.PUBLISHED
        draft.published_by = user
        draft.published_at = timezone.now()
        draft.updated_by = user
        draft.full_clean(validate_constraints=False)
        validate_publish_relationships(draft)

        ProjectRevision.objects.select_for_update().filter(
            project=locked_project,
            status=ProjectRevisionStatus.PUBLISHED,
        ).update(
            status=ProjectRevisionStatus.ARCHIVED,
            updated_by=user,
            updated_at=timezone.now(),
        )
        draft.save()
        locked_project.updated_by = user
        locked_project.save(update_fields=("updated_by", "updated_at"))
        return draft


def restore_project_revision(
    revision: ProjectRevision, user
) -> ProjectRevision:
    if revision.status != ProjectRevisionStatus.ARCHIVED:
        raise ValidationError("Only archived revisions can be restored.")
    try:
        with transaction.atomic():
            project = Project.objects.select_for_update().get(pk=revision.project_id)
            if project.availability == ProjectAvailability.ARCHIVED:
                raise ValidationError("Archived projects cannot receive a draft.")
            if project.revisions.filter(status=ProjectRevisionStatus.DRAFT).exists():
                raise ActiveProjectDraftExists

            values = {
                field: getattr(revision, field) for field in PROJECT_CONTENT_FIELDS
            }
            restored = ProjectRevision(
                project=project,
                status=ProjectRevisionStatus.DRAFT,
                created_by=user,
                updated_by=user,
                **values,
            )
            restored.full_clean()
            restored.save()
            _set_revision_relations(restored, revision)
            return restored
    except IntegrityError as error:
        raise ActiveProjectDraftExists from error


def discard_project_draft(project: Project) -> bool:
    with transaction.atomic():
        locked_project = Project.objects.select_for_update().get(pk=project.pk)
        draft = (
            ProjectRevision.objects.select_for_update()
            .filter(
                project=locked_project,
                status=ProjectRevisionStatus.DRAFT,
            )
            .first()
        )
        if draft is None:
            return False
        draft.delete()
        return True


def archive_project(project: Project, user) -> Project:
    with transaction.atomic():
        project = Project.objects.select_for_update().get(pk=project.pk)
        if project.availability == ProjectAvailability.ARCHIVED:
            raise ValidationError("Project is already archived.")
        project.availability = ProjectAvailability.ARCHIVED
        project.archived_by = user
        project.archived_at = timezone.now()
        project.updated_by = user
        project.save(
            update_fields=(
                "availability",
                "archived_by",
                "archived_at",
                "updated_by",
                "updated_at",
            )
        )
        return project


def set_project_availability(
    project: Project, user, availability: str
) -> Project:
    if availability not in (
        ProjectAvailability.ENABLED,
        ProjectAvailability.DISABLED,
    ):
        raise ValidationError(
            {"availability": "Choose enabled or disabled availability."}
        )
    with transaction.atomic():
        project = Project.objects.select_for_update().get(pk=project.pk)
        if project.availability == ProjectAvailability.ARCHIVED:
            raise ValidationError("Archived projects cannot be enabled or disabled.")
        if not project.revisions.filter(
            status=ProjectRevisionStatus.PUBLISHED
        ).exists():
            raise ValidationError(
                {"availability": "Only published projects can be enabled or disabled."}
            )
        project.availability = availability
        project.updated_by = user
        project.save(update_fields=("availability", "updated_by", "updated_at"))
        return project


def update_project_category(
    category: ProjectCategory, user, **changes
) -> ProjectCategory:
    with transaction.atomic():
        category = ProjectCategory.objects.select_for_update().get(pk=category.pk)
        for field in ("name", "slug", "description", "display_order", "is_active"):
            if field in changes:
                setattr(category, field, changes[field])
        category.updated_by = user
        category.full_clean()
        category.save()
        return category


def update_project_tag(tag: ProjectTag, user, **changes) -> ProjectTag:
    with transaction.atomic():
        tag = ProjectTag.objects.select_for_update().get(pk=tag.pk)
        for field in ("name", "slug", "is_active"):
            if field in changes:
                setattr(tag, field, changes[field])
        tag.updated_by = user
        tag.full_clean()
        tag.save()
        return tag
