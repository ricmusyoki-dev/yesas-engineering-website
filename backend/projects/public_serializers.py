from django.db.models import Prefetch, Q
from rest_framework import serializers

from services.models import Service, ServiceRevision
from services.public_serializers import (
    PublicServiceSerializer,
    public_revisions_for_services,
)

from .models import (
    ProjectAvailability,
    ProjectCategory,
    ProjectRevision,
    ProjectRevisionStatus,
    ProjectTag,
)


class PublicProjectCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectCategory
        fields = ("name", "slug")


class PublicProjectTagSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectTag
        fields = ("name", "slug")


class PublicProjectSerializer(serializers.ModelSerializer):
    slug = serializers.CharField(source="project.slug", read_only=True)
    category = PublicProjectCategorySerializer(read_only=True)
    tags = serializers.SerializerMethodField()
    related_services = serializers.SerializerMethodField()
    client_name = serializers.SerializerMethodField()

    class Meta:
        model = ProjectRevision
        fields = (
            "slug",
            "title",
            "summary",
            "description",
            "category",
            "location",
            "country",
            "start_date",
            "completion_date",
            "execution_status",
            "project_background",
            "engineering_challenge",
            "proposed_solution",
            "work_carried_out",
            "technical_specifications",
            "outcomes",
            "related_services",
            "tags",
            "display_order",
            "is_featured",
            "client_name",
            "seo_title",
            "seo_description",
        )

    def get_tags(self, revision):
        tags = getattr(revision, "public_tags", None)
        if tags is None:
            tags = revision.tags.filter(is_active=True)
        return PublicProjectTagSerializer(tags, many=True).data

    def get_related_services(self, revision):
        related_services = list(revision.related_services.all())
        if related_services and not hasattr(
            related_services[0],
            "public_project_revisions",
        ):
            services = public_revisions_for_services(related_services)
            return PublicServiceSerializer(
                services,
                many=True,
                context=self.context,
            ).data
        service_revisions = []
        for service in related_services:
            service_revisions.extend(
                getattr(service, "public_project_revisions", ())
            )
        service_revisions.sort(
            key=lambda item: (
                item.display_order,
                item.title,
                item.service.slug,
            )
        )
        return PublicServiceSerializer(
            service_revisions,
            many=True,
            context=self.context,
        ).data

    def get_client_name(self, revision):
        return revision.client_name if revision.show_client_name else None


def public_project_revisions(projects=None):
    public_service_revisions = (
        ServiceRevision.objects.select_related("service", "category")
        .filter(status="published", is_enabled=True)
        .filter(Q(category__isnull=True) | Q(category__is_active=True))
    )
    services = Service.objects.filter(is_archived=False).prefetch_related(
        Prefetch(
            "revisions",
            queryset=public_service_revisions,
            to_attr="public_project_revisions",
        )
    )
    queryset = (
        ProjectRevision.objects.select_related(
            "project",
            "category",
        )
        .prefetch_related(
            Prefetch(
                "tags",
                queryset=ProjectTag.objects.filter(is_active=True),
                to_attr="public_tags",
            ),
            Prefetch("related_services", queryset=services),
        )
        .filter(
            status=ProjectRevisionStatus.PUBLISHED,
            project__availability=ProjectAvailability.ENABLED,
        )
        .filter(Q(category__isnull=True) | Q(category__is_active=True))
    )
    if projects is not None:
        queryset = queryset.filter(project__in=projects)
    return queryset.order_by("display_order", "title", "project__slug")
