from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction

from company.models import (
    CompanyProfileMediaAttachment,
    CompanyProfileRevision,
    HomepageSectionMediaAttachment,
    HomepageSectionRevision,
    RevisionStatus,
)
from projects.models import ProjectMediaAttachment, ProjectRevision
from services.models import ServiceMediaAttachment, ServiceRevision

from .models import MediaAsset, MediaLifecycle

TARGETS = {
    "project_revision": (ProjectRevision, ProjectMediaAttachment),
    "service_revision": (ServiceRevision, ServiceMediaAttachment),
    "company_profile_revision": (
        CompanyProfileRevision,
        CompanyProfileMediaAttachment,
    ),
    "homepage_section_revision": (
        HomepageSectionRevision,
        HomepageSectionMediaAttachment,
    ),
}

HERO_ROLES = {"hero_image", "hero_video"}


def _target(target_type, revision_id, *, lock=False):
    models = TARGETS.get(target_type)
    if models is None:
        raise ValidationError({"target_type": "Choose a supported revision type."})
    revision_model, attachment_model = models
    queryset = revision_model.objects
    if lock:
        queryset = queryset.select_for_update()
    try:
        revision = queryset.get(pk=revision_id)
    except revision_model.DoesNotExist as error:
        raise ValidationError({"revision_id": "Revision not found."}) from error
    if revision.status != RevisionStatus.DRAFT:
        raise ValidationError(
            "Attachments can only be changed on draft revisions."
        )
    if (
        isinstance(revision, CompanyProfileRevision)
        and revision.scope != CompanyProfileRevision.COMPANY_SCOPE
    ):
        raise ValidationError({"revision_id": "Revision is not the company profile."})
    if (
        isinstance(revision, ProjectRevision)
        and revision.project.availability == "archived"
    ):
        raise ValidationError({"revision_id": "Archived projects cannot be edited."})
    if isinstance(revision, ServiceRevision) and revision.service.is_archived:
        raise ValidationError({"revision_id": "Archived services cannot be edited."})
    return revision, attachment_model


def list_revision_attachments(target_type, revision_id):
    revision, attachment_model = _target(target_type, revision_id)
    return attachment_model.objects.filter(revision=revision).select_related(
        "asset",
        "created_by",
    )


def attach_asset(
    target_type,
    revision_id,
    asset_id,
    user,
    *,
    role,
    display_order=0,
    caption_override="",
    alt_text_override="",
):
    try:
        with transaction.atomic():
            revision, attachment_model = _target(
                target_type,
                revision_id,
                lock=True,
            )
            asset = MediaAsset.objects.select_for_update().get(pk=asset_id)
            if asset.lifecycle != MediaLifecycle.ACTIVE:
                raise ValidationError({"asset": "Restore the asset before attaching it."})
            attachment = attachment_model(
                revision=revision,
                asset=asset,
                role=role,
                display_order=display_order,
                caption_override=caption_override,
                alt_text_override=alt_text_override,
                created_by=user,
            )
            attachment.full_clean()
            if (
                target_type == "homepage_section_revision"
                and role in HERO_ROLES
                and attachment_model.objects.filter(
                    revision=revision,
                    role__in=HERO_ROLES,
                ).exists()
            ):
                raise ValidationError(
                    {"role": "A homepage hero may have only one background asset."}
                )
            attachment.save()
            return attachment
    except IntegrityError as error:
        raise ValidationError(
            {"asset": "This asset or role is already attached to the revision."}
        ) from error


def update_attachment(
    target_type,
    revision_id,
    attachment_id,
    *,
    changes,
):
    try:
        with transaction.atomic():
            revision, attachment_model = _target(
                target_type,
                revision_id,
                lock=True,
            )
            try:
                attachment = (
                    attachment_model.objects.select_for_update()
                    .select_related("asset")
                    .get(pk=attachment_id, revision=revision)
                )
            except attachment_model.DoesNotExist as error:
                raise ValidationError({"attachment_id": "Attachment not found."}) from error
            for field, value in changes.items():
                setattr(attachment, field, value)
            attachment.full_clean()
            if (
                target_type == "homepage_section_revision"
                and attachment.role in HERO_ROLES
                and attachment_model.objects.filter(
                    revision=revision,
                    role__in=HERO_ROLES,
                )
                .exclude(pk=attachment.pk)
                .exists()
            ):
                raise ValidationError(
                    {"role": "A homepage hero may have only one background asset."}
                )
            attachment.save()
            return attachment
    except IntegrityError as error:
        raise ValidationError(
            {"detail": "The attachment conflicts with another revision attachment."}
        ) from error


def detach_asset(target_type, revision_id, attachment_id):
    with transaction.atomic():
        revision, attachment_model = _target(
            target_type,
            revision_id,
            lock=True,
        )
        try:
            attachment = attachment_model.objects.select_for_update().get(
                pk=attachment_id,
                revision=revision,
            )
        except attachment_model.DoesNotExist as error:
            raise ValidationError({"attachment_id": "Attachment not found."}) from error
        attachment.delete()


def copy_revision_attachments(source, target, user):
    attachment_model = next(
        (
            attachment_model
            for revision_model, attachment_model in TARGETS.values()
            if isinstance(source, revision_model)
        ),
        None,
    )
    if attachment_model is None or not isinstance(target, type(source)):
        raise ValidationError("Unsupported revision attachment copy.")
    for attachment in attachment_model.objects.filter(revision=source):
        attachment_model.objects.create(
            revision=target,
            asset=attachment.asset,
            role=attachment.role,
            display_order=attachment.display_order,
            caption_override=attachment.caption_override,
            alt_text_override=attachment.alt_text_override,
            created_by=user,
        )


def validate_revision_attachments(revision):
    attachment_model = next(
        (
            attachment_model
            for revision_model, attachment_model in TARGETS.values()
            if isinstance(revision, revision_model)
        ),
        None,
    )
    if attachment_model is None:
        raise ValidationError("Unsupported revision attachment target.")
    asset_ids = attachment_model.objects.filter(revision=revision).values_list(
        "asset_id",
        flat=True,
    )
    assets = MediaAsset.objects.select_for_update().filter(
        pk__in=asset_ids,
    ).values_list("lifecycle", flat=True)
    if any(lifecycle != MediaLifecycle.ACTIVE for lifecycle in assets):
        raise ValidationError(
            {"media_attachments": "Restore archived media before publishing."}
        )
