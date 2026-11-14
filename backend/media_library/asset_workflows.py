from django.core.exceptions import ValidationError
from django.db import transaction
from django.utils import timezone

from .models import MediaAsset, MediaLifecycle
from .visibility import has_public_reference


class AssetHasPublicReferences(Exception):
    pass


def archive_media_asset(asset: MediaAsset, user) -> MediaAsset:
    with transaction.atomic():
        asset = MediaAsset.objects.select_for_update().get(pk=asset.pk)
        if asset.lifecycle == MediaLifecycle.ARCHIVED:
            raise ValidationError("Media asset is already archived.")
        if has_public_reference(asset):
            raise AssetHasPublicReferences
        asset.lifecycle = MediaLifecycle.ARCHIVED
        asset.archived_at = timezone.now()
        asset.archived_by = user
        asset.full_clean()
        asset.save(
            update_fields=(
                "lifecycle",
                "archived_at",
                "archived_by",
                "updated_at",
            )
        )
        return asset


def restore_media_asset(asset: MediaAsset) -> MediaAsset:
    with transaction.atomic():
        asset = MediaAsset.objects.select_for_update().get(pk=asset.pk)
        if asset.lifecycle != MediaLifecycle.ARCHIVED:
            raise ValidationError("Only archived assets can be restored.")
        asset.lifecycle = MediaLifecycle.ACTIVE
        asset.archived_at = None
        asset.archived_by = None
        asset.full_clean()
        asset.save(
            update_fields=(
                "lifecycle",
                "archived_at",
                "archived_by",
                "updated_at",
            )
        )
        return asset
