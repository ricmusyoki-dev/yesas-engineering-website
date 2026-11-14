from django.core.exceptions import ValidationError

from services.models import Service

from .models import ProjectCategory, ProjectRevision, ProjectTag


def validate_publish_relationships(revision: ProjectRevision) -> None:
    if revision.category_id:
        category = ProjectCategory.objects.select_for_update().get(
            pk=revision.category_id
        )
        if not category.is_active:
            raise ValidationError(
                {"category": "A project cannot be published in an inactive category."}
            )

    service_ids = set(revision.related_services.values_list("pk", flat=True))
    active_service_ids = set(
        Service.objects.select_for_update()
        .filter(pk__in=service_ids, is_archived=False)
        .values_list("pk", flat=True)
    )
    if service_ids != active_service_ids:
        raise ValidationError(
            {"related_services": "Archived services cannot be linked to a project."}
        )

    tag_ids = set(revision.tags.values_list("pk", flat=True))
    active_tag_ids = set(
        ProjectTag.objects.select_for_update()
        .filter(pk__in=tag_ids, is_active=True)
        .values_list("pk", flat=True)
    )
    if tag_ids != active_tag_ids:
        raise ValidationError(
            {"tags": "Inactive tags cannot be published with a project."}
        )
