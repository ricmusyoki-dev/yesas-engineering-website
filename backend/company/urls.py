from django.urls import path

from .management_views import (
    CompanyDraftView,
    CompanyPreviewView,
    CompanyRevisionListView,
    CurrentCompanyContentView,
    CurrentHomepageContentView,
    HomepagePreviewView,
    HomepageRevisionListView,
    HomepageSectionDraftListView,
    HomepageSectionDraftView,
    PublishCompanyDraftView,
    PublishHomepageSectionDraftView,
    RestoreCompanyRevisionView,
    RestoreHomepageRevisionView,
)
from .public_views import PublicCompanyProfileView, PublicHomepageView

urlpatterns = [
    path("company/", PublicCompanyProfileView.as_view(), name="public-company"),
    path("homepage/", PublicHomepageView.as_view(), name="public-homepage"),
    path(
        "manage/company/",
        CurrentCompanyContentView.as_view(),
        name="manage-company",
    ),
    path(
        "manage/company/draft/",
        CompanyDraftView.as_view(),
        name="manage-company-draft",
    ),
    path(
        "manage/company/draft/publish/",
        PublishCompanyDraftView.as_view(),
        name="publish-company-draft",
    ),
    path(
        "manage/company/preview/",
        CompanyPreviewView.as_view(),
        name="preview-company-draft",
    ),
    path(
        "manage/company/revisions/",
        CompanyRevisionListView.as_view(),
        name="company-revisions",
    ),
    path(
        "manage/company/revisions/<int:revision_id>/restore/",
        RestoreCompanyRevisionView.as_view(),
        name="restore-company-revision",
    ),
    path(
        "manage/homepage/",
        CurrentHomepageContentView.as_view(),
        name="manage-homepage",
    ),
    path(
        "manage/homepage/preview/",
        HomepagePreviewView.as_view(),
        name="preview-homepage",
    ),
    path(
        "manage/homepage/sections/",
        HomepageSectionDraftListView.as_view(),
        name="manage-homepage-sections",
    ),
    path(
        "manage/homepage/sections/<str:section_type>/draft/",
        HomepageSectionDraftView.as_view(),
        name="manage-homepage-section-draft",
    ),
    path(
        "manage/homepage/sections/<str:section_type>/draft/publish/",
        PublishHomepageSectionDraftView.as_view(),
        name="publish-homepage-section-draft",
    ),
    path(
        "manage/homepage/revisions/",
        HomepageRevisionListView.as_view(),
        name="homepage-revisions",
    ),
    path(
        "manage/homepage/revisions/<int:revision_id>/restore/",
        RestoreHomepageRevisionView.as_view(),
        name="restore-homepage-revision",
    ),
]
