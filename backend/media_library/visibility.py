from django.db.models import Q

from company.models import (
    CompanyProfileMediaAttachment,
    CompanyProfileRevision,
    HomepageSectionMediaAttachment,
    RevisionStatus,
)
from projects.models import (
    ProjectAvailability,
    ProjectMediaAttachment,
    ProjectRevisionStatus,
)
from services.models import (
    ServiceMediaAttachment,
)

from .models import MediaAsset, MediaLifecycle


def has_public_reference(asset: MediaAsset) -> bool:
    project_reference = (
        ProjectMediaAttachment.objects.filter(
            asset=asset,
            revision__status=ProjectRevisionStatus.PUBLISHED,
            revision__project__availability=ProjectAvailability.ENABLED,
        )
        .filter(
            Q(revision__category__isnull=True)
            | Q(revision__category__is_active=True)
        )
        .exists()
    )
    if project_reference:
        return True

    service_reference = (
        ServiceMediaAttachment.objects.filter(
            asset=asset,
            revision__status=RevisionStatus.PUBLISHED,
            revision__is_enabled=True,
            revision__service__is_archived=False,
        )
        .filter(
            Q(revision__category__isnull=True)
            | Q(revision__category__is_active=True)
        )
        .exists()
    )
    if service_reference:
        return True

    return (
        CompanyProfileMediaAttachment.objects.filter(
            asset=asset,
            revision__scope=CompanyProfileRevision.COMPANY_SCOPE,
            revision__status=RevisionStatus.PUBLISHED,
        ).exists()
        or HomepageSectionMediaAttachment.objects.filter(
            asset=asset,
            revision__status=RevisionStatus.PUBLISHED,
            revision__is_visible=True,
        ).exists()
    )


def can_deliver_publicly(asset: MediaAsset) -> bool:
    return (
        asset.lifecycle == MediaLifecycle.ACTIVE
        and has_public_reference(asset)
    )
