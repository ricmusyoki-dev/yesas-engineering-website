from collections.abc import Mapping

from django.core.exceptions import ValidationError as DjangoValidationError
from django.urls import reverse
from rest_framework import serializers

from .models import AttachmentRole, MediaAsset
from .upload_validation import sanitize_filename


class StrictInputSerializerMixin:
    def to_internal_value(self, data):
        if not isinstance(data, Mapping):
            return super().to_internal_value(data)
        unknown = set(data) - set(self.fields)
        if unknown:
            raise serializers.ValidationError(
                {"detail": f"Unknown fields: {', '.join(sorted(unknown))}."}
            )
        return super().to_internal_value(data)


class MediaAssetSerializer(serializers.ModelSerializer):
    content_url = serializers.SerializerMethodField()
    thumbnail_url = serializers.SerializerMethodField()

    class Meta:
        model = MediaAsset
        fields = (
            "id",
            "original_filename",
            "display_filename",
            "uploader",
            "media_type",
            "verified_mime_type",
            "file_extension",
            "file_size",
            "sha256",
            "width",
            "height",
            "duration_seconds",
            "processing_metadata",
            "title",
            "description",
            "alt_text",
            "caption",
            "credit",
            "accessibility_description",
            "lifecycle",
            "archived_at",
            "archived_by",
            "created_at",
            "updated_at",
            "content_url",
            "thumbnail_url",
        )
        read_only_fields = fields

    def get_content_url(self, asset):
        return reverse("media-asset-content", kwargs={"asset_id": asset.pk})

    def get_thumbnail_url(self, asset):
        if asset.media_type != "image" or not asset.thumbnail:
            return None
        return (
            f"{reverse('media-asset-content', kwargs={'asset_id': asset.pk})}"
            "?variant=thumbnail"
        )


class MediaAssetUploadSerializer(StrictInputSerializerMixin, serializers.Serializer):
    file = serializers.FileField()
    title = serializers.CharField(max_length=200, required=False, allow_blank=True)
    description = serializers.CharField(required=False, allow_blank=True)
    alt_text = serializers.CharField(max_length=500, required=False, allow_blank=True)
    caption = serializers.CharField(max_length=500, required=False, allow_blank=True)
    credit = serializers.CharField(max_length=255, required=False, allow_blank=True)
    accessibility_description = serializers.CharField(
        required=False,
        allow_blank=True,
    )


class MediaAssetMetadataSerializer(
    StrictInputSerializerMixin,
    serializers.ModelSerializer,
):
    class Meta:
        model = MediaAsset
        fields = (
            "display_filename",
            "title",
            "description",
            "alt_text",
            "caption",
            "credit",
            "accessibility_description",
        )

    def validate_display_filename(self, value):
        return sanitize_filename(value)

    def update(self, instance, validated_data):
        try:
            from .upload_services import update_asset_metadata

            return update_asset_metadata(instance, **validated_data)
        except DjangoValidationError as error:
            if hasattr(error, "message_dict"):
                raise serializers.ValidationError(error.message_dict) from error
            raise serializers.ValidationError(error.messages) from error


class MediaAttachmentInputSerializer(
    StrictInputSerializerMixin,
    serializers.Serializer,
):
    asset = serializers.PrimaryKeyRelatedField(queryset=MediaAsset.objects.all())
    role = serializers.ChoiceField(choices=AttachmentRole.choices)
    display_order = serializers.IntegerField(min_value=0, max_value=32767, default=0)
    caption_override = serializers.CharField(
        max_length=500,
        required=False,
        allow_blank=True,
    )
    alt_text_override = serializers.CharField(
        max_length=500,
        required=False,
        allow_blank=True,
    )


class MediaAttachmentUpdateSerializer(
    StrictInputSerializerMixin,
    serializers.Serializer,
):
    role = serializers.ChoiceField(choices=AttachmentRole.choices, required=False)
    display_order = serializers.IntegerField(
        min_value=0,
        max_value=32767,
        required=False,
    )
    caption_override = serializers.CharField(
        max_length=500,
        required=False,
        allow_blank=True,
    )
    alt_text_override = serializers.CharField(
        max_length=500,
        required=False,
        allow_blank=True,
    )


class MediaAttachmentSerializer(serializers.Serializer):
    id = serializers.IntegerField(read_only=True)
    asset = MediaAssetSerializer(read_only=True)
    role = serializers.ChoiceField(choices=AttachmentRole.choices, read_only=True)
    display_order = serializers.IntegerField(read_only=True)
    caption_override = serializers.CharField(read_only=True)
    alt_text_override = serializers.CharField(read_only=True)
    created_by = serializers.IntegerField(source="created_by_id", read_only=True)
    created_at = serializers.DateTimeField(read_only=True)
