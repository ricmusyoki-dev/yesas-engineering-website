from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.text import slugify
from rest_framework import serializers

from .models import (
    SERVICE_CONTENT_FIELDS,
    Service,
    ServiceCategory,
    ServiceRevision,
)

REVISION_META_FIELDS = (
    "id",
    "status",
    "created_by",
    "updated_by",
    "published_by",
    "created_at",
    "updated_at",
    "published_at",
)


class ModelValidationMixin:
    def validate(self, attrs):
        attrs = super().validate(attrs)
        if self.instance is None:
            return attrs
        candidate = self.instance or self.Meta.model()
        for field, value in attrs.items():
            setattr(candidate, field, value)
        try:
            candidate.full_clean()
        except DjangoValidationError as error:
            if hasattr(error, "message_dict"):
                raise serializers.ValidationError(error.message_dict) from error
            raise serializers.ValidationError(error.messages) from error
        return attrs


class ServiceCategorySerializer(ModelValidationMixin, serializers.ModelSerializer):
    slug = serializers.SlugField(max_length=120, required=False, allow_blank=True)

    class Meta:
        model = ServiceCategory
        fields = (
            "id",
            "name",
            "slug",
            "description",
            "display_order",
            "is_active",
            "created_at",
            "updated_at",
        )
        read_only_fields = ("id", "created_at", "updated_at")

    def validate(self, attrs):
        attrs = super().validate(attrs)
        name = attrs.get("name", self.instance.name if self.instance else "")
        slug = attrs.get("slug", self.instance.slug if self.instance else "")
        attrs["slug"] = slugify(slug or name)
        if not attrs["slug"]:
            raise serializers.ValidationError(
                {"slug": "A valid category slug is required."}
            )
        return attrs

    def create(self, validated_data):
        user = self.context["request"].user
        validated_data.update(created_by=user, updated_by=user)
        category = ServiceCategory(**validated_data)
        category.full_clean()
        category.save()
        return category

    def update(self, instance, validated_data):
        validated_data["updated_by"] = self.context["request"].user
        return super().update(instance, validated_data)


class ServiceDraftContentSerializer(ModelValidationMixin, serializers.ModelSerializer):
    class Meta:
        model = ServiceRevision
        fields = SERVICE_CONTENT_FIELDS

    category = serializers.PrimaryKeyRelatedField(
        queryset=ServiceCategory.objects.all(),
        required=False,
        allow_null=True,
    )


class ServiceRevisionSerializer(ServiceDraftContentSerializer):
    slug = serializers.SlugField(source="service.slug", read_only=True)

    class Meta(ServiceDraftContentSerializer.Meta):
        fields = (*SERVICE_CONTENT_FIELDS, *REVISION_META_FIELDS, "slug")
        read_only_fields = REVISION_META_FIELDS + ("slug",)

    def update(self, instance, validated_data):
        validated_data["updated_by"] = self.context["request"].user
        return super().update(instance, validated_data)


class ServiceManagementSerializer(serializers.ModelSerializer):
    draft = serializers.SerializerMethodField()
    published = serializers.SerializerMethodField()

    class Meta:
        model = Service
        fields = (
            "id",
            "slug",
            "is_archived",
            "archived_at",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
            "draft",
            "published",
        )
        read_only_fields = fields

    def get_draft(self, service):
        revision = service.revisions.filter(status="draft").first()
        return (
            ServiceRevisionSerializer(revision, context=self.context).data
            if revision
            else None
        )

    def get_published(self, service):
        revision = service.revisions.filter(status="published").first()
        return (
            ServiceRevisionSerializer(revision, context=self.context).data
            if revision
            else None
        )
