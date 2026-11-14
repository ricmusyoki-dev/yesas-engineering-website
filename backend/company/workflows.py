from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from .models import (
    CompanyProfileRevision,
    HomepageSectionRevision,
    RevisionStatus,
)


class ActiveDraftExists(Exception):
    pass


PROFILE_CONTENT_FIELDS = (
    "name",
    "tagline",
    "description",
    "overview",
    "business_phone",
    "whatsapp_number",
    "business_email",
    "physical_address",
    "city",
    "country",
    "service_areas",
    "linkedin_url",
    "instagram_url",
    "facebook_url",
    "tiktok_url",
    "youtube_url",
)

SECTION_CONTENT_FIELDS = (
    "section_type",
    "heading",
    "body",
    "cta_label",
    "cta_destination",
    "is_visible",
    "display_order",
    "item_limit",
)


def current_profile():
    return (
        CompanyProfileRevision.objects.filter(
            scope=CompanyProfileRevision.COMPANY_SCOPE,
            status=RevisionStatus.DRAFT,
        ).first()
        or CompanyProfileRevision.objects.filter(
            scope=CompanyProfileRevision.COMPANY_SCOPE,
            status=RevisionStatus.PUBLISHED,
        ).first()
    )


def create_profile_draft(user) -> CompanyProfileRevision:
    try:
        with transaction.atomic():
            if CompanyProfileRevision.objects.filter(
                scope=CompanyProfileRevision.COMPANY_SCOPE,
                status=RevisionStatus.DRAFT,
            ).exists():
                raise ActiveDraftExists

            published = CompanyProfileRevision.objects.filter(
                scope=CompanyProfileRevision.COMPANY_SCOPE,
                status=RevisionStatus.PUBLISHED,
            ).first()
            values = (
                {field: getattr(published, field) for field in PROFILE_CONTENT_FIELDS}
                if published
                else {}
            )
            revision = CompanyProfileRevision(
                **values,
                scope=CompanyProfileRevision.COMPANY_SCOPE,
                status=RevisionStatus.DRAFT,
                created_by=user,
                updated_by=user,
            )
            revision.full_clean()
            revision.save()
            return revision
    except IntegrityError as error:
        raise ActiveDraftExists from error


def create_section_draft(section_type: str, user) -> HomepageSectionRevision:
    try:
        with transaction.atomic():
            if HomepageSectionRevision.objects.filter(
                section_type=section_type,
                status=RevisionStatus.DRAFT,
            ).exists():
                raise ActiveDraftExists

            published = HomepageSectionRevision.objects.filter(
                section_type=section_type,
                status=RevisionStatus.PUBLISHED,
            ).first()
            values = (
                {field: getattr(published, field) for field in SECTION_CONTENT_FIELDS}
                if published
                else {
                    "section_type": section_type,
                    "is_visible": True,
                    "display_order": 0,
                    "item_limit": (
                        3
                        if section_type
                        in (
                            HomepageSectionRevision.SectionType.FEATURED_SERVICES,
                            HomepageSectionRevision.SectionType.FEATURED_PROJECTS,
                        )
                        else None
                    ),
                }
            )
            revision = HomepageSectionRevision(
                **values,
                status=RevisionStatus.DRAFT,
                created_by=user,
                updated_by=user,
            )
            revision.full_clean()
            revision.save()
            if (
                published
                and section_type
                == HomepageSectionRevision.SectionType.FEATURED_SERVICES
            ):
                revision.curated_services.set(published.curated_services.all())
            return revision
    except IntegrityError as error:
        raise ActiveDraftExists from error


def publish_profile_draft(user) -> CompanyProfileRevision | None:
    with transaction.atomic():
        draft = (
            CompanyProfileRevision.objects.select_for_update()
            .filter(
                scope=CompanyProfileRevision.COMPANY_SCOPE,
                status=RevisionStatus.DRAFT,
            )
            .first()
        )
        if draft is None:
            return None

        draft.status = RevisionStatus.PUBLISHED
        draft.published_by = user
        draft.published_at = timezone.now()
        draft.updated_by = user
        draft.full_clean(validate_constraints=False)

        CompanyProfileRevision.objects.select_for_update().filter(
            scope=CompanyProfileRevision.COMPANY_SCOPE,
            status=RevisionStatus.PUBLISHED,
        ).update(
            status=RevisionStatus.ARCHIVED,
            updated_by=user,
            updated_at=timezone.now(),
        )
        draft.save()
        return draft


def publish_section_draft(section_type: str, user) -> HomepageSectionRevision | None:
    with transaction.atomic():
        draft = (
            HomepageSectionRevision.objects.select_for_update()
            .filter(
                section_type=section_type,
                status=RevisionStatus.DRAFT,
            )
            .first()
        )
        if draft is None:
            return None

        draft.status = RevisionStatus.PUBLISHED
        draft.published_by = user
        draft.published_at = timezone.now()
        draft.updated_by = user
        draft.full_clean(validate_constraints=False)

        HomepageSectionRevision.objects.select_for_update().filter(
            section_type=section_type,
            status=RevisionStatus.PUBLISHED,
        ).update(
            status=RevisionStatus.ARCHIVED,
            updated_by=user,
            updated_at=timezone.now(),
        )
        draft.save()
        return draft


def restore_profile_revision(
    revision: CompanyProfileRevision, user
) -> CompanyProfileRevision:
    if revision.status != RevisionStatus.ARCHIVED:
        raise ValidationError("Only archived revisions can be restored.")
    try:
        with transaction.atomic():
            if CompanyProfileRevision.objects.filter(
                scope=CompanyProfileRevision.COMPANY_SCOPE,
                status=RevisionStatus.DRAFT,
            ).exists():
                raise ActiveDraftExists
            restored = CompanyProfileRevision(
                **{field: getattr(revision, field) for field in PROFILE_CONTENT_FIELDS},
                scope=CompanyProfileRevision.COMPANY_SCOPE,
                status=RevisionStatus.DRAFT,
                created_by=user,
                updated_by=user,
            )
            restored.full_clean()
            restored.save()
            return restored
    except IntegrityError as error:
        raise ActiveDraftExists from error


def restore_section_revision(
    revision: HomepageSectionRevision, user
) -> HomepageSectionRevision:
    if revision.status != RevisionStatus.ARCHIVED:
        raise ValidationError("Only archived revisions can be restored.")
    try:
        with transaction.atomic():
            if HomepageSectionRevision.objects.filter(
                section_type=revision.section_type,
                status=RevisionStatus.DRAFT,
            ).exists():
                raise ActiveDraftExists
            restored = HomepageSectionRevision(
                **{field: getattr(revision, field) for field in SECTION_CONTENT_FIELDS},
                status=RevisionStatus.DRAFT,
                created_by=user,
                updated_by=user,
            )
            restored.full_clean()
            restored.save()
            return restored
    except IntegrityError as error:
        raise ActiveDraftExists from error
