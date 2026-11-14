from __future__ import annotations

import uuid
from typing import ClassVar

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from django.utils import timezone

from .storage import PrivateMediaStorage

private_media_storage = PrivateMediaStorage()


class MediaType(models.TextChoices):
    IMAGE = "image", "Image"
    VIDEO = "video", "Video"


class MediaLifecycle(models.TextChoices):
    ACTIVE = "active", "Active"
    ARCHIVED = "archived", "Archived"


class AttachmentRole(models.TextChoices):
    COVER_IMAGE = "cover_image", "Cover image"
    GALLERY_IMAGE = "gallery_image", "Gallery image"
    VIDEO = "video", "Video"
    LOGO = "logo", "Logo"
    HERO_IMAGE = "hero_image", "Hero background image"
    HERO_VIDEO = "hero_video", "Hero background video"
    SECTION_IMAGE = "section_image", "Section image"
    SECTION_VIDEO = "section_video", "Section video"


def _asset_upload_to(asset: MediaAsset, filename: str) -> str:
    return (
        f"assets/{asset.pk.hex}/{uuid.uuid4().hex}"
        f".{asset.file_extension}"
    )


def _thumbnail_upload_to(asset: MediaAsset, filename: str) -> str:
    return f"previews/{asset.pk.hex}/{uuid.uuid4().hex}.webp"


class MediaAsset(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    original_filename = models.CharField(max_length=255)
    display_filename = models.CharField(max_length=255)
    file = models.FileField(
        storage=private_media_storage,
        upload_to=_asset_upload_to,
        max_length=512,
    )
    thumbnail = models.FileField(
        storage=private_media_storage,
        upload_to=_thumbnail_upload_to,
        max_length=512,
        blank=True,
    )
    uploader = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="uploaded_media_assets",
    )
    media_type = models.CharField(max_length=8, choices=MediaType.choices)
    verified_mime_type = models.CharField(max_length=64)
    file_extension = models.CharField(max_length=8)
    file_size = models.PositiveBigIntegerField()
    sha256 = models.CharField(max_length=64)
    width = models.PositiveIntegerField(null=True, blank=True)
    height = models.PositiveIntegerField(null=True, blank=True)
    duration_seconds = models.FloatField(null=True, blank=True)
    processing_metadata = models.JSONField(default=dict, blank=True)

    title = models.CharField(max_length=200, blank=True, default="")
    description = models.TextField(blank=True, default="")
    alt_text = models.CharField(max_length=500, blank=True, default="")
    caption = models.CharField(max_length=500, blank=True, default="")
    credit = models.CharField(max_length=255, blank=True, default="")
    accessibility_description = models.TextField(blank=True, default="")

    lifecycle = models.CharField(
        max_length=8,
        choices=MediaLifecycle.choices,
        default=MediaLifecycle.ACTIVE,
    )
    archived_at = models.DateTimeField(null=True, blank=True, editable=False)
    archived_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="archived_media_assets",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    IMMUTABLE_FIELDS: ClassVar[tuple[str, ...]] = (
        "file",
        "thumbnail",
        "media_type",
        "verified_mime_type",
        "file_extension",
        "file_size",
        "sha256",
        "width",
        "height",
        "duration_seconds",
        "processing_metadata",
    )

    class Meta:
        ordering = ("-created_at", "-pk")
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(
                condition=Q(lifecycle__in=MediaLifecycle.values),
                name="media_asset_valid_lifecycle",
            ),
            models.CheckConstraint(
                condition=(
                    Q(
                        lifecycle=MediaLifecycle.ACTIVE,
                        archived_at__isnull=True,
                        archived_by__isnull=True,
                    )
                    | Q(
                        lifecycle=MediaLifecycle.ARCHIVED,
                        archived_at__isnull=False,
                        archived_by__isnull=False,
                    )
                ),
                name="media_asset_archive_state_ok",
            ),
            models.CheckConstraint(
                condition=Q(file_size__gt=0),
                name="media_asset_file_size_positive",
            ),
        ]

    def clean(self):
        super().clean()
        if self.lifecycle == MediaLifecycle.ARCHIVED:
            if self.archived_at is None or self.archived_by_id is None:
                raise ValidationError(
                    "Archived assets require an archive timestamp and user."
                )
        elif self.archived_at is not None or self.archived_by_id is not None:
            raise ValidationError(
                "Active assets cannot have archive metadata."
            )

    def save(self, *args, **kwargs):
        if self.pk:
            existing = type(self).objects.filter(pk=self.pk).values(
                *self.IMMUTABLE_FIELDS
            ).first()
            if existing and any(
                existing[field] != getattr(self, field)
                for field in self.IMMUTABLE_FIELDS
            ):
                raise ValidationError(
                    "Stored file content and verification metadata are immutable."
                )
        return super().save(*args, **kwargs)

    def __str__(self):
        return self.title or self.display_filename


class RevisionMediaAttachment(models.Model):
    asset = models.ForeignKey(
        MediaAsset,
        on_delete=models.PROTECT,
        related_name="%(app_label)s_%(class)s_attachments",
    )
    role = models.CharField(max_length=32, choices=AttachmentRole.choices)
    display_order = models.PositiveSmallIntegerField(default=0)
    caption_override = models.CharField(max_length=500, blank=True, default="")
    alt_text_override = models.CharField(max_length=500, blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="+",
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    ALLOWED_ROLES: ClassVar[dict[str, str]] = {}

    class Meta:
        abstract = True
        ordering = ("display_order", "created_at", "pk")

    def clean(self):
        super().clean()
        expected_type = self.ALLOWED_ROLES.get(self.role)
        if expected_type is None:
            raise ValidationError({"role": "This role is not supported here."})
        if self.asset_id and self.asset.media_type != expected_type:
            raise ValidationError(
                {"asset": f"This attachment role requires {expected_type} media."}
            )

    def __str__(self):
        return f"{self.role}: {self.asset}"
