from types import SimpleNamespace

from django.contrib import admin
from django.core.cache import cache
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient

from accounts.models import User
from services.models import Service, ServiceRevision

from .models import (
    Project,
    ProjectAvailability,
    ProjectCategory,
    ProjectRevision,
    ProjectRevisionStatus,
    ProjectTag,
)

PROJECTS_URL = "/api/v1/projects/"
MANAGE_PROJECTS_URL = "/api/v1/manage/projects/"
CATEGORIES_URL = "/api/v1/manage/project-categories/"
TAGS_URL = "/api/v1/manage/project-tags/"


class ProjectApiTestCase(TestCase):
    def setUp(self):
        cache.clear()
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

    def add_project(
        self,
        slug,
        *,
        status=ProjectRevisionStatus.PUBLISHED,
        availability=ProjectAvailability.ENABLED,
        category=None,
        tags=(),
        related_services=(),
        display_order=0,
        is_featured=False,
        client_name="",
        show_client_name=False,
    ):
        values = {}
        if availability == ProjectAvailability.ARCHIVED:
            values = {
                "archived_at": timezone.now(),
                "archived_by": self.owner,
            }
        project = Project.objects.create(
            slug=slug,
            availability=availability,
            **values,
            created_by=self.owner,
            updated_by=self.owner,
        )
        revision = ProjectRevision.objects.create(
            project=project,
            status=status,
            title=slug.replace("-", " ").title(),
            summary="A safe public project summary.",
            description="Detailed information provided by the project owner.",
            category=category,
            display_order=display_order,
            is_featured=is_featured,
            client_name=client_name,
            show_client_name=show_client_name,
            created_by=self.owner,
            updated_by=self.owner,
            published_by=(
                self.owner if status == ProjectRevisionStatus.PUBLISHED else None
            ),
        )
        revision.tags.set(tags)
        revision.related_services.set(related_services)
        return revision

    def add_service(self, slug, status=ProjectRevisionStatus.PUBLISHED):
        service = Service.objects.create(
            slug=slug,
            created_by=self.owner,
            updated_by=self.owner,
        )
        revision = ServiceRevision.objects.create(
            service=service,
            status=status,
            title=slug.replace("-", " ").title(),
            summary="A published service summary.",
            description="A published service description.",
            created_by=self.owner,
            updated_by=self.owner,
            published_by=(
                self.owner if status == ProjectRevisionStatus.PUBLISHED else None
            ),
        )
        return service, revision


class ProjectPublicApiTests(ProjectApiTestCase):
    def test_list_filters_unpublished_disabled_archived_and_inactive_category(self):
        visible = self.add_project(
            "visible-project",
            category=self.category,
            tags=(self.tag,),
            is_featured=True,
        )
        self.add_project("draft-project", status=ProjectRevisionStatus.DRAFT)
        self.add_project(
            "disabled-project",
            availability=ProjectAvailability.DISABLED,
        )
        self.add_project(
            "archived-project",
            availability=ProjectAvailability.ARCHIVED,
        )
        inactive_category = ProjectCategory.objects.create(
            name="Inactive",
            slug="inactive",
            is_active=False,
            created_by=self.owner,
            updated_by=self.owner,
        )
        self.add_project("inactive-category", category=inactive_category)

        response = APIClient().get(PROJECTS_URL)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 1)
        self.assertEqual(
            [item["slug"] for item in response.data["results"]],
            [visible.project.slug],
        )

    def test_category_tag_featured_filters_and_ordering(self):
        self.add_project(
            "later-project",
            category=self.category,
            tags=(self.tag,),
            display_order=5,
            is_featured=True,
        )
        self.add_project(
            "first-project",
            category=self.category,
            tags=(self.tag,),
            display_order=0,
            is_featured=True,
        )
        other_category = ProjectCategory.objects.create(
            name="Commercial",
            slug="commercial",
            created_by=self.owner,
            updated_by=self.owner,
        )
        self.add_project("other-category", category=other_category, is_featured=True)
        self.add_project(
            "not-featured",
            category=self.category,
            tags=(self.tag,),
        )

        response = APIClient().get(
            f"{PROJECTS_URL}?category=industrial&tag=retrofitting&featured=true"
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 2)
        self.assertEqual(
            [item["slug"] for item in response.data["results"]],
            ["first-project", "later-project"],
        )

    def test_pagination_is_bounded_and_reports_total_count(self):
        for index in range(105):
            self.add_project(f"portfolio-{index:02}", display_order=index)

        response = APIClient().get(f"{PROJECTS_URL}?page_size=100")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 105)
        self.assertEqual(len(response.data["results"]), 100)
        capped = APIClient().get(f"{PROJECTS_URL}?page_size=1000")
        self.assertEqual(len(capped.data["results"]), 100)

    def test_public_fields_protect_private_client_and_revision_metadata(self):
        revision = self.add_project(
            "private-client",
            category=self.category,
            client_name="Confidential Organization",
            show_client_name=False,
        )

        response = APIClient().get(f"{PROJECTS_URL}{revision.project.slug}/")

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["client_name"])
        self.assertNotIn("show_client_name", response.data)
        self.assertNotIn("created_by", response.data)
        self.assertNotIn("published_by", response.data)
        self.assertNotIn("status", response.data)
        self.assertNotIn("availability", response.data)
        self.assertNotIn(b"Confidential Organization", response.content)

        revision.show_client_name = True
        revision.save(update_fields=("show_client_name",))
        response = APIClient().get(f"{PROJECTS_URL}{revision.project.slug}/")
        self.assertEqual(response.data["client_name"], "Confidential Organization")

    def test_public_related_services_include_only_published_active_services(self):
        published_service, _ = self.add_service("active-service")
        draft_service, _ = self.add_service(
            "draft-service",
            status=ProjectRevisionStatus.DRAFT,
        )
        revision = self.add_project(
            "service-project",
            related_services=(published_service, draft_service),
        )

        response = APIClient().get(f"{PROJECTS_URL}{revision.project.slug}/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [item["slug"] for item in response.data["related_services"]],
            ["active-service"],
        )

    def test_detail_hides_draft_disabled_archived_and_unknown_projects(self):
        draft = self.add_project("draft", status=ProjectRevisionStatus.DRAFT)
        disabled = self.add_project(
            "disabled",
            availability=ProjectAvailability.DISABLED,
        )
        archived = self.add_project(
            "archived",
            availability=ProjectAvailability.ARCHIVED,
        )

        slugs = (
            draft.project.slug,
            disabled.project.slug,
            archived.project.slug,
            "missing",
        )
        for slug in slugs:
            with self.subTest(slug=slug):
                self.assertEqual(
                    APIClient().get(f"{PROJECTS_URL}{slug}/").status_code,
                    404,
                )

    def test_invalid_featured_filter_is_rejected(self):
        response = APIClient().get(f"{PROJECTS_URL}?featured=yes")

        self.assertEqual(response.status_code, 400)


class ProjectManagementApiTests(ProjectApiTestCase):
    def setUp(self):
        super().setUp()
        self.client = APIClient()
        self.client.force_authenticate(self.owner)

    def test_owner_can_create_preview_publish_and_edit_project_revisions(self):
        created = self.client.post(
            MANAGE_PROJECTS_URL,
            {
                "slug": "facility-upgrade",
                "title": "Facility upgrade",
                "summary": "A concise summary.",
                "description": "Detailed owner-provided project information.",
                "category": self.category.pk,
                "tags": [self.tag.pk],
                "client_name": "Private Client",
            },
            format="json",
        )

        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data["draft"]["status"], "draft")
        self.assertEqual(
            self.client.get(
                f"{MANAGE_PROJECTS_URL}facility-upgrade/preview/"
            ).status_code,
            200,
        )
        self.assertEqual(
            APIClient().get(f"{PROJECTS_URL}facility-upgrade/").status_code,
            404,
        )

        published = self.client.post(
            f"{MANAGE_PROJECTS_URL}facility-upgrade/publish/",
            format="json",
        )
        self.assertEqual(published.status_code, 200)
        self.assertEqual(
            APIClient().get(f"{PROJECTS_URL}facility-upgrade/").status_code,
            200,
        )

        cloned = self.client.post(
            f"{MANAGE_PROJECTS_URL}facility-upgrade/draft/",
            format="json",
        )
        self.assertEqual(cloned.status_code, 201)
        changed = self.client.patch(
            f"{MANAGE_PROJECTS_URL}facility-upgrade/draft/",
            {"title": "Revised facility upgrade"},
            format="json",
        )
        self.assertEqual(changed.status_code, 200)
        self.assertEqual(changed.data["title"], "Revised facility upgrade")
        self.assertEqual(
            self.client.get(
                f"{MANAGE_PROJECTS_URL}facility-upgrade/revisions/"
            ).status_code,
            200,
        )

    def test_management_endpoints_require_owner_or_valid_technical_admin(self):
        anonymous = APIClient().get(MANAGE_PROJECTS_URL)
        self.assertEqual(anonymous.status_code, 403)

        manager = User.objects.create_user(
            "manager@example.com",
            role=User.Role.CONTENT_MANAGER,
        )
        manager.is_staff = True
        manager.save(update_fields=("is_staff",))
        denied = APIClient()
        denied.force_authenticate(manager)
        self.assertEqual(denied.get(MANAGE_PROJECTS_URL).status_code, 403)

        technical_admin = User.objects.create_superuser(
            "technical@example.com",
        )
        allowed = APIClient()
        allowed.force_authenticate(technical_admin)
        self.assertEqual(allowed.get(MANAGE_PROJECTS_URL).status_code, 200)

    def test_category_and_tag_management_validates_names_and_deactivation(self):
        category_response = self.client.post(
            CATEGORIES_URL,
            {"name": "Commercial & Industrial"},
            format="json",
        )
        self.assertEqual(category_response.status_code, 201)
        self.assertEqual(category_response.data["slug"], "commercial-industrial")
        duplicate = self.client.post(
            CATEGORIES_URL,
            {"name": "COMMERCIAL & INDUSTRIAL"},
            format="json",
        )
        self.assertEqual(duplicate.status_code, 400)

        tag_response = self.client.post(
            TAGS_URL,
            {"name": "Power distribution"},
            format="json",
        )
        self.assertEqual(tag_response.status_code, 201)
        self.assertEqual(tag_response.data["slug"], "power-distribution")

        published = self.add_project(
            "categorized-project",
            category=self.category,
        )
        deactivated = self.client.patch(
            f"{CATEGORIES_URL}{self.category.slug}/",
            {"is_active": False},
            format="json",
        )
        self.assertEqual(deactivated.status_code, 200)
        self.assertEqual(
            APIClient().get(f"{PROJECTS_URL}{published.project.slug}/").status_code,
            404,
        )
        self.assertEqual(published.category, self.category)

    def test_project_availability_can_be_toggled_and_archive_is_soft(self):
        published = self.add_project("availability-project")
        disabled = self.client.patch(
            f"{MANAGE_PROJECTS_URL}{published.project.slug}/availability/",
            {"availability": "disabled"},
            format="json",
        )
        self.assertEqual(disabled.status_code, 200)
        self.assertEqual(
            APIClient().get(f"{PROJECTS_URL}{published.project.slug}/").status_code,
            404,
        )

        enabled = self.client.patch(
            f"{MANAGE_PROJECTS_URL}{published.project.slug}/availability/",
            {"availability": "enabled"},
            format="json",
        )
        self.assertEqual(enabled.status_code, 200)
        self.assertEqual(
            APIClient().get(f"{PROJECTS_URL}{published.project.slug}/").status_code,
            200,
        )

        archived = self.client.post(
            f"{MANAGE_PROJECTS_URL}{published.project.slug}/archive/",
            format="json",
        )
        self.assertEqual(archived.status_code, 200)
        published.refresh_from_db()
        self.assertEqual(published.status, ProjectRevisionStatus.PUBLISHED)
        published.project.refresh_from_db()
        self.assertEqual(
            published.project.availability,
            ProjectAvailability.ARCHIVED,
        )

    def test_discard_and_restore_are_scoped_to_the_project(self):
        first = self.add_project("first-project")
        second = self.add_project(
            "second-project",
            status=ProjectRevisionStatus.ARCHIVED,
        )
        wrong_scope = self.client.post(
            f"{MANAGE_PROJECTS_URL}{first.project.slug}/revisions/{second.pk}/restore/",
            format="json",
        )
        self.assertEqual(wrong_scope.status_code, 404)

        draft = self.client.post(
            f"{MANAGE_PROJECTS_URL}{first.project.slug}/draft/",
            format="json",
        )
        self.assertEqual(draft.status_code, 201)
        discarded = self.client.post(
            f"{MANAGE_PROJECTS_URL}{first.project.slug}/discard-draft/",
            format="json",
        )
        self.assertEqual(discarded.status_code, 204)
        self.assertEqual(first.project.revisions.count(), 1)

    def test_admin_exposes_history_but_locks_published_revision_fields(self):
        published = self.add_project("admin-visible")
        revision_admin = admin.site._registry[ProjectRevision]
        readonly = set(revision_admin.get_readonly_fields(SimpleNamespace(), published))

        self.assertIn("status", readonly)
        self.assertIn("published_by", readonly)
        self.assertIn("related_services", readonly)
        self.assertIn("tags", readonly)
        self.assertFalse(revision_admin.has_delete_permission(SimpleNamespace(), published))
