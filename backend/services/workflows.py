from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from company.models import RevisionStatus

from .models import SERVICE_CONTENT_FIELDS, Service, ServiceCategory, ServiceRevision


class ActiveServiceDraftExists(Exception):
    pass


def create_service_draft(slug: str, user, content: dict) -> ServiceRevision:
    with transaction.atomic():
        service = Service(slug=slug, created_by=user, updated_by=user)
        service.full_clean()
        service.save()
        revision = ServiceRevision(
            service=service,
            status=RevisionStatus.DRAFT,
            created_by=user,
            updated_by=user,
        )
        revision.save()
        for field, value in content.items():
            setattr(revision, field, value)
        revision.full_clean()
        revision.save()
        return revision


def create_revision_draft(service: Service, user) -> ServiceRevision:
    try:
        with transaction.atomic():
            if service.is_archived:
                raise ValidationError("Archived services cannot be edited.")
            if service.revisions.filter(status=RevisionStatus.DRAFT).exists():
                raise ActiveServiceDraftExists
            published = service.revisions.filter(
                status=RevisionStatus.PUBLISHED
            ).first()
            values = (
                {field: getattr(published, field) for field in SERVICE_CONTENT_FIELDS}
                if published
                else {}
            )
            revision = ServiceRevision(
                service=service,
                status=RevisionStatus.DRAFT,
                created_by=user,
                updated_by=user,
                **values,
            )
            revision.full_clean()
            revision.save()
            return revision
    except IntegrityError as error:
        raise ActiveServiceDraftExists from error


def publish_service_draft(service: Service, user) -> ServiceRevision | None:
    with transaction.atomic():
        locked_service = Service.objects.select_for_update().get(pk=service.pk)
        if locked_service.is_archived:
            raise ValidationError("Archived services cannot be published.")
        draft = (
            ServiceRevision.objects.select_for_update()
            .filter(service=locked_service, status=RevisionStatus.DRAFT)
            .first()
        )
        if draft is None:
            return None

        draft.status = RevisionStatus.PUBLISHED
        draft.published_by = user
        draft.published_at = timezone.now()
        draft.updated_by = user
        draft.full_clean(validate_constraints=False)

        ServiceRevision.objects.select_for_update().filter(
            service=locked_service,
            status=RevisionStatus.PUBLISHED,
        ).update(
            status=RevisionStatus.ARCHIVED,
            updated_by=user,
            updated_at=timezone.now(),
        )
        draft.save()
        return draft


def restore_service_revision(revision: ServiceRevision, user) -> ServiceRevision:
    if revision.status != RevisionStatus.ARCHIVED:
        raise ValidationError("Only archived revisions can be restored.")
    if revision.service.is_archived:
        raise ValidationError("Archived services cannot receive a draft.")
    try:
        with transaction.atomic():
            if revision.service.revisions.filter(status=RevisionStatus.DRAFT).exists():
                raise ActiveServiceDraftExists
            restored = ServiceRevision(
                service=revision.service,
                status=RevisionStatus.DRAFT,
                created_by=user,
                updated_by=user,
                **{field: getattr(revision, field) for field in SERVICE_CONTENT_FIELDS},
            )
            restored.full_clean()
            restored.save()
            return restored
    except IntegrityError as error:
        raise ActiveServiceDraftExists from error


def archive_service(service: Service, user) -> Service:
    with transaction.atomic():
        service = Service.objects.select_for_update().get(pk=service.pk)
        if service.is_archived:
            raise ValidationError("Service is already archived.")
        service.is_archived = True
        service.archived_by = user
        service.archived_at = timezone.now()
        service.updated_by = user
        service.save(
            update_fields=(
                "is_archived",
                "archived_by",
                "archived_at",
                "updated_by",
                "updated_at",
            )
        )
        return service


def discard_service_draft(service: Service) -> bool:
    with transaction.atomic():
        draft = (
            ServiceRevision.objects.select_for_update()
            .filter(service=service, status=RevisionStatus.DRAFT)
            .first()
        )
        if draft is None:
            return False
        draft.delete()
        if not service.revisions.exists():
            service.delete()
        return True


def update_category(category: ServiceCategory, user, **changes) -> ServiceCategory:
    with transaction.atomic():
        category = ServiceCategory.objects.select_for_update().get(pk=category.pk)
        if "name" in changes:
            category.name = changes["name"]
        if "slug" in changes:
            category.slug = changes["slug"]
        if "description" in changes:
            category.description = changes["description"]
        if "display_order" in changes:
            category.display_order = changes["display_order"]
        if "is_active" in changes:
            category.is_active = changes["is_active"]
        category.updated_by = user
        category.full_clean()
        category.save()
        return category
