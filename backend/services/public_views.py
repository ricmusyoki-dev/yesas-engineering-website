from django.db.models import Q
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.permissions import AllowAny

from company.models import RevisionStatus

from .models import ServiceRevision
from .public_serializers import PublicServiceSerializer, with_public_service_media


class PublicServiceQueryMixin:
    permission_classes = (AllowAny,)
    serializer_class = PublicServiceSerializer

    def get_queryset(self):
        queryset = ServiceRevision.objects.select_related(
            "service",
            "category",
        ).filter(
            status=RevisionStatus.PUBLISHED,
            is_enabled=True,
            service__is_archived=False,
        )
        queryset = queryset.filter(
            Q(category__isnull=True) | Q(category__is_active=True)
        )
        category_slug = self.request.query_params.get("category")
        if category_slug:
            queryset = queryset.filter(category__slug=category_slug)
        return with_public_service_media(
            queryset.order_by("display_order", "title", "service__slug")
        )


class PublicServiceListView(PublicServiceQueryMixin, ListAPIView):
    pass


class PublicServiceDetailView(PublicServiceQueryMixin, RetrieveAPIView):
    lookup_field = "service__slug"
    lookup_url_kwarg = "slug"
