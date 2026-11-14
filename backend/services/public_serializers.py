from django.db.models import Prefetch, Q
from rest_framework import serializers

from company.models import RevisionStatus
from media_library.models import MediaLifecycle
from media_library.presentation import media_for_role

from .models import (
    ServiceCategory,
    ServiceMediaAttachment,
    ServiceRevision,
)


class PublicServiceCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ServiceCategory
        fields = ("name", "slug")


class PublicServiceSerializer(serializers.ModelSerializer):
    slug = serializers.CharField(source="service.slug", read_only=True)
    category = PublicServiceCategorySerializer(read_only=True)
    cover_image = serializers.SerializerMethodField()
    images = serializers.SerializerMethodField()
    videos = serializers.SerializerMethodField()

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
            "cover_image",
            "images",
            "videos",
        )

    def get_cover_image(self, revision):
        return next(iter(media_for_role(revision, "cover_image")), None)

    def get_images(self, revision):
        return media_for_role(revision, "gallery_image")

    def get_videos(self, revision):
        return media_for_role(revision, "video")


def with_public_service_media(queryset):
    return queryset.prefetch_related(
        Prefetch(
            "media_attachments",
            queryset=ServiceMediaAttachment.objects.filter(
                asset__lifecycle=MediaLifecycle.ACTIVE
            ).select_related("asset"),
            to_attr="public_media_attachments",
        )
    )


def public_revisions_for_services(services):
    queryset = (
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
    return with_public_service_media(queryset)
