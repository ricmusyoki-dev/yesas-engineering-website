from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import CompanyProfileRevision, HomepageSectionRevision, RevisionStatus
from .serializers import (
    CompanyProfileContentSerializer,
    PublicHomepageSectionSerializer,
)


class PublicCompanyProfileView(APIView):
    permission_classes = (AllowAny,)

    def get(self, request):
        profile = CompanyProfileRevision.objects.filter(
            scope=CompanyProfileRevision.COMPANY_SCOPE,
            status=RevisionStatus.PUBLISHED,
        ).first()
        if profile is None:
            return Response({"detail": "Company profile not found."}, status=404)
        return Response(CompanyProfileContentSerializer(profile).data)


class PublicHomepageView(APIView):
    permission_classes = (AllowAny,)

    def get(self, request):
        sections = HomepageSectionRevision.objects.filter(
            status=RevisionStatus.PUBLISHED,
            is_visible=True,
        )
        return Response(
            {
                "sections": PublicHomepageSectionSerializer(
                    sections, many=True, context={"request": request}
                ).data
            }
        )
