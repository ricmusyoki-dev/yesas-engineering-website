from rest_framework.exceptions import ValidationError
from rest_framework.generics import ListAPIView, RetrieveAPIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.permissions import AllowAny

from .public_serializers import PublicProjectSerializer, public_project_revisions


class ProjectListPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = "page_size"
    max_page_size = 100


class PublicProjectQueryMixin:
    permission_classes = (AllowAny,)
    serializer_class = PublicProjectSerializer

    def get_queryset(self):
        queryset = public_project_revisions()
        category = self.request.query_params.get("category")
        if category:
            queryset = queryset.filter(category__slug=category)

        tag = self.request.query_params.get("tag")
        if tag:
            queryset = queryset.filter(tags__is_active=True, tags__slug=tag)

        featured = self.request.query_params.get("featured")
        if featured is not None:
            normalized = featured.lower()
            if normalized not in ("true", "false"):
                raise ValidationError(
                    {"featured": "Use 'true' or 'false' for featured filtering."}
                )
            queryset = queryset.filter(is_featured=normalized == "true")
        return queryset.distinct().order_by(
            "display_order",
            "title",
            "project__slug",
        )


class PublicProjectListView(PublicProjectQueryMixin, ListAPIView):
    pagination_class = ProjectListPagination


class PublicProjectDetailView(PublicProjectQueryMixin, RetrieveAPIView):
    lookup_field = "project__slug"
    lookup_url_kwarg = "slug"
