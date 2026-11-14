from django.core.exceptions import ValidationError
from django.test import TestCase

from accounts.models import User
from services.models import Service

from .models import (
    Project,
    ProjectAvailability,
    ProjectCategory,
    ProjectRevisionStatus,
    ProjectTag,
)
from .workflows import (
    ActiveProjectDraftExists,
    archive_project,
    create_project_draft,
    create_revision_draft,
    discard_project_draft,
    publish_project_draft,
    restore_project_revision,
    set_project_availability,
)


def valid_content(**overrides):
    return {
        "title": "Facility electrical upgrade",
        "summary": "A concise project summary.",
        "description": "Detailed project information supplied by the owner.",
        **overrides,
    }


class ProjectWorkflowTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user("owner@example.com")
        self.category = ProjectCategory.objects.create(
            name="Industrial",
            slug="industrial",
            created_by=self.owner,
            updated_by=self.owner,
        )
        self.tag = ProjectTag.objects.create(
            name="Retrofitting",
            slug="retrofitting",
            created_by=self.owner,
            updated_by=self.owner,
        )
        self.service = Service.objects.create(
            slug="electrical-installations",
            created_by=self.owner,
            updated_by=self.owner,
        )

    def create_draft(self, slug="facility-upgrade", **overrides):
        return create_project_draft(
            slug,
            self.owner,
            valid_content(
                category=self.category,
                related_services=[self.service],
                tags=[self.tag],
                **overrides,
            ),
        )

    def test_create_and_publish_project_preserves_identity_and_relationships(self):
        draft = self.create_draft()
        project = draft.project

        self.assertEqual(draft.status, ProjectRevisionStatus.DRAFT)
        self.assertEqual(list(draft.related_services.all()), [self.service])
        self.assertEqual(list(draft.tags.all()), [self.tag])

        published = publish_project_draft(project, self.owner)

        self.assertEqual(published.pk, draft.pk)
        self.assertEqual(published.status, ProjectRevisionStatus.PUBLISHED)
        self.assertEqual(published.published_by, self.owner)
        self.assertIsNotNone(published.published_at)
        self.assertEqual(project.revisions.count(), 1)

    def test_only_one_active_draft_can_be_created(self):
        draft = self.create_draft()

        with self.assertRaises(ActiveProjectDraftExists):
            create_revision_draft(draft.project, self.owner)

    def test_new_draft_clones_published_content_and_relationships(self):
        published = publish_project_draft(
            self.create_draft().project,
            self.owner,
        )

        draft = create_revision_draft(published.project, self.owner)

        self.assertEqual(draft.title, published.title)
        self.assertEqual(draft.category, self.category)
        self.assertEqual(list(draft.related_services.all()), [self.service])
        self.assertEqual(list(draft.tags.all()), [self.tag])
        self.assertNotEqual(draft.pk, published.pk)

    def test_publish_archives_previous_revision_without_overwriting_it(self):
        original = publish_project_draft(
            self.create_draft().project,
            self.owner,
        )
        original_title = original.title
        original_published_at = original.published_at
        draft = create_revision_draft(original.project, self.owner)
        draft.title = "Updated facility upgrade"
        draft.save()

        current = publish_project_draft(original.project, self.owner)

        original.refresh_from_db()
        self.assertEqual(current.status, ProjectRevisionStatus.PUBLISHED)
        self.assertEqual(current.title, "Updated facility upgrade")
        self.assertEqual(original.status, ProjectRevisionStatus.ARCHIVED)
        self.assertEqual(original.title, original_title)
        self.assertEqual(original.published_at, original_published_at)
        self.assertEqual(original.published_by, self.owner)

    def test_restore_creates_a_new_draft_and_preserves_archived_revision(self):
        original = publish_project_draft(
            self.create_draft().project,
            self.owner,
        )
        new_draft = create_revision_draft(original.project, self.owner)
        new_draft.title = "New version"
        new_draft.save()
        publish_project_draft(original.project, self.owner)
        original.refresh_from_db()

        restored = restore_project_revision(original, self.owner)

        self.assertEqual(restored.status, ProjectRevisionStatus.DRAFT)
        self.assertEqual(restored.title, original.title)
        self.assertNotEqual(restored.pk, original.pk)
        self.assertEqual(original.status, ProjectRevisionStatus.ARCHIVED)
        self.assertEqual(original.project.revisions.count(), 3)

    def test_restore_requires_archived_revision_and_no_existing_draft(self):
        draft = self.create_draft()
        with self.assertRaisesMessage(ValidationError, "archived"):
            restore_project_revision(draft, self.owner)

        published = publish_project_draft(draft.project, self.owner)
        create_revision_draft(published.project, self.owner)
        publish_project_draft(published.project, self.owner)
        published.refresh_from_db()
        old_draft = create_revision_draft(published.project, self.owner)
        with self.assertRaises(ActiveProjectDraftExists):
            restore_project_revision(published, self.owner)
        self.assertEqual(old_draft.status, ProjectRevisionStatus.DRAFT)

    def test_inactive_category_and_archived_related_service_block_publication(self):
        draft = self.create_draft()
        self.category.is_active = False
        self.category.save(update_fields=("is_active",))
        with self.assertRaisesMessage(ValidationError, "inactive category"):
            publish_project_draft(draft.project, self.owner)

        self.category.is_active = True
        self.category.save(update_fields=("is_active",))
        self.service.is_archived = True
        self.service.archived_at = self.service.created_at
        self.service.archived_by = self.owner
        self.service.save(
            update_fields=("is_archived", "archived_at", "archived_by")
        )
        with self.assertRaisesMessage(ValidationError, "Archived services"):
            publish_project_draft(draft.project, self.owner)

    def test_inactive_tag_blocks_publication(self):
        draft = self.create_draft()
        self.tag.is_active = False
        self.tag.save(update_fields=("is_active",))

        with self.assertRaisesMessage(ValidationError, "Inactive tags"):
            publish_project_draft(draft.project, self.owner)

    def test_discard_removes_only_draft_and_keeps_stable_identity(self):
        draft = self.create_draft()
        project = draft.project

        self.assertTrue(discard_project_draft(project))
        self.assertTrue(Project.objects.filter(pk=project.pk).exists())
        self.assertFalse(project.revisions.exists())
        self.assertFalse(discard_project_draft(project))

    def test_availability_and_archival_are_separate_from_revision_status(self):
        published = publish_project_draft(
            self.create_draft().project,
            self.owner,
        )
        project = published.project

        set_project_availability(project, self.owner, ProjectAvailability.DISABLED)
        project.refresh_from_db()
        published.refresh_from_db()
        self.assertEqual(project.availability, ProjectAvailability.DISABLED)
        self.assertEqual(published.status, ProjectRevisionStatus.PUBLISHED)

        archive_project(project, self.owner)
        project.refresh_from_db()
        published.refresh_from_db()
        self.assertEqual(project.availability, ProjectAvailability.ARCHIVED)
        self.assertEqual(published.status, ProjectRevisionStatus.PUBLISHED)
        self.assertIsNotNone(project.archived_at)

        with self.assertRaisesMessage(ValidationError, "Archived projects"):
            create_revision_draft(project, self.owner)

    def test_availability_changes_require_a_published_nonarchived_project(self):
        project = self.create_draft().project
        with self.assertRaisesMessage(ValidationError, "Only published"):
            set_project_availability(
                project,
                self.owner,
                ProjectAvailability.DISABLED,
            )

        publish_project_draft(project, self.owner)
        archive_project(project, self.owner)
        with self.assertRaisesMessage(ValidationError, "Archived projects"):
            set_project_availability(
                project,
                self.owner,
                ProjectAvailability.ENABLED,
            )
