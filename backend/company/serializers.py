from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import serializers

from services.models import Service

from .models import CompanyProfileRevision, HomepageSectionRevision

PROFILE_FIELDS = (
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

SECTION_FIELDS = (
    "section_type",
    "heading",
    "body",
    "cta_label",
    "cta_destination",
    "is_visible",
    "display_order",
    "item_limit",
    "curated_services",
)

REVISION_FIELDS = (
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
        many_to_many = {field.name for field in self.Meta.model._meta.many_to_many}
        many_to_many_values = {
            field: attrs.pop(field) for field in many_to_many.intersection(attrs)
        }
        candidate = self.instance or self.Meta.model()
        for field, value in attrs.items():
            setattr(candidate, field, value)
        try:
            candidate.full_clean()
        except DjangoValidationError as error:
            if hasattr(error, "message_dict"):
                raise serializers.ValidationError(error.message_dict) from error
            raise serializers.ValidationError(error.messages) from error
        attrs.update(many_to_many_values)
        return attrs


class CompanyProfileContentSerializer(
    ModelValidationMixin,
    serializers.ModelSerializer,
):
    class Meta:
        model = CompanyProfileRevision
        fields = PROFILE_FIELDS


class CompanyProfileRevisionSerializer(CompanyProfileContentSerializer):
    class Meta(CompanyProfileContentSerializer.Meta):
        fields = (*PROFILE_FIELDS, *REVISION_FIELDS)
        read_only_fields = REVISION_FIELDS

    def update(self, instance, validated_data):
        validated_data["updated_by"] = self.context["request"].user
        return super().update(instance, validated_data)


class HomepageSectionContentSerializer(
    ModelValidationMixin,
    serializers.ModelSerializer,
):
    class Meta:
        model = HomepageSectionRevision
        fields = SECTION_FIELDS

    curated_services = serializers.PrimaryKeyRelatedField(
        queryset=Service.objects.filter(is_archived=False),
        many=True,
        required=False,
    )

    def validate(self, attrs):
        attrs = super().validate(attrs)
        section_type = attrs.get(
            "section_type",
            self.instance.section_type if self.instance else None,
        )
        curated_services = attrs.get("curated_services")
        if (
            section_type != HomepageSectionRevision.SectionType.FEATURED_SERVICES
            and curated_services
        ):
            raise serializers.ValidationError(
                {
                    "curated_services": "Only featured-services sections may select services."
                }
            )
        return attrs


class PublicHomepageSectionSerializer(serializers.ModelSerializer):
    class Meta:
        model = HomepageSectionRevision
        fields = (
            "section_type",
            "heading",
            "body",
            "cta_label",
            "cta_destination",
            "is_visible",
            "display_order",
            "item_limit",
            "featured_services",
        )

    featured_services = serializers.SerializerMethodField()

    def get_featured_services(self, instance):
        if (
            instance.section_type
            != HomepageSectionRevision.SectionType.FEATURED_SERVICES
        ):
            return []
        from services.public_serializers import (
            PublicServiceSerializer,
            public_revisions_for_services,
        )

        services = public_revisions_for_services(instance.curated_services.all())
        return PublicServiceSerializer(
            services[: instance.item_limit],
            many=True,
            context={"request": self.context.get("request")},
        ).data


class HomepageSectionRevisionSerializer(HomepageSectionContentSerializer):
    class Meta(HomepageSectionContentSerializer.Meta):
        fields = (*SECTION_FIELDS, *REVISION_FIELDS)
        read_only_fields = REVISION_FIELDS

    def update(self, instance, validated_data):
        validated_data["updated_by"] = self.context["request"].user
        return super().update(instance, validated_data)
