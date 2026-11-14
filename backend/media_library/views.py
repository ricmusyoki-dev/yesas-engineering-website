
import re
from pathlib import PurePosixPath
from urllib.parse import quote

from django.conf import settings
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db.models import Q
from django.http import HttpResponse, HttpResponseNotModified, StreamingHttpResponse
from django.shortcuts import get_object_or_404
from django.utils.http import content_disposition_header, http_date
from rest_framework import status
from rest_framework.exceptions import APIException, NotFound, ValidationError
from rest_framework.pagination import PageNumberPagination
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsOwnerOrTechnicalAdmin

from .asset_workflows import (
    AssetHasPublicReferences,
    archive_media_asset,
    restore_media_asset,
)
from .attachment_workflows import (
    attach_asset,
    detach_asset,
    list_revision_attachments,
    update_attachment,
)
from .models import MediaAsset, MediaLifecycle, MediaType
from .serializers import (
    MediaAssetMetadataSerializer,
    MediaAssetSerializer,
    MediaAssetUploadSerializer,
    MediaAttachmentInputSerializer,
    MediaAttachmentSerializer,
    MediaAttachmentUpdateSerializer,
)
from .upload_handlers import MediaUploadLimitHandler
from .upload_services import create_media_asset
from .visibility import can_deliver_publicly


class MediaUploadTooLarge(APIException):
    status_code = status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
    default_detail = "The upload exceeds the configured file size limit."
    default_code = "media_upload_too_large"


def _raise_api_validation(error):
    if hasattr(error, "message_dict"):
        raise ValidationError(error.message_dict) from error
    raise ValidationError(error.messages) from error


class MediaAssetPagination(PageNumberPagination):
    page_size = 20
    page_size_query_param = "page_size"
    max_page_size = 100


class MediaAssetCollectionView(APIView):
    permission_classes = (IsAuthenticated, IsOwnerOrTechnicalAdmin)
    parser_classes = (MultiPartParser, FormParser)
    pagination_class = MediaAssetPagination

    def initialize_request(self, request, *args, **kwargs):
        api_request = super().initialize_request(request, *args, **kwargs)
        if request.method == "POST":
            django_request = api_request._request
            django_request.media_upload_rejected = None
            django_request.upload_handlers.insert(
                0,
                MediaUploadLimitHandler(
                    django_request,
                    max(
                        settings.MEDIA_IMAGE_MAX_BYTES,
                        settings.MEDIA_VIDEO_MAX_BYTES,
                    ),
                ),
            )
        return api_request

    def get(self, request):
        assets = MediaAsset.objects.select_related("uploader", "archived_by")
        query = request.query_params.get("search", "").strip()
        if query:
            if len(query) > 200:
                raise ValidationError({"search": "Search text is too long."})
            assets = assets.filter(
                Q(title__icontains=query)
                | Q(display_filename__icontains=query)
                | Q(description__icontains=query)
            )
        media_type = request.query_params.get("media_type")
        if media_type:
            if media_type not in MediaType.values:
                raise ValidationError({"media_type": "Choose image or video."})
            assets = assets.filter(media_type=media_type)
        lifecycle = request.query_params.get("lifecycle")
        if lifecycle:
            if lifecycle not in MediaLifecycle.values:
                raise ValidationError({"lifecycle": "Choose active or archived."})
            assets = assets.filter(lifecycle=lifecycle)
        uploaded_by = request.query_params.get("uploaded_by")
        if uploaded_by:
            if not uploaded_by.isdecimal():
                raise ValidationError({"uploaded_by": "Use a numeric user id."})
            assets = assets.filter(uploader_id=uploaded_by)

        ordering = request.query_params.get("ordering", "-created_at")
        ordering_field = ordering.removeprefix("-")
        if ordering_field not in {"created_at", "title", "file_size"}:
            raise ValidationError({"ordering": "Choose a supported ordering field."})
        assets = assets.order_by(ordering, "pk")

        paginator = self.pagination_class()
        page = paginator.paginate_queryset(assets, request, view=self)
        return paginator.get_paginated_response(
            MediaAssetSerializer(page, many=True).data
        )

    def post(self, request):
        data = request.data
        if request._request.media_upload_rejected:
            raise MediaUploadTooLarge(
                request._request.media_upload_rejected,
            )
        serializer = MediaAssetUploadSerializer(data=data)
        serializer.is_valid(raise_exception=True)
        values = dict(serializer.validated_data)
        upload = values.pop("file")
        try:
            asset = create_media_asset(upload, request.user, **values)
        except DjangoValidationError as error:
            _raise_api_validation(error)
        return Response(
            MediaAssetSerializer(asset).data,
            status=status.HTTP_201_CREATED,
        )


class MediaAssetDetailView(APIView):
    permission_classes = (IsAuthenticated, IsOwnerOrTechnicalAdmin)

    def get(self, request, asset_id):
        asset = get_object_or_404(
            MediaAsset.objects.select_related("uploader", "archived_by"),
            pk=asset_id,
        )
        return Response(MediaAssetSerializer(asset).data)

    def patch(self, request, asset_id):
        asset = get_object_or_404(MediaAsset, pk=asset_id)
        serializer = MediaAssetMetadataSerializer(
            asset,
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        asset = serializer.save()
        return Response(MediaAssetSerializer(asset).data)


class ArchiveMediaAssetView(APIView):
    permission_classes = (IsAuthenticated, IsOwnerOrTechnicalAdmin)

    def post(self, request, asset_id):
        asset = get_object_or_404(MediaAsset, pk=asset_id)
        try:
            asset = archive_media_asset(asset, request.user)
        except AssetHasPublicReferences:
            return Response(
                {
                    "detail": (
                        "Remove the asset from all currently public content "
                        "before archiving it."
                    )
                },
                status=status.HTTP_409_CONFLICT,
            )
        except DjangoValidationError as error:
            _raise_api_validation(error)
        return Response(MediaAssetSerializer(asset).data)


class RestoreMediaAssetView(APIView):
    permission_classes = (IsAuthenticated, IsOwnerOrTechnicalAdmin)

    def post(self, request, asset_id):
        asset = get_object_or_404(MediaAsset, pk=asset_id)
        try:
            asset = restore_media_asset(asset)
        except DjangoValidationError as error:
            _raise_api_validation(error)
        return Response(MediaAssetSerializer(asset).data)


class MediaAttachmentListView(APIView):
    permission_classes = (IsAuthenticated, IsOwnerOrTechnicalAdmin)

    def get(self, request, target_type, revision_id):
        try:
            attachments = list_revision_attachments(target_type, revision_id)
        except DjangoValidationError as error:
            _raise_api_validation(error)
        return Response(MediaAttachmentSerializer(attachments, many=True).data)

    def post(self, request, target_type, revision_id):
        serializer = MediaAttachmentInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        values = dict(serializer.validated_data)
        asset = values.pop("asset")
        try:
            attachment = attach_asset(
                target_type,
                revision_id,
                asset.pk,
                request.user,
                **values,
            )
        except DjangoValidationError as error:
            _raise_api_validation(error)
        return Response(
            MediaAttachmentSerializer(attachment).data,
            status=status.HTTP_201_CREATED,
        )


class MediaAttachmentDetailView(APIView):
    permission_classes = (IsAuthenticated, IsOwnerOrTechnicalAdmin)

    def patch(self, request, target_type, revision_id, attachment_id):
        serializer = MediaAttachmentUpdateSerializer(
            data=request.data,
            partial=True,
        )
        serializer.is_valid(raise_exception=True)
        try:
            attachment = update_attachment(
                target_type,
                revision_id,
                attachment_id,
                changes=serializer.validated_data,
            )
        except DjangoValidationError as error:
            _raise_api_validation(error)
        return Response(MediaAttachmentSerializer(attachment).data)

    def delete(self, request, target_type, revision_id, attachment_id):
        try:
            detach_asset(target_type, revision_id, attachment_id)
        except DjangoValidationError as error:
            _raise_api_validation(error)
        return Response(status=status.HTTP_204_NO_CONTENT)


class MediaAssetContentView(APIView):
    permission_classes = (AllowAny,)

    def get(self, request, asset_id):
        asset = get_object_or_404(MediaAsset, pk=asset_id)
        if asset.lifecycle != MediaLifecycle.ACTIVE:
            raise NotFound("Media asset not found.")

        manager_access = IsOwnerOrTechnicalAdmin().has_permission(request, self)
        public_access = can_deliver_publicly(asset)
        if not manager_access and not public_access:
            raise NotFound("Media asset not found.")

        variant = request.query_params.get("variant", "original")
        if variant not in ("original", "thumbnail"):
            raise ValidationError({"variant": "Choose original or thumbnail."})
        if variant == "thumbnail" and asset.media_type != MediaType.IMAGE:
            raise ValidationError({"variant": "Only images have thumbnails."})

        file_field = asset.file if variant == "original" else asset.thumbnail
        if not file_field or not file_field.name or not file_field.storage.exists(
            file_field.name
        ):
            raise NotFound("Media content not found.")

        content_type = (
            asset.verified_mime_type if variant == "original" else "image/webp"
        )
        filename = (
            f"{asset.pk}-preview.webp"
            if variant == "thumbnail"
            else asset.display_filename
        )
        etag = f'"{asset.sha256}{"-thumb" if variant == "thumbnail" else ""}"'
        if (
            public_access
            and request.headers.get("If-None-Match") == etag
            and not request.headers.get("Range")
        ):
            response = HttpResponseNotModified()
            return self._set_headers(
                response,
                asset,
                filename,
                content_type,
                public_access,
                etag,
            )

        prefix = settings.MEDIA_X_ACCEL_PREFIX
        if prefix:
            response = self._x_accel_response(
                prefix,
                file_field.name,
                content_type,
            )
        else:
            response = self._stream_response(
                request,
                file_field,
                asset.file_size if variant == "original" else file_field.size,
            )
        return self._set_headers(
            response,
            asset,
            filename,
            content_type,
            public_access,
            etag,
        )

    @staticmethod
    def _stream_response(request, file_field, file_size):
        parsed_range = _parse_byte_range(
            request.headers.get("Range"),
            file_size,
        )
        if parsed_range is None:
            response = HttpResponse(status=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE)
            response["Content-Range"] = f"bytes */{file_size}"
            return response

        start, end, response_status = parsed_range
        content_length = end - start + 1

        def stream():
            with file_field.storage.open(file_field.name, "rb") as source:
                source.seek(start)
                remaining = content_length
                while remaining:
                    chunk = source.read(min(64 * 1024, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk

        response = StreamingHttpResponse(
            stream(),
            status=response_status,
        )
        response["Content-Length"] = str(content_length)
        response["Accept-Ranges"] = "bytes"
        if response_status == status.HTTP_206_PARTIAL_CONTENT:
            response["Content-Range"] = f"bytes {start}-{end}/{file_size}"
        return response

    @staticmethod
    def _x_accel_response(prefix, storage_key, content_type):
        if (
            not prefix.startswith("/")
            or prefix.startswith("//")
            or not prefix.endswith("/")
            or not prefix.isascii()
            or "\\" in prefix
            or any(character in prefix for character in "?#")
            or any(part in {".", ".."} for part in PurePosixPath(prefix).parts)
            or not re.fullmatch(
                r"(?:assets|previews)/[0-9a-f]{32}/[0-9a-f]{32}"
                r"\.(?:jpg|jpeg|png|webp|mp4|webm)",
                storage_key,
            )
        ):
            raise ValidationError("Invalid internal media delivery configuration.")
        response = HttpResponse()
        response["X-Accel-Redirect"] = prefix + quote(storage_key, safe="/")
        response["Accept-Ranges"] = "bytes"
        response["Content-Type"] = content_type
        return response

    @staticmethod
    def _set_headers(
        response,
        asset,
        filename,
        content_type,
        public_access,
        etag,
    ):
        response["Content-Type"] = content_type
        response["Content-Disposition"] = content_disposition_header(
            as_attachment=False,
            filename=filename,
        )
        response["X-Content-Type-Options"] = "nosniff"
        response["X-Frame-Options"] = "DENY"
        response["Referrer-Policy"] = "no-referrer"
        response["Content-Security-Policy"] = "default-src 'none'; sandbox"
        response["ETag"] = etag
        response["Last-Modified"] = http_date(asset.created_at.timestamp())
        response["Cache-Control"] = (
            "public, max-age=300, must-revalidate"
            if public_access
            else "private, no-store"
        )
        return response


def _parse_byte_range(value, size):
    if not value:
        return (0, size - 1, status.HTTP_200_OK)
    if len(value) > 128 or not value.startswith("bytes=") or "," in value:
        return None
    match = re.fullmatch(r"bytes=(\d*)-(\d*)", value.strip())
    if match is None:
        return None
    first, last = match.groups()
    if not first and not last:
        return None
    try:
        if not first:
            suffix_length = int(last)
            if suffix_length <= 0:
                return None
            start = max(size - suffix_length, 0)
            end = size - 1
        else:
            start = int(first)
            end = min(int(last), size - 1) if last else size - 1
            if start >= size or end < start:
                return None
    except ValueError:
        return None
    return start, end, status.HTTP_206_PARTIAL_CONTENT
