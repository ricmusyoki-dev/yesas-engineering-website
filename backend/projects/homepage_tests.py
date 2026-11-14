from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from company.models import HomepageSectionRevision, RevisionStatus

from .models import (
    Project,
    ProjectAvailability,
    ProjectRevision,
    ProjectRevisionStatus,
)

HOMEPAGE_SECTIONS_URL = "/api/v1/manage/homepage/sections/"
HOMEPAGE_PUBLIC_URL = "/api/v1/homepage/"
HOMEPAGE_REVISIONS_URL = "/api/v1/manage/homepage/revisions/"


class FeaturedProjectsHomepageTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user("owner@example.com")
        self.client = APIClient()
        self.client.force_authenticate(self.owner)

    def create_project(
        self,
        slug,
        *,
        status=ProjectRevisionStatus.PUBLISHED,
        availability=ProjectAvailability.ENABLED,
    ):
        project_values = {}
        if availability == ProjectAvailability.ARCHIVED:
            project_values = {
                "archived_at": timezone.now(),
                "archived_by": self.owner,
            }
        project = Project.objects.create(
            slug=slug,
            availability=availability,
            created_by=self.owner,
            updated_by=self.owner,
            **project_values,
        )
        revision = ProjectRevision.objects.create(
            project=project,
            status=status,
            title=slug.replace("-", " ").title(),
            summary="A safe public summary.",
            description="Project detail supplied by the owner.",
            created_by=self.owner,
            updated_by=self.owner,
            published_by=(
                self.owner if status == ProjectRevisionStatus.PUBLISHED else None
            ),
        )
        return project, revision

    def create_featured_section(self, project_ids, **overrides):
        return self.client.post(
            HOMEPAGE_SECTIONS_URL,
            {
                "section_type": "FEATURED_PROJECTS",
                "heading": "Featured projects",
                "item_limit": 2,
                "curated_projects": project_ids,
                **overrides,
            },
            format="json",
        )

    def publish_featured_section(self):
        return self.client.post(
            f"{HOMEPAGE_SECTIONS_URL}FEATURED_PROJECTS/draft/publish/",
            format="json",
        )

    def test_featured_selection_is_revision_scoped_and_publicly_filtered(self):
        visible, _ = self.create_project("visible-project")
        draft, _ = self.create_project(
            "draft-project",
            status=ProjectRevisionStatus.DRAFT,
        )
        disabled, _ = self.create_project(
            "disabled-project",
            availability=ProjectAvailability.DISABLED,
        )
        other_visible, _ = self.create_project("other-visible-project")

        created = self.create_featured_section(
            [visible.pk, draft.pk, disabled.pk],
            item_limit=1,
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(self.publish_featured_section().status_code, 200)

        public = APIClient().get(HOMEPAGE_PUBLIC_URL)
        featured = public.data["sections"][0]["featured_projects"]
        self.assertEqual([item["slug"] for item in featured], [visible.slug])

        draft_response = self.client.post(
            HOMEPAGE_SECTIONS_URL,
            {"section_type": "FEATURED_PROJECTS"},
            format="json",
        )
        self.assertEqual(draft_response.status_code, 201)
        draft_section = HomepageSectionRevision.objects.get(
            status=RevisionStatus.DRAFT,
            section_type="FEATURED_PROJECTS",
        )
        self.assertEqual(
            set(draft_section.curated_projects.values_list("pk", flat=True)),
            {visible.pk, draft.pk, disabled.pk},
        )

        changed = self.client.patch(
            f"{HOMEPAGE_SECTIONS_URL}FEATURED_PROJECTS/draft/",
            {"curated_projects": [other_visible.pk]},
            format="json",
        )
        self.assertEqual(changed.status_code, 200)
        unchanged_public = APIClient().get(HOMEPAGE_PUBLIC_URL)
        self.assertEqual(
            unchanged_public.data["sections"][0]["featured_projects"][0]["slug"],
            visible.slug,
        )

        self.assertEqual(self.publish_featured_section().status_code, 200)
        changed_public = APIClient().get(HOMEPAGE_PUBLIC_URL)
        self.assertEqual(
            changed_public.data["sections"][0]["featured_projects"][0]["slug"],
            other_visible.slug,
        )

    def test_invisible_section_and_empty_selection_do_not_fall_back(self):
        created = self.create_featured_section(
            [],
            is_visible=True,
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(self.publish_featured_section().status_code, 200)

        response = APIClient().get(HOMEPAGE_PUBLIC_URL)
        self.assertEqual(response.data["sections"][0]["featured_projects"], [])

        draft = self.client.post(
            HOMEPAGE_SECTIONS_URL,
            {"section_type": "FEATURED_PROJECTS"},
            format="json",
        )
        self.assertEqual(draft.status_code, 201)
        hidden = self.client.patch(
            f"{HOMEPAGE_SECTIONS_URL}FEATURED_PROJECTS/draft/",
            {"is_visible": False},
            format="json",
        )
        self.assertEqual(hidden.status_code, 200)
        self.assertEqual(self.publish_featured_section().status_code, 200)
        response = APIClient().get(HOMEPAGE_PUBLIC_URL)
        self.assertEqual(response.data["sections"], [])

    def test_non_featured_sections_cannot_select_projects(self):
        project, _ = self.create_project("not-a-featured-section")
        response = self.client.post(
            HOMEPAGE_SECTIONS_URL,
            {
                "section_type": "INTRODUCTION",
                "heading": "Introduction",
                "curated_projects": [project.pk],
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)

    def test_restoring_archived_featured_revision_restores_project_selection(self):
        original, _ = self.create_project("original-featured-project")
        replacement, _ = self.create_project("replacement-featured-project")

        self.assertEqual(self.create_featured_section([original.pk]).status_code, 201)
        self.assertEqual(self.publish_featured_section().status_code, 200)
        self.assertEqual(
            self.client.post(
                HOMEPAGE_SECTIONS_URL,
                {"section_type": "FEATURED_PROJECTS"},
                format="json",
            ).status_code,
            201,
        )
        self.assertEqual(
            self.client.patch(
                f"{HOMEPAGE_SECTIONS_URL}FEATURED_PROJECTS/draft/",
                {"curated_projects": [replacement.pk]},
                format="json",
            ).status_code,
            200,
        )
        self.assertEqual(self.publish_featured_section().status_code, 200)

        archived = HomepageSectionRevision.objects.get(
            section_type="FEATURED_PROJECTS",
            status=RevisionStatus.ARCHIVED,
        )
        restored = self.client.post(
            f"{HOMEPAGE_REVISIONS_URL}{archived.pk}/restore/"
        )

        self.assertEqual(restored.status_code, 201)
        self.assertEqual(
            set(
                HomepageSectionRevision.objects.get(pk=restored.data["id"])
                .curated_projects.values_list("pk", flat=True)
            ),
            {original.pk},
        )
