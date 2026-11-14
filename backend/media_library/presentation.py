from django.urls import reverse

from .models import MediaLifecycle


def public_attachment_payload(attachment):
    asset = attachment.asset
    content_url = reverse(
        "media-asset-content",
        kwargs={"asset_id": asset.pk},
    )
    return {
        "id": str(asset.pk),
        "title": asset.title,
        "media_type": asset.media_type,
        "content_type": asset.verified_mime_type,
        "content_url": content_url,
        "thumbnail_url": (
            f"{content_url}?variant=thumbnail"
            if asset.media_type == "image" and asset.thumbnail
            else None
        ),
        "width": asset.width,
        "height": asset.height,
        "duration_seconds": asset.duration_seconds,
        "alt_text": attachment.alt_text_override or asset.alt_text,
        "caption": attachment.caption_override or asset.caption,
        "credit": asset.credit,
    }


def public_attachments(revision):
    attachments = getattr(revision, "public_media_attachments", None)
    if attachments is None:
        attachments = (
            revision.media_attachments.filter(asset__lifecycle=MediaLifecycle.ACTIVE)
            .select_related("asset")
            .order_by("display_order", "created_at", "pk")
        )
    return attachments


def media_for_role(revision, role):
    return [
        public_attachment_payload(attachment)
        for attachment in public_attachments(revision)
        if attachment.role == role
    ]
