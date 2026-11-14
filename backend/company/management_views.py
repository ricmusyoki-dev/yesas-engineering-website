from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.db.models import Case, IntegerField, Value, When
from rest_framework import status
from rest_framework.exceptions import NotFound, ValidationError
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts.permissions import IsOwnerOrTechnicalAdmin

from .models import CompanyProfileRevision, HomepageSectionRevision, RevisionStatus
from .serializers import (
    CompanyProfileRevisionSerializer,
    HomepageSectionRevisionSerializer,
)
from .workflows import (
    ActiveDraftExists,
    create_profile_draft,
    create_section_draft,
    current_profile,
    publish_profile_draft,
    publish_section_draft,
    restore_profile_revision,
    restore_section_revision,
)


class OwnerManagementView(APIView):
    permission_classes = (IsAuthenticated, IsOwnerOrTechnicalAdmin)


def _conflict_response(message):
    return Response({"detail": message}, status=status.HTTP_409_CONFLICT)


def _active_homepage_sections():
    revisions = (
        HomepageSectionRevision.objects.filter(
            status__in=(RevisionStatus.DRAFT, RevisionStatus.PUBLISHED)
        )
        .annotate(
            draft_priority=Case(
                When(status=RevisionStatus.DRAFT, then=Value(0)),
                default=Value(1),
                output_field=IntegerField(),
            )
        )
        .order_by("draft_priority", "display_order", "section_type")
    )
    selected = {}
    for revision in revisions:
        selected.setdefault(revision.section_type, revision)
    return sorted(
        selected.values(),
        key=lambda revision: (revision.display_order, revision.section_type),
    )


class CurrentCompanyContentView(OwnerManagementView):
    def get(self, request):
        profile = current_profile()
        if profile is None:
            raise NotFound("Company profile content has not been created.")
        return Response(
            CompanyProfileRevisionSerializer(profile, context={"request": request}).data
        )


class CompanyDraftView(OwnerManagementView):
    def get(self, request):
        draft = CompanyProfileRevision.objects.filter(
            scope=CompanyProfileRevision.COMPANY_SCOPE,
            status=RevisionStatus.DRAFT,
        ).first()
        if draft is None:
            raise NotFound("No company profile draft exists.")
        return Response(
            CompanyProfileRevisionSerializer(draft, context={"request": request}).data
        )

    def post(self, request):
        try:
            with transaction.atomic():
                draft = create_profile_draft(request.user)
                serializer = CompanyProfileRevisionSerializer(
                    draft,
                    data=request.data,
                    partial=True,
                    context={"request": request},
                )
                serializer.is_valid(raise_exception=True)
                draft = serializer.save(updated_by=request.user)
        except ActiveDraftExists:
            return _conflict_response("A company profile draft already exists.")
        return Response(
            CompanyProfileRevisionSerializer(draft, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    def patch(self, request):
        draft = CompanyProfileRevision.objects.filter(
            scope=CompanyProfileRevision.COMPANY_SCOPE,
            status=RevisionStatus.DRAFT,
        ).first()
        if draft is None:
            raise NotFound("No company profile draft exists.")
        serializer = CompanyProfileRevisionSerializer(
            draft,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        draft = serializer.save()
        return Response(
            CompanyProfileRevisionSerializer(draft, context={"request": request}).data
        )


class CompanyPreviewView(OwnerManagementView):
    def get(self, request):
        draft = CompanyProfileRevision.objects.filter(
            scope=CompanyProfileRevision.COMPANY_SCOPE,
            status=RevisionStatus.DRAFT,
        ).first()
        if draft is None:
            raise NotFound("No company profile draft exists to preview.")
        return Response(
            CompanyProfileRevisionSerializer(draft, context={"request": request}).data
        )


class CompanyRevisionListView(OwnerManagementView):
    def get(self, request):
        revisions = CompanyProfileRevision.objects.order_by("-created_at", "-pk")
        return Response(
            CompanyProfileRevisionSerializer(
                revisions, many=True, context={"request": request}
            ).data
        )


class PublishCompanyDraftView(OwnerManagementView):
    def post(self, request):
        try:
            revision = publish_profile_draft(request.user)
        except DjangoValidationError as error:
            raise ValidationError(error.message_dict) from error
        if revision is None:
            raise NotFound("No company profile draft exists to publish.")
        return Response(
            CompanyProfileRevisionSerializer(
                revision, context={"request": request}
            ).data
        )


class RestoreCompanyRevisionView(OwnerManagementView):
    def post(self, request, revision_id):
        revision = CompanyProfileRevision.objects.filter(
            pk=revision_id,
            status=RevisionStatus.ARCHIVED,
        ).first()
        if revision is None:
            raise NotFound("Archived company revision not found.")
        try:
            restored = restore_profile_revision(revision, request.user)
        except ActiveDraftExists:
            return _conflict_response("A company profile draft already exists.")
        except DjangoValidationError as error:
            raise ValidationError(error.message_dict) from error
        return Response(
            CompanyProfileRevisionSerializer(
                restored, context={"request": request}
            ).data,
            status=status.HTTP_201_CREATED,
        )


class CurrentHomepageContentView(OwnerManagementView):
    def get(self, request):
        return Response(
            HomepageSectionRevisionSerializer(
                _active_homepage_sections(),
                many=True,
                context={"request": request},
            ).data
        )


class HomepageSectionDraftListView(OwnerManagementView):
    def get(self, request):
        return self._response(_active_homepage_sections(), request)

    def post(self, request):
        section_type = request.data.get("section_type")
        allowed_types = HomepageSectionRevision.SectionType.values
        if (
            not isinstance(section_type, str)
            or section_type.upper() not in allowed_types
        ):
            raise ValidationError({"section_type": "Select a valid section type."})
        section_type = section_type.upper()
        try:
            with transaction.atomic():
                draft = create_section_draft(section_type, request.user)
                serializer = HomepageSectionRevisionSerializer(
                    draft,
                    data=request.data,
                    partial=True,
                    context={"request": request},
                )
                serializer.is_valid(raise_exception=True)
                draft = serializer.save(updated_by=request.user)
        except ActiveDraftExists:
            return _conflict_response("A draft for this section already exists.")
        return Response(
            HomepageSectionRevisionSerializer(draft, context={"request": request}).data,
            status=status.HTTP_201_CREATED,
        )

    @staticmethod
    def _response(sections, request):
        return Response(
            HomepageSectionRevisionSerializer(
                sections, many=True, context={"request": request}
            ).data
        )


class HomepageSectionDraftView(OwnerManagementView):
    def get_object(self, section_type):
        normalized_type = section_type.upper()
        if normalized_type not in HomepageSectionRevision.SectionType.values:
            raise NotFound("Homepage section not found.")
        draft = HomepageSectionRevision.objects.filter(
            section_type=normalized_type,
            status=RevisionStatus.DRAFT,
        ).first()
        if draft is None:
            raise NotFound("No draft exists for this homepage section.")
        return draft

    def get(self, request, section_type):
        draft = self.get_object(section_type)
        return Response(
            HomepageSectionRevisionSerializer(draft, context={"request": request}).data
        )

    def patch(self, request, section_type):
        draft = self.get_object(section_type)
        serializer = HomepageSectionRevisionSerializer(
            draft,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        draft = serializer.save()
        return Response(
            HomepageSectionRevisionSerializer(draft, context={"request": request}).data
        )


class HomepagePreviewView(OwnerManagementView):
    def get(self, request):
        return Response(
            HomepageSectionRevisionSerializer(
                _active_homepage_sections(),
                many=True,
                context={"request": request},
            ).data
        )


class HomepageRevisionListView(OwnerManagementView):
    def get(self, request):
        revisions = HomepageSectionRevision.objects.all()
        section_type = request.query_params.get("section_type")
        if section_type:
            section_type = section_type.upper()
            if section_type not in HomepageSectionRevision.SectionType.values:
                raise ValidationError({"section_type": "Select a valid section type."})
            revisions = revisions.filter(section_type=section_type)
        return Response(
            HomepageSectionRevisionSerializer(
                revisions, many=True, context={"request": request}
            ).data
        )


class PublishHomepageSectionDraftView(OwnerManagementView):
    def post(self, request, section_type):
        normalized_type = section_type.upper()
        if normalized_type not in HomepageSectionRevision.SectionType.values:
            raise NotFound("Homepage section not found.")
        try:
            revision = publish_section_draft(normalized_type, request.user)
        except DjangoValidationError as error:
            raise ValidationError(error.message_dict) from error
        if revision is None:
            raise NotFound("No draft exists for this homepage section.")
        return Response(
            HomepageSectionRevisionSerializer(
                revision, context={"request": request}
            ).data
        )


class RestoreHomepageRevisionView(OwnerManagementView):
    def post(self, request, revision_id):
        revision = HomepageSectionRevision.objects.filter(
            pk=revision_id,
            status=RevisionStatus.ARCHIVED,
        ).first()
        if revision is None:
            raise NotFound("Archived homepage revision not found.")
        try:
            restored = restore_section_revision(revision, request.user)
        except ActiveDraftExists:
            return _conflict_response("A draft for this section already exists.")
        except DjangoValidationError as error:
            raise ValidationError(error.message_dict) from error
        return Response(
            HomepageSectionRevisionSerializer(
                restored, context={"request": request}
            ).data,
            status=status.HTTP_201_CREATED,
        )
