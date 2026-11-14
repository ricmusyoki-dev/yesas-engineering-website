from django.urls import path

from .views import (
    ArchiveMediaAssetView,
    MediaAssetCollectionView,
    MediaAssetContentView,
    MediaAssetDetailView,
    MediaAttachmentDetailView,
    MediaAttachmentListView,
    RestoreMediaAssetView,
)

urlpatterns = [
    path("assets/", MediaAssetCollectionView.as_view(), name="media-assets"),
    path(
        "assets/<uuid:asset_id>/",
        MediaAssetDetailView.as_view(),
        name="media-asset-detail",
    ),
    path(
        "assets/<uuid:asset_id>/archive/",
        ArchiveMediaAssetView.as_view(),
        name="media-asset-archive",
    ),
    path(
        "assets/<uuid:asset_id>/restore/",
        RestoreMediaAssetView.as_view(),
        name="media-asset-restore",
    ),
    path(
        "assets/<uuid:asset_id>/content/",
        MediaAssetContentView.as_view(),
        name="media-asset-content",
    ),
    path(
        "attachments/<str:target_type>/<int:revision_id>/",
        MediaAttachmentListView.as_view(),
        name="media-attachment-list",
    ),
    path(
        "attachments/<str:target_type>/<int:revision_id>/<int:attachment_id>/",
        MediaAttachmentDetailView.as_view(),
        name="media-attachment-detail",
    ),
]
