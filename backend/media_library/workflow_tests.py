from django.core.exceptions import ValidationError
from django.test import TestCase
from django.utils import timezone

from accounts.models import User
from company.models import HomepageSectionRevision
from company.workflows import (
    create_profile_draft,
    create_section_draft,
    publish_profile_draft,
    publish_section_draft,
)
from media_library.attachment_workflows import (
    attach_asset,
    copy_revision_attachments,
    detach_asset,
    validate_revision_attachments,
)
from media_library.models import (
    AttachmentRole,
    MediaLifecycle,
)
from media_library.test_utils import (
    TemporaryMediaStorageMixin,
    image_upload,
    mp4_upload,
)
from media_library.upload_services import create_media_asset
from projects.models import (
    Project,
    ProjectAvailability,
    ProjectMediaAttachment,
    ProjectRevision,
    ProjectRevisionStatus,
)
from projects.workflows import create_revision_draft, publish_project_draft
from services.models import Service, ServiceMediaAttachment, ServiceRevision
from services.workflows import (
    create_revision_draft as create_service_revision_draft,
)
from services.workflows import (
    publish_service_draft,
)


class MediaAttachmentWorkflowTests(TemporaryMediaStorageMixin, TestCase):
    def setUp(self):
        super().setUp()
        self.owner = User.objects.create_user("owner@example.com")
        self.project = Project.objects.create(
            slug="media-workflow",
            created_by=self.owner,
            updated_by=self.owner,
        )
        self.revision = ProjectRevision.objects.create(
            project=self.project,
            created_by=self.owner,
            updated_by=self.owner,
        )
        self.image = create_media_asset(image_upload(), self.owner)
        self.video = create_media_asset(mp4_upload(), self.owner)

    def test_attachment_is_draft_only_and_role_must_match_media_type(self):
        attachment = attach_asset(
            "project_revision",
            self.revision.pk,
            self.image.pk,
            self.owner,
            role=AttachmentRole.COVER_IMAGE,
        )

        self.assertEqual(attachment.asset_id, self.image.pk)
        with self.assertRaises(ValidationError):
            attach_asset(
                "project_revision",
                self.revision.pk,
                self.video.pk,
                self.owner,
                role=AttachmentRole.COVER_IMAGE,
            )

        self.revision.status = ProjectRevisionStatus.PUBLISHED
        self.revision.title = "Published project"
        self.revision.summary = "Project summary"
        self.revision.description = "Project description"
        self.revision.published_by = self.owner
        self.revision.save()
        with self.assertRaises(ValidationError):
            attach_asset(
                "project_revision",
                self.revision.pk,
                self.video.pk,
                self.owner,
                role=AttachmentRole.VIDEO,
            )

    def test_project_cover_role_is_unique_per_revision(self):
        attach_asset(
            "project_revision",
            self.revision.pk,
            self.image.pk,
            self.owner,
            role=AttachmentRole.COVER_IMAGE,
        )
        second_image = create_media_asset(
            image_upload("PNG", name="second.png"),
            self.owner,
        )

        with self.assertRaises(ValidationError):
            attach_asset(
                "project_revision",
                self.revision.pk,
                second_image.pk,
                self.owner,
                role=AttachmentRole.COVER_IMAGE,
            )

    def test_archived_asset_cannot_be_attached(self):
        self.image.lifecycle = MediaLifecycle.ARCHIVED
        self.image.archived_by = self.owner
        self.image.archived_at = timezone.now()
        self.image.save()

        with self.assertRaises(ValidationError):
            attach_asset(
                "project_revision",
                self.revision.pk,
                self.image.pk,
                self.owner,
                role=AttachmentRole.COVER_IMAGE,
            )

    def test_copy_and_detach_revision_attachments(self):
        original = attach_asset(
            "project_revision",
            self.revision.pk,
            self.image.pk,
            self.owner,
            role=AttachmentRole.COVER_IMAGE,
            display_order=2,
            caption_override="Original caption",
        )
        copied_revision = ProjectRevision.objects.create(
            project=Project.objects.create(
                slug="media-copy",
                created_by=self.owner,
                updated_by=self.owner,
            ),
            created_by=self.owner,
            updated_by=self.owner,
        )

        copy_revision_attachments(self.revision, copied_revision, self.owner)
        copied = ProjectMediaAttachment.objects.get(revision=copied_revision)
        self.assertEqual(copied.asset_id, original.asset_id)
        self.assertEqual(copied.role, original.role)
        self.assertEqual(copied.display_order, 2)
        self.assertEqual(copied.caption_override, "Original caption")

        detach_asset("project_revision", copied_revision.pk, copied.pk)
        self.assertFalse(
            ProjectMediaAttachment.objects.filter(revision=copied_revision).exists()
        )

    def test_project_publish_and_new_draft_preserve_media_attachments(self):
        self.revision.title = "Published project"
        self.revision.summary = "Project summary"
        self.revision.description = "Project description"
        self.revision.save()
        attach_asset(
            "project_revision",
            self.revision.pk,
            self.image.pk,
            self.owner,
            role=AttachmentRole.COVER_IMAGE,
        )

        published = publish_project_draft(self.project, self.owner)
        next_draft = create_revision_draft(self.project, self.owner)

        self.assertEqual(published.status, ProjectRevisionStatus.PUBLISHED)
        copied = ProjectMediaAttachment.objects.get(revision=next_draft)
        self.assertEqual(copied.asset_id, self.image.pk)
        self.assertEqual(copied.role, AttachmentRole.COVER_IMAGE)

    def test_project_publishing_rejects_archived_attached_media(self):
        self.revision.title = "Project"
        self.revision.summary = "Summary"
        self.revision.description = "Description"
        self.revision.save()
        attach_asset(
            "project_revision",
            self.revision.pk,
            self.image.pk,
            self.owner,
            role=AttachmentRole.COVER_IMAGE,
        )
        self.image.lifecycle = MediaLifecycle.ARCHIVED
        self.image.archived_at = timezone.now()
        self.image.archived_by = self.owner
        self.image.save()

        with self.assertRaisesMessage(ValidationError, "Restore archived media"):
            publish_project_draft(self.project, self.owner)

    def test_company_homepage_and_service_workflows_clone_media(self):
        service = Service.objects.create(
            slug="media-service",
            created_by=self.owner,
            updated_by=self.owner,
        )
        ServiceRevision.objects.create(
            service=service,
            title="Service",
            summary="Summary",
            description="Description",
            created_by=self.owner,
            updated_by=self.owner,
        )
        attach_asset(
            "service_revision",
            service.revisions.get().pk,
            self.image.pk,
            self.owner,
            role=AttachmentRole.COVER_IMAGE,
        )
        publish_service_draft(service, self.owner)
        service_draft = create_service_revision_draft(service, self.owner)
        self.assertTrue(
            ServiceMediaAttachment.objects.filter(
                revision=service_draft,
                asset=self.image,
            ).exists()
        )

        profile = create_profile_draft(self.owner)
        attach_asset(
            "company_profile_revision",
            profile.pk,
            self.image.pk,
            self.owner,
            role=AttachmentRole.LOGO,
        )
        publish_profile_draft(self.owner)
        next_profile = create_profile_draft(self.owner)
        self.assertEqual(
            next_profile.media_attachments.get().asset_id,
            self.image.pk,
        )

        section = create_section_draft(
            HomepageSectionRevision.SectionType.HERO,
            self.owner,
        )
        section.heading = "Welcome"
        section.save()
        attach_asset(
            "homepage_section_revision",
            section.pk,
            self.image.pk,
            self.owner,
            role=AttachmentRole.HERO_IMAGE,
        )
        publish_section_draft(section.section_type, self.owner)
        next_section = create_section_draft(section.section_type, self.owner)
        self.assertEqual(
            next_section.media_attachments.get().asset_id,
            self.image.pk,
        )

    def test_publication_validation_rejects_an_archived_attachment(self):
        attach_asset(
            "project_revision",
            self.revision.pk,
            self.image.pk,
            self.owner,
            role=AttachmentRole.COVER_IMAGE,
        )
        self.image.lifecycle = MediaLifecycle.ARCHIVED
        self.image.archived_by = self.owner
        self.image.archived_at = timezone.now()
        self.image.save()

        with self.assertRaisesMessage(ValidationError, "Restore archived media"):
            validate_revision_attachments(self.revision)

    def test_homepage_hero_allows_only_one_background_asset(self):
        section = HomepageSectionRevision.objects.create(
            section_type=HomepageSectionRevision.SectionType.HERO,
            created_by=self.owner,
            updated_by=self.owner,
        )
        attach_asset(
            "homepage_section_revision",
            section.pk,
            self.image.pk,
            self.owner,
            role=AttachmentRole.HERO_IMAGE,
        )

        with self.assertRaises(ValidationError):
            attach_asset(
                "homepage_section_revision",
                section.pk,
                self.video.pk,
                self.owner,
                role=AttachmentRole.HERO_VIDEO,
            )

    def test_archived_projects_cannot_be_edited(self):
        self.project.availability = ProjectAvailability.ARCHIVED
        self.project.archived_at = self.revision.created_at
        self.project.archived_by = self.owner
        self.project.save()

        with self.assertRaises(ValidationError):
            attach_asset(
                "project_revision",
                self.revision.pk,
                self.image.pk,
                self.owner,
                role=AttachmentRole.COVER_IMAGE,
            )
