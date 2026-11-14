from datetime import date

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase

from accounts.models import User

from .models import (
    Project,
    ProjectAvailability,
    ProjectCategory,
    ProjectRevision,
    ProjectRevisionStatus,
    ProjectTag,
)


class ProjectModelTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user("owner@example.com")

    def make_project(self, slug="electrical-upgrade"):
        return Project.objects.create(
            slug=slug,
            created_by=self.owner,
            updated_by=self.owner,
        )

    def make_revision(self, project, **values):
        return ProjectRevision.objects.create(
            project=project,
            created_by=self.owner,
            updated_by=self.owner,
            **values,
        )

    def test_project_identity_is_stable_and_slug_is_unique(self):
        project = self.make_project()

        self.assertEqual(project.availability, ProjectAvailability.ENABLED)
        with self.assertRaises(IntegrityError), transaction.atomic():
            self.make_project()

        original_pk = project.pk
        self.make_revision(project, title="Initial draft")
        self.assertEqual(project.revisions.get().project_id, original_pk)

    def test_project_categories_and_tags_have_case_insensitive_names(self):
        category = ProjectCategory.objects.create(
            name="Industrial",
            slug="industrial",
            created_by=self.owner,
            updated_by=self.owner,
        )
        tag = ProjectTag.objects.create(
            name="Retrofitting",
            slug="retrofitting",
            created_by=self.owner,
            updated_by=self.owner,
        )

        with self.assertRaises(ValidationError):
            ProjectCategory(
                name="INDUSTRIAL",
                slug="industrial-projects",
                created_by=self.owner,
                updated_by=self.owner,
            ).full_clean()
        with self.assertRaises(ValidationError):
            ProjectTag(
                name="RETROFITTING",
                slug="retrofit",
                created_by=self.owner,
                updated_by=self.owner,
            ).full_clean()

        self.assertTrue(category.is_active)
        self.assertTrue(tag.is_active)

    def test_revision_supports_optional_case_study_and_client_fields(self):
        project = self.make_project()
        revision = self.make_revision(
            project,
            title="Facility upgrade",
            summary="A short summary.",
            description="A detailed description.",
            project_background="",
            engineering_challenge="",
            proposed_solution="",
            work_carried_out="",
            technical_specifications="",
            outcomes="",
            client_name="Confidential Client",
            show_client_name=False,
        )

        revision.full_clean()
        self.assertEqual(revision.status, ProjectRevisionStatus.DRAFT)
        self.assertFalse(revision.show_client_name)

    def test_completion_date_cannot_precede_start_date(self):
        revision = ProjectRevision(
            project=self.make_project(),
            start_date=date(2025, 6, 1),
            completion_date=date(2025, 5, 31),
            created_by=self.owner,
            updated_by=self.owner,
        )

        with self.assertRaisesMessage(ValidationError, "completion_date"):
            revision.full_clean()

    def test_client_name_requires_explicit_nonempty_public_consent(self):
        revision = self.make_revision(
            self.make_project(),
            client_name="",
            show_client_name=True,
        )

        with self.assertRaisesMessage(ValidationError, "client_name"):
            revision.full_clean()

    def test_published_revision_requires_title_summary_and_description(self):
        revision = self.make_revision(
            self.make_project(),
            status=ProjectRevisionStatus.PUBLISHED,
            published_by=self.owner,
        )

        with self.assertRaises(ValidationError) as error:
            revision.full_clean()

        self.assertEqual(
            set(error.exception.message_dict),
            {"title", "summary", "description"},
        )

    def test_database_prevents_multiple_drafts_and_published_revisions(self):
        project = self.make_project()
        self.make_revision(project)

        with self.assertRaises(IntegrityError), transaction.atomic():
            self.make_revision(project)

        ProjectRevision.objects.filter(project=project).update(
            status=ProjectRevisionStatus.PUBLISHED,
            published_by=self.owner,
        )
        with self.assertRaises(IntegrityError), transaction.atomic():
            self.make_revision(
                project,
                status=ProjectRevisionStatus.PUBLISHED,
                published_by=self.owner,
            )
