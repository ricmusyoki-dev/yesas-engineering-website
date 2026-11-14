import hashlib
import uuid
from pathlib import Path

from django.core.exceptions import ValidationError
from django.core.files import File
from django.db import transaction

from .image_processing import sanitize_image
from .models import MediaAsset, MediaLifecycle
from .upload_validation import inspect_upload


def _checksum(file_object) -> str:
    digest = hashlib.sha256()
    file_object.seek(0)
    while True:
        chunk = file_object.read(1024 * 1024)
        if not chunk:
            break
        digest.update(chunk)
    file_object.seek(0)
    return digest.hexdigest()


def create_media_asset(upload, uploader, **metadata) -> MediaAsset:
    inspection = inspect_upload(upload)
    processed = thumbnail = None
    width = height = None
    try:
        if inspection.media_type == "image":
            processed, thumbnail, width, height, file_size = sanitize_image(
                upload,
                inspection.mime_type,
            )
            sha256 = _checksum(processed)
            content = File(processed, name=inspection.original_filename)
            thumbnail_content = File(thumbnail, name="preview.webp")
        else:
            file_size = upload.size
            sha256 = _checksum(upload)
            content = upload
            thumbnail_content = None

        title = metadata.pop(
            "title",
            Path(inspection.original_filename).stem,
        )
        asset = MediaAsset(
            original_filename=inspection.original_filename,
            display_filename=inspection.original_filename,
            uploader=uploader,
            media_type=inspection.media_type,
            verified_mime_type=inspection.mime_type,
            file_extension=inspection.extension,
            file_size=file_size,
            sha256=sha256,
            width=width,
            height=height,
            processing_metadata=(
                {"sanitized": True, "thumbnail_format": "image/webp"}
                if inspection.media_type == "image"
                else {"verification": "container_signature_only"}
            ),
            title=title,
            **metadata,
        )
        try:
            with transaction.atomic():
                asset.file.save(
                    f"{uuid.uuid4().hex}.{asset.file_extension}",
                    content,
                    save=False,
                )
                if thumbnail_content is not None:
                    asset.thumbnail.save("preview.webp", thumbnail_content, save=False)
                asset.full_clean()
                asset.save()
        except Exception:
            if asset.file.name:
                asset.file.storage.delete(asset.file.name)
            if asset.thumbnail.name:
                asset.thumbnail.storage.delete(asset.thumbnail.name)
            raise
        return asset
    finally:
        if processed is not None:
            processed.close()
        if thumbnail is not None:
            thumbnail.close()
        upload.seek(0)


def update_asset_metadata(asset: MediaAsset, **changes) -> MediaAsset:
    allowed_fields = {
        "title",
        "description",
        "alt_text",
        "caption",
        "credit",
        "accessibility_description",
        "display_filename",
    }
    if set(changes) - allowed_fields:
        raise ValidationError("Only descriptive media metadata may be changed.")
    with transaction.atomic():
        asset = MediaAsset.objects.select_for_update().get(pk=asset.pk)
        if asset.lifecycle != MediaLifecycle.ACTIVE:
            raise ValidationError("Archived assets cannot be edited.")
        for field, value in changes.items():
            setattr(asset, field, value)
        asset.full_clean()
        asset.save()
        return asset
