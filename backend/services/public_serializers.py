from django.db.models import Q
from rest_framework import serializers

from company.models import RevisionStatus

from .models import ServiceCategory, ServiceRevision


class PublicServiceCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceCategory
        fields = ("name", "slug")


class PublicServiceSerializer(serializers.ModelSerializer):
    slug = serializers.CharField(source="service.slug", read_only=True)
    category = PublicServiceCategorySerializer(read_only=True)

    class Meta:
        model = ServiceRevision
        fields = (
            "slug",
            "title",
            "summary",
            "description",
            "category",
            "display_order",
            "is_featured",
            "features",
            "benefits",
            "process",
            "cta_label",
            "cta_destination",
            "seo_title",
            "seo_description",
        )


def public_revisions_for_services(services):
    return (
        ServiceRevision.objects.select_related("service", "category")
        .filter(
            service__in=services,
            service__is_archived=False,
            status=RevisionStatus.PUBLISHED,
            is_enabled=True,
        )
        .filter(Q(category__isnull=True) | Q(category__is_active=True))
        .order_by("display_order", "title", "service__slug")
    )
