from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import IntegrityError, transaction
from django.shortcuts import get_object_or_404
from rest_framework import serializers, status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsOwnerOrTechnicalAdmin

from .models import (
    Project,
    ProjectAvailability,
    ProjectCategory,
    ProjectRevision,
    ProjectRevisionStatus,
    ProjectTag,
)
from .serializers import (
    ProjectCategorySerializer,
    ProjectContentSerializer,
    ProjectIdentitySerializer,
    ProjectManagementSerializer,
    ProjectRevisionSerializer,
    ProjectTagSerializer,
)
from .workflows import (
    ActiveProjectDraftExists,
    ProjectSlugConflict,
    archive_project,
    create_project_draft,
    create_revision_draft,
    discard_project_draft,
    publish_project_draft,
    restore_project_revision,
    set_project_availability,
    update_project_category,
    update_project_tag,
)


class OwnerManagementView(APIView):
    permission_classes = (IsAuthenticated, IsOwnerOrTechnicalAdmin)


def _validation_response(error):
    if hasattr(error, "message_dict"):
        detail = error.message_dict
    else:
        detail = error.messages
    return Response(detail, status=status.HTTP_400_BAD_REQUEST)


def _project_or_404(slug):
    return get_object_or_404(Project, slug=slug)


class ProjectManagementListView(OwnerManagementView):
    def get(self, request):
        projects = Project.objects.order_by("slug")
        return Response(
            ProjectManagementSerializer(
                projects,
                many=True,
                context={"request": request},
            ).data
        )

    def post(self, request):
        if not isinstance(request.data, dict):
            raise ValidationError({"detail": "Expected a JSON object."})
        identity = ProjectIdentitySerializer(data={"slug": request.data.get("slug")})
        identity.is_valid(raise_exception=True)
        if Project.objects.filter(slug=identity.validated_data["slug"]).exists():
            return Response(
                {"slug": ["A project with this slug already exists."]},
                status=status.HTTP_409_CONFLICT,
            )
        content = ProjectContentSerializer(
            data=request.data,
            partial=True,
            context={"request": request},
        )
        content.is_valid(raise_exception=True)
        try:
            revision = create_project_draft(
                identity.validated_data["slug"],
                request.user,
                content.validated_data,
            )
        except ProjectSlugConflict:
            return Response(
                {"slug": ["A project with this slug already exists."]},
                status=status.HTTP_409_CONFLICT,
            )
        except DjangoValidationError as error:
            return _validation_response(error)
        return Response(
            ProjectManagementSerializer(
                revision.project,
                context={"request": request},
            ).data,
            status=status.HTTP_201_CREATED,
        )


class ProjectManagementDetailView(OwnerManagementView):
    def get(self, request, slug):
        project = _project_or_404(slug)
        return Response(
            ProjectManagementSerializer(
                project,
                context={"request": request},
            ).data
        )


class ProjectDraftView(OwnerManagementView):
    def get(self, request, slug):
        project = _project_or_404(slug)
        revision = project.revisions.filter(status=ProjectRevisionStatus.DRAFT).first()
        if revision is None:
            raise NotFound("No project draft exists.")
        return Response(
            ProjectRevisionSerializer(
                revision,
                context={"request": request},
            ).data
        )

    def post(self, request, slug):
        project = _project_or_404(slug)
        try:
            revision = create_revision_draft(project, request.user)
        except ActiveProjectDraftExists:
            return Response(
                {"detail": "A draft already exists for this project."},
                status=status.HTTP_409_CONFLICT,
            )
        except DjangoValidationError as error:
            return _validation_response(error)
        return Response(
            ProjectRevisionSerializer(
                revision,
                context={"request": request},
            ).data,
            status=status.HTTP_201_CREATED,
        )

    def patch(self, request, slug):
        project = _project_or_404(slug)
        if project.availability == ProjectAvailability.ARCHIVED:
            raise ValidationError("Archived projects cannot be edited.")
        revision = project.revisions.filter(status=ProjectRevisionStatus.DRAFT).first()
        if revision is None:
            raise NotFound("No project draft exists.")
        serializer = ProjectRevisionSerializer(
            revision,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        try:
            with transaction.atomic():
                revision = serializer.save()
                project.updated_by = request.user
                project.save(update_fields=("updated_by", "updated_at"))
        except DjangoValidationError as error:
            return _validation_response(error)
        return Response(
            ProjectRevisionSerializer(
                revision,
                context={"request": request},
            ).data
        )


class ProjectPreviewView(OwnerManagementView):
    def get(self, request, slug):
        project = _project_or_404(slug)
        revision = project.revisions.filter(status=ProjectRevisionStatus.DRAFT).first()
        if revision is None:
            raise NotFound("No project draft exists to preview.")
        return Response(
            ProjectRevisionSerializer(
                revision,
                context={"request": request},
            ).data
        )


class ProjectRevisionListView(OwnerManagementView):
    def get(self, request, slug):
        project = _project_or_404(slug)
        revisions = project.revisions.select_related("category").order_by(
            "-created_at",
            "-pk",
        )
        return Response(
            ProjectRevisionSerializer(
                revisions,
                many=True,
                context={"request": request},
            ).data
        )


class PublishProjectDraftView(OwnerManagementView):
    def post(self, request, slug):
        project = _project_or_404(slug)
        try:
            revision = publish_project_draft(project, request.user)
        except DjangoValidationError as error:
            return _validation_response(error)
        if revision is None:
            raise NotFound("No project draft exists to publish.")
        return Response(
            ProjectRevisionSerializer(
                revision,
                context={"request": request},
            ).data
        )


class DiscardProjectDraftView(OwnerManagementView):
    def post(self, request, slug):
        project = _project_or_404(slug)
        if not discard_project_draft(project):
            raise NotFound("No project draft exists to discard.")
        return Response(status=status.HTTP_204_NO_CONTENT)


class ArchiveProjectView(OwnerManagementView):
    def post(self, request, slug):
        project = _project_or_404(slug)
        try:
            project = archive_project(project, request.user)
        except DjangoValidationError as error:
            return _validation_response(error)
        return Response(
            ProjectManagementSerializer(
                project,
                context={"request": request},
            ).data
        )


class ProjectAvailabilityInputSerializer(serializers.Serializer):
    availability = serializers.ChoiceField(
        choices=(
            ProjectAvailability.ENABLED,
            ProjectAvailability.DISABLED,
        )
    )


class ProjectAvailabilityView(OwnerManagementView):
    def patch(self, request, slug):
        project = _project_or_404(slug)
        serializer = ProjectAvailabilityInputSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            project = set_project_availability(
                project,
                request.user,
                serializer.validated_data["availability"],
            )
        except DjangoValidationError as error:
            return _validation_response(error)
        return Response(
            ProjectManagementSerializer(
                project,
                context={"request": request},
            ).data
        )


class RestoreProjectRevisionView(OwnerManagementView):
    def post(self, request, slug, revision_id):
        project = _project_or_404(slug)
        revision = get_object_or_404(
            ProjectRevision,
            project=project,
            pk=revision_id,
            status=ProjectRevisionStatus.ARCHIVED,
        )
        try:
            restored = restore_project_revision(revision, request.user)
        except ActiveProjectDraftExists:
            return Response(
                {"detail": "A draft already exists for this project."},
                status=status.HTTP_409_CONFLICT,
            )
        except DjangoValidationError as error:
            return _validation_response(error)
        return Response(
            ProjectRevisionSerializer(
                restored,
                context={"request": request},
            ).data,
            status=status.HTTP_201_CREATED,
        )


class ProjectCategoryListView(OwnerManagementView):
    def get(self, request):
        categories = ProjectCategory.objects.order_by("display_order", "name")
        return Response(
            ProjectCategorySerializer(categories, many=True).data
        )

    def post(self, request):
        serializer = ProjectCategorySerializer(
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
            ProjectCategorySerializer(category).data,
            status=status.HTTP_201_CREATED,
        )


class ProjectCategoryDetailView(OwnerManagementView):
    def get(self, request, slug):
        category = get_object_or_404(ProjectCategory, slug=slug)
        return Response(ProjectCategorySerializer(category).data)

    def patch(self, request, slug):
        category = get_object_or_404(ProjectCategory, slug=slug)
        serializer = ProjectCategorySerializer(
            category,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        try:
            category = update_project_category(
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
        return Response(ProjectCategorySerializer(category).data)


class ProjectTagListView(OwnerManagementView):
    def get(self, request):
        tags = ProjectTag.objects.order_by("name")
        return Response(ProjectTagSerializer(tags, many=True).data)

    def post(self, request):
        serializer = ProjectTagSerializer(
            data=request.data,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        try:
            tag = serializer.save()
        except DjangoValidationError as error:
            return _validation_response(error)
        except IntegrityError:
            return Response(
                {"detail": "A tag with this name or slug already exists."},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(
            ProjectTagSerializer(tag).data,
            status=status.HTTP_201_CREATED,
        )


class ProjectTagDetailView(OwnerManagementView):
    def get(self, request, slug):
        tag = get_object_or_404(ProjectTag, slug=slug)
        return Response(ProjectTagSerializer(tag).data)

    def patch(self, request, slug):
        tag = get_object_or_404(ProjectTag, slug=slug)
        serializer = ProjectTagSerializer(
            tag,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        try:
            tag = update_project_tag(
                tag,
                request.user,
                **serializer.validated_data,
            )
        except DjangoValidationError as error:
            return _validation_response(error)
        except IntegrityError:
            return Response(
                {"detail": "A tag with this name or slug already exists."},
                status=status.HTTP_409_CONFLICT,
            )
        return Response(ProjectTagSerializer(tag).data)
