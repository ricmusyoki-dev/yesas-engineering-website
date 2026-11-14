from django.contrib.auth import get_user_model
from django.test import TestCase, override_settings
from django.urls import reverse
from rest_framework.test import APIClient

from company.models import (
    CompanyProfileMediaAttachment,
    CompanyProfileRevision,
    HomepageSectionMediaAttachment,
    HomepageSectionRevision,
    RevisionStatus,
)
from media_library.asset_workflows import (
    AssetHasPublicReferences,
    archive_media_asset,
    restore_media_asset,
)
from media_library.models import AttachmentRole, MediaLifecycle
from media_library.test_utils import (
    TemporaryMediaStorageMixin,
    image_upload,
    mp4_upload,
)
from media_library.upload_services import create_media_asset
from media_library.visibility import can_deliver_publicly, has_public_reference
from projects.models import (
    Project,
    ProjectAvailability,
    ProjectMediaAttachment,
    ProjectRevision,
    ProjectRevisionStatus,
)
from services.models import (
    Service,
    ServiceMediaAttachment,
    ServiceRevision,
)


class MediaVisibilityTests(TemporaryMediaStorageMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.owner = get_user_model().objects.create_user("owner@example.com")

    def test_published_references_control_public_asset_visibility(self):
        asset = create_media_asset(image_upload(), self.owner)
        project = Project.objects.create(
            slug="public-project",
            created_by=self.owner,
            updated_by=self.owner,
        )
        project_revision = ProjectRevision.objects.create(
            project=project,
            status=ProjectRevisionStatus.PUBLISHED,
            title="Project",
            summary="Summary",
            description="Description",
            created_by=self.owner,
            updated_by=self.owner,
            published_by=self.owner,
        )
        ProjectMediaAttachment.objects.create(
            revision=project_revision,
            asset=asset,
            role=AttachmentRole.COVER_IMAGE,
            created_by=self.owner,
        )

        service = Service.objects.create(
            slug="public-service",
            created_by=self.owner,
            updated_by=self.owner,
        )
        service_revision = ServiceRevision.objects.create(
            service=service,
            status=RevisionStatus.PUBLISHED,
            title="Service",
            summary="Summary",
            description="Description",
            created_by=self.owner,
            updated_by=self.owner,
            published_by=self.owner,
        )
        ServiceMediaAttachment.objects.create(
            revision=service_revision,
            asset=asset,
            role=AttachmentRole.COVER_IMAGE,
            created_by=self.owner,
        )

        company_revision = CompanyProfileRevision.objects.create(
            status=RevisionStatus.PUBLISHED,
            created_by=self.owner,
            updated_by=self.owner,
            published_by=self.owner,
        )
        CompanyProfileMediaAttachment.objects.create(
            revision=company_revision,
            asset=asset,
            role=AttachmentRole.LOGO,
            created_by=self.owner,
        )

        section_revision = HomepageSectionRevision.objects.create(
            section_type=HomepageSectionRevision.SectionType.HERO,
            status=RevisionStatus.PUBLISHED,
            heading="Welcome",
            created_by=self.owner,
            updated_by=self.owner,
            published_by=self.owner,
        )
        HomepageSectionMediaAttachment.objects.create(
            revision=section_revision,
            asset=asset,
            role=AttachmentRole.HERO_IMAGE,
            created_by=self.owner,
        )

        self.assertTrue(has_public_reference(asset))
        self.assertTrue(can_deliver_publicly(asset))

        Project.objects.filter(pk=project.pk).update(
            availability=ProjectAvailability.DISABLED
        )
        self.assertTrue(has_public_reference(asset))
        ServiceRevision.objects.filter(pk=service_revision.pk).update(is_enabled=False)
        self.assertTrue(has_public_reference(asset))
        CompanyProfileRevision.objects.filter(pk=company_revision.pk).update(
            status=RevisionStatus.ARCHIVED
        )
        self.assertTrue(has_public_reference(asset))
        HomepageSectionRevision.objects.filter(pk=section_revision.pk).update(
            is_visible=False
        )

        self.assertFalse(has_public_reference(asset))
        self.assertFalse(can_deliver_publicly(asset))

    def test_public_endpoint_streams_only_published_assets_and_supports_ranges(self):
        asset = create_media_asset(mp4_upload(padding=b"range-test"), self.owner)
        client = APIClient()
        content_url = reverse("media-asset-content", kwargs={"asset_id": asset.pk})

        response = client.get(content_url)
        self.assertEqual(response.status_code, 404)

        project = Project.objects.create(
            slug="range-project",
            created_by=self.owner,
            updated_by=self.owner,
        )
        revision = ProjectRevision.objects.create(
            project=project,
            status=ProjectRevisionStatus.PUBLISHED,
            title="Project",
            summary="Summary",
            description="Description",
            created_by=self.owner,
            updated_by=self.owner,
            published_by=self.owner,
        )
        ProjectMediaAttachment.objects.create(
            revision=revision,
            asset=asset,
            role=AttachmentRole.VIDEO,
            created_by=self.owner,
        )

        response = client.get(content_url, HTTP_RANGE="bytes=0-4")
        self.assertEqual(response.status_code, 206)
        self.assertEqual(response["Content-Range"], f"bytes 0-4/{asset.file_size}")
        self.assertEqual(b"".join(response.streaming_content), asset.file.read()[:5])
        self.assertEqual(response["Cache-Control"], "public, max-age=300, must-revalidate")
        self.assertEqual(response["X-Content-Type-Options"], "nosniff")

    def test_public_references_block_archiving_until_removed(self):
        asset = create_media_asset(image_upload(), self.owner)
        project = Project.objects.create(
            slug="archive-project",
            created_by=self.owner,
            updated_by=self.owner,
        )
        revision = ProjectRevision.objects.create(
            project=project,
            status=ProjectRevisionStatus.PUBLISHED,
            title="Project",
            summary="Summary",
            description="Description",
            created_by=self.owner,
            updated_by=self.owner,
            published_by=self.owner,
        )
        ProjectMediaAttachment.objects.create(
            revision=revision,
            asset=asset,
            role=AttachmentRole.COVER_IMAGE,
            created_by=self.owner,
        )

        with self.assertRaises(AssetHasPublicReferences):
            archive_media_asset(asset, self.owner)

        Project.objects.filter(pk=project.pk).update(
            availability=ProjectAvailability.DISABLED
        )
        archived = archive_media_asset(asset, self.owner)
        self.assertEqual(archived.lifecycle, MediaLifecycle.ARCHIVED)
        restored = restore_media_asset(archived)
        self.assertEqual(restored.lifecycle, MediaLifecycle.ACTIVE)

    @override_settings(MEDIA_X_ACCEL_PREFIX="/internal/media/")
    def test_x_accel_response_uses_the_private_storage_key(self):
        asset = create_media_asset(image_upload(), self.owner)
        client = APIClient()
        client.force_authenticate(self.owner)

        response = client.get(
            reverse("media-asset-content", kwargs={"asset_id": asset.pk})
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response["X-Accel-Redirect"],
            f"/internal/media/{asset.file.name}",
        )
        self.assertFalse(hasattr(response, "streaming_content"))

    @override_settings(MEDIA_X_ACCEL_PREFIX="/internal/../public/")
    def test_x_accel_rejects_a_traversal_prefix(self):
        asset = create_media_asset(image_upload(), self.owner)
        client = APIClient()
        client.force_authenticate(self.owner)

        response = client.get(
            reverse("media-asset-content", kwargs={"asset_id": asset.pk})
        )

        self.assertEqual(response.status_code, 400)

    def test_archived_asset_is_never_publicly_delivered(self):
        asset = create_media_asset(image_upload(), self.owner)
        asset.lifecycle = MediaLifecycle.ARCHIVED
        asset.archived_at = asset.created_at
        asset.archived_by = self.owner
        asset.save()

        response = APIClient().get(
            reverse("media-asset-content", kwargs={"asset_id": asset.pk})
        )

        self.assertEqual(response.status_code, 404)
        self.assertFalse(can_deliver_publicly(asset))
