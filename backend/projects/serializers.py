from django.core.exceptions import ValidationError as DjangoValidationError
from django.utils.text import slugify
from rest_framework import serializers

from services.models import Service

from .models import (
    PROJECT_CONTENT_FIELDS,
    Project,
    ProjectCategory,
    ProjectRevision,
    ProjectTag,
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
        many_to_many = {field.name for field in self.Meta.model._meta.many_to_many}
        many_to_many_values = {
            field: attrs.pop(field) for field in many_to_many.intersection(attrs)
        }
        for field, value in attrs.items():
            setattr(self.instance, field, value)
        try:
            self.instance.full_clean()
        except DjangoValidationError as error:
            if hasattr(error, "message_dict"):
                raise serializers.ValidationError(error.message_dict) from error
            raise serializers.ValidationError(error.messages) from error
        attrs.update(many_to_many_values)
        return attrs


class ProjectIdentitySerializer(serializers.Serializer):
    slug = serializers.SlugField(max_length=180)


class ProjectContentSerializer(ModelValidationMixin, serializers.ModelSerializer):
    category = serializers.PrimaryKeyRelatedField(
        queryset=ProjectCategory.objects.all(),
        required=False,
        allow_null=True,
    )
    related_services = serializers.PrimaryKeyRelatedField(
        queryset=Service.objects.filter(is_archived=False),
        many=True,
        required=False,
    )
    tags = serializers.PrimaryKeyRelatedField(
        queryset=ProjectTag.objects.filter(is_active=True),
        many=True,
        required=False,
    )

    class Meta:
        model = ProjectRevision
        fields = (*PROJECT_CONTENT_FIELDS, "related_services", "tags")

    def validate(self, attrs):
        attrs = super().validate(attrs)
        for field, maximum in (("related_services", 20), ("tags", 20)):
            values = attrs.get(field)
            if values is not None and len(values) > maximum:
                raise serializers.ValidationError(
                    {field: f"Select no more than {maximum} items."}
                )
            if values is not None and len({value.pk for value in values}) != len(values):
                raise serializers.ValidationError(
                    {field: "Duplicate selections are not allowed."}
                )
        return attrs


class ProjectRevisionSerializer(ProjectContentSerializer):
    slug = serializers.SlugField(source="project.slug", read_only=True)

    class Meta(ProjectContentSerializer.Meta):
        fields = (
            *ProjectContentSerializer.Meta.fields,
            *REVISION_META_FIELDS,
            "slug",
        )
        read_only_fields = REVISION_META_FIELDS + ("slug",)

    def update(self, instance, validated_data):
        validated_data["updated_by"] = self.context["request"].user
        return super().update(instance, validated_data)


class ProjectCategorySerializer(ModelValidationMixin, serializers.ModelSerializer):
    slug = serializers.SlugField(max_length=120, required=False, allow_blank=True)

    class Meta:
        model = ProjectCategory
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
        category = ProjectCategory(
            **validated_data,
            created_by=user,
            updated_by=user,
        )
        category.full_clean()
        category.save()
        return category


class ProjectTagSerializer(ModelValidationMixin, serializers.ModelSerializer):
    slug = serializers.SlugField(max_length=60, required=False, allow_blank=True)

    class Meta:
        model = ProjectTag
        fields = ("id", "name", "slug", "is_active", "created_at", "updated_at")
        read_only_fields = ("id", "created_at", "updated_at")

    def validate(self, attrs):
        attrs = super().validate(attrs)
        name = attrs.get("name", self.instance.name if self.instance else "")
        slug = attrs.get("slug", self.instance.slug if self.instance else "")
        attrs["slug"] = slugify(slug or name)
        if not attrs["slug"]:
            raise serializers.ValidationError({"slug": "A valid tag slug is required."})
        return attrs

    def create(self, validated_data):
        user = self.context["request"].user
        tag = ProjectTag(
            **validated_data,
            created_by=user,
            updated_by=user,
        )
        tag.full_clean()
        tag.save()
        return tag


class ProjectManagementSerializer(serializers.ModelSerializer):
    draft = serializers.SerializerMethodField()
    published = serializers.SerializerMethodField()

    class Meta:
        model = Project
        fields = (
            "id",
            "slug",
            "availability",
            "archived_at",
            "created_by",
            "updated_by",
            "created_at",
            "updated_at",
            "draft",
            "published",
        )
        read_only_fields = fields

    def get_draft(self, project):
        revision = project.revisions.filter(status="draft").first()
        return (
            ProjectRevisionSerializer(revision, context=self.context).data
            if revision
            else None
        )

    def get_published(self, project):
        revision = project.revisions.filter(status="published").first()
        return (
            ProjectRevisionSerializer(revision, context=self.context).data
            if revision
            else None
        )
