from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsOwnerOrTechnicalAdmin
from company.models import RevisionStatus

from .models import Service, ServiceCategory, ServiceRevision
from .serializers import (
    ServiceCategorySerializer,
    ServiceDraftContentSerializer,
    ServiceManagementSerializer,
    ServiceRevisionSerializer,
)
from .workflows import (
    ActiveServiceDraftExists,
    archive_service,
    create_revision_draft,
    create_service_draft,
    discard_service_draft,
    publish_service_draft,
    restore_service_revision,
    update_category,
)


class OwnerManagementView(APIView):
    permission_classes = (IsAuthenticated, IsOwnerOrTechnicalAdmin)


class ServiceIdentitySerializer(serializers.Serializer):
    slug = serializers.SlugField(max_length=180)


def _service_or_404(slug):
    return get_object_or_404(Service, slug=slug)


def _validation_response(error):
    if hasattr(error, "message_dict"):
        detail = error.message_dict
    else:
        detail = error.messages
    return Response(detail, status=status.HTTP_400_BAD_REQUEST)


class ServiceManagementListView(OwnerManagementView):
    def get(self, request):
        services = Service.objects.order_by("slug")
        return Response(
            ServiceManagementSerializer(
                services, many=True, context={"request": request}
            ).data
        )

    def post(self, request):
        if not isinstance(request.data, dict):
            raise ValidationError({"detail": "Expected a JSON object."})
        identity = ServiceIdentitySerializer(data={"slug": request.data.get("slug")})
        identity.is_valid(raise_exception=True)
        if Service.objects.filter(slug=identity.validated_data["slug"]).exists():
            return Response(
                {"slug": ["A service with this slug already exists."]},
                status=status.HTTP_409_CONFLICT,
            )
        content = ServiceDraftContentSerializer(data=request.data, partial=True)
        content.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                revision = create_service_draft(
                    identity.validated_data["slug"],
                    request.user,
                    content.validated_data,
                )
        except IntegrityError:
            return Response(
                {"slug": ["A service with this slug already exists."]},
                status=status.HTTP_409_CONFLICT,
            )
        except DjangoValidationError as error:
            return _validation_response(error)
        return Response(
            ServiceRevisionSerializer(revision, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class ServiceManagementDetailView(OwnerManagementView):
    def get(self, request, slug):
        service = _service_or_404(slug)
        return Response(
            ServiceManagementSerializer(service, context={"request": request}).data
        )


class ServiceDraftView(OwnerManagementView):
    def post(self, request, slug):
        service = _service_or_404(slug)
        try:
            revision = create_revision_draft(service, request.user)
        except ActiveServiceDraftExists:
            return Response(
                {"detail": "A draft already exists for this service."},
                status=status.HTTP_409_CONFLICT,
            )
        except DjangoValidationError as error:
            return _validation_response(error)
        return Response(
            ServiceRevisionSerializer(revision, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def get(self, request, slug):
        service = _service_or_404(slug)
        revision = service.revisions.filter(status=RevisionStatus.DRAFT).first()
        if revision is None:
            raise NotFound("No service draft exists.")
        return Response(
            ServiceRevisionSerializer(revision, context={"request": request}).data
        )

    def patch(self, request, slug):
        service = _service_or_404(slug)
        revision = service.revisions.filter(status=RevisionStatus.DRAFT).first()
        if revision is None:
            raise NotFound("No service draft exists.")
        serializer = ServiceRevisionSerializer(
            revision,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        revision = serializer.save()
        service.updated_by = request.user
        service.save(update_fields=("updated_by", "updated_at"))
        return Response(
            ServiceRevisionSerializer(revision, context={"request": request}).data
        )


class ServicePreviewView(OwnerManagementView):
    def get(self, request, slug):
        service = _service_or_404(slug)
        revision = service.revisions.filter(status=RevisionStatus.DRAFT).first()
        if revision is None:
            raise NotFound("No service draft exists to preview.")
        return Response(
            ServiceRevisionSerializer(revision, context={"request": request}).data
        )


class ServiceRevisionListView(OwnerManagementView):
    def get(self, request, slug):
        service = _service_or_404(slug)
        revisions = service.revisions.select_related("category").order_by(
            "-created_at", "-pk"
        )
        return Response(
            ServiceRevisionSerializer(
                revisions, many=True, context={"request": request}
            ).data
        )


class PublishServiceDraftView(OwnerManagementView):
    def post(self, request, slug):
        service = _service_or_404(slug)
        try:
            revision = publish_service_draft(service, request.user)
        except DjangoValidationError as error:
            return _validation_response(error)
        if revision is None:
            raise NotFound("No service draft exists to publish.")
        service.updated_by = request.user
        service.save(update_fields=("updated_by", "updated_at"))
        return Response(
            ServiceRevisionSerializer(revision, context={"request": request}).data
        )


class DiscardServiceDraftView(OwnerManagementView):
    def post(self, request, slug):
        service = _service_or_404(slug)
        if not discard_service_draft(service):
            raise NotFound("No service draft exists to discard.")
        return Response(status=status.HTTP_204_NO_CONTENT)


class ArchiveServiceView(OwnerManagementView):
    def post(self, request, slug):
        service = _service_or_404(slug)
        try:
            service = archive_service(service, request.user)
        except DjangoValidationError as error:
            return _validation_response(error)
        return Response(
            ServiceManagementSerializer(service, context={"request": request}).data
        )


class RestoreServiceRevisionView(OwnerManagementView):
    def post(self, request, slug, revision_id):
        service = _service_or_404(slug)
        revision = get_object_or_404(
            ServiceRevision,
            service=service,
            pk=revision_id,
            status=RevisionStatus.ARCHIVED,
        )
        try:
            restored = restore_service_revision(revision, request.user)
        except ActiveServiceDraftExists:
            return Response(
                {"detail": "A draft already exists for this service."},
                status=status.HTTP_409_CONFLICT,
            )
        except DjangoValidationError as error:
            return _validation_response(error)
        return Response(
            ServiceRevisionSerializer(restored, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class ServiceCategoryListView(OwnerManagementView):
    def get(self, request):
        categories = ServiceCategory.objects.order_by("display_order", "name")
        return Response(
            ServiceCategorySerializer(
                categories, many=True, context={"request": request}
            ).data
        )

    def post(self, request):
        serializer = ServiceCategorySerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        try:
            category = serializer.save()
        except DjangoValidationError as error:
            return _validation_response(error)
        except IntegrityError:
            return Response(
                {"detail": "A category with this name or slug already exists."},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(
            ServiceCategorySerializer(category, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )


class ServiceCategoryDetailView(OwnerManagementView):
    def get(self, request, slug):
        category = get_object_or_404(ServiceCategory, slug=slug)
        return Response(
            ServiceCategorySerializer(category, context={"request": request}).data
        )

    def patch(self, request, slug):
        category = get_object_or_404(ServiceCategory, slug=slug)
        serializer = ServiceCategorySerializer(
            category,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        try:
            category = update_category(
                category,
                request.user,
                **serializer.validated_data,
            )
        except DjangoValidationError as error:
            return _validation_response(error)
        except IntegrityError:
            return Response(
                {"detail": "A category with this name or slug already exists."},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(
            ServiceCategorySerializer(category, context={"request": request}).data
        )
