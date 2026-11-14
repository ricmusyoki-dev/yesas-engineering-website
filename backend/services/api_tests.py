from django.contrib import admin
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User
from company.models import HomepageSectionRevision, RevisionStatus

from .models import Service, ServiceCategory, ServiceRevision

PASSWORD = "a-strong-password-974!"
SERVICES_URL = "/api/v1/services/"
MANAGE_SERVICES_URL = "/api/v1/manage/services/"
CATEGORIES_URL = "/api/v1/manage/service-categories/"


def valid_content(**overrides):
    return {
        "title": "Electrical installation",
        "summary": "Professional electrical installation services.",
        "description": "Detailed electrical installation description.",
        "features": ["Planning", "Installation"],
        "benefits": ["Reliable systems"],
        **overrides,
    }


class ServiceModelTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user("owner@example.com", PASSWORD)

    def make_service(self, slug="electrical-installation", **fields):
        service = Service.objects.create(
            slug=slug,
            created_by=self.owner,
            updated_by=self.owner,
        )
        return ServiceRevision.objects.create(
            service=service,
            title=fields.pop("title", "Electrical installation"),
            summary=fields.pop("summary", "Electrical installations."),
            description=fields.pop("description", "A detailed description."),
            created_by=self.owner,
            updated_by=self.owner,
            **fields,
        )

    def test_service_identity_and_revision_are_separate_and_slug_is_unique(self):
        revision = self.make_service()

        self.assertEqual(revision.service.slug, "electrical-installation")
        self.assertEqual(revision.status, RevisionStatus.DRAFT)
        with self.assertRaises(IntegrityError), transaction.atomic():
            Service.objects.create(
                slug="electrical-installation",
                created_by=self.owner,
                updated_by=self.owner,
            )

    def test_revision_constraints_prevent_multiple_drafts_or_published_versions(self):
        revision = self.make_service()
        with self.assertRaises(IntegrityError), transaction.atomic():
            ServiceRevision.objects.create(
                service=revision.service,
                created_by=self.owner,
                updated_by=self.owner,
            )

        revision.status = RevisionStatus.PUBLISHED
        revision.published_by = self.owner
        revision.save()
        with self.assertRaises(IntegrityError), transaction.atomic():
            ServiceRevision.objects.create(
                service=revision.service,
                status=RevisionStatus.PUBLISHED,
                created_by=self.owner,
                updated_by=self.owner,
                published_by=self.owner,
            )

    def test_required_content_and_structured_collections_are_validated(self):
        revision = self.make_service(features={"unsafe": "value"})
        revision.status = RevisionStatus.PUBLISHED
        revision.published_by = self.owner
        with self.assertRaises(ValidationError):
            revision.full_clean()

        revision.features = ["valid"]
        revision.benefits = ["x" * 301]
        with self.assertRaises(ValidationError):
            revision.full_clean()

        revision.benefits = []
        revision.title = ""
        with self.assertRaisesMessage(ValidationError, "title"):
            revision.full_clean()

    def test_cta_rejects_unsafe_schemes_and_accepts_safe_destinations(self):
        revision = self.make_service(
            cta_label="Learn more",
            cta_destination="javascript:alert(1)",
        )
        with self.assertRaisesMessage(ValidationError, "safe HTTPS URL"):
            revision.full_clean()

        revision.cta_destination = "/contact/"
        revision.full_clean()
        revision.cta_destination = "https://example.com/services/"
        revision.full_clean()

    def test_inactive_category_blocks_publication_validation(self):
        category = ServiceCategory.objects.create(
            name="Electrical",
            slug="electrical",
            is_active=False,
            created_by=self.owner,
            updated_by=self.owner,
        )
        revision = self.make_service(category=category)
        revision.status = RevisionStatus.PUBLISHED
        revision.published_by = self.owner

        with self.assertRaisesMessage(ValidationError, "inactive category"):
            revision.full_clean()


class ServicePublicApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.owner = User.objects.create_user("owner@example.com", PASSWORD)
        self.category = ServiceCategory.objects.create(
            name="Electrical",
            slug="electrical",
            created_by=self.owner,
            updated_by=self.owner,
        )

    def add_revision(
        self,
        slug,
        status=RevisionStatus.PUBLISHED,
        is_enabled=True,
        category=None,
        display_order=0,
    ):
        service = Service.objects.create(
            slug=slug,
            created_by=self.owner,
            updated_by=self.owner,
        )
        return ServiceRevision.objects.create(
            service=service,
            status=status,
            title=slug.replace("-", " ").title(),
            summary="Professional electrical services.",
            description="Detailed public service description.",
            category=category,
            is_enabled=is_enabled,
            display_order=display_order,
            created_by=self.owner,
            updated_by=self.owner,
            published_by=self.owner if status == RevisionStatus.PUBLISHED else None,
        )

    def test_public_services_only_show_published_enabled_non_archived_content(self):
        visible = self.add_revision(
            "visible-service",
            category=self.category,
        )
        draft = self.add_revision("draft-service", status=RevisionStatus.DRAFT)
        self.add_revision("disabled-service", is_enabled=False)
        archived_service = self.add_revision("archived-service")
        archived_service.service.is_archived = True
        archived_service.service.archived_at = archived_service.created_at
        archived_service.service.archived_by = self.owner
        archived_service.service.save(
            update_fields=("is_archived", "archived_at", "archived_by")
        )

        response = APIClient().get(SERVICES_URL)

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["slug"] for item in response.data], ["visible-service"])
        self.assertNotIn(str(draft.pk).encode(), response.content)
        self.assertNotIn("created_by", response.data[0])
        self.assertNotIn("status", response.data[0])
        self.assertNotIn("published_at", response.data[0])
        self.assertEqual(
            APIClient().get(f"{SERVICES_URL}draft-service/").status_code, 404
        )
        self.assertEqual(
            APIClient().get(f"{SERVICES_URL}disabled-service/").status_code,
            404,
        )
        self.assertEqual(
            APIClient().get(f"{SERVICES_URL}archived-service/").status_code,
            404,
        )
        self.assertEqual(visible.category.slug, "electrical")

    def test_category_filter_and_ordering(self):
        category = self.category
        other = ServiceCategory.objects.create(
            name="Maintenance",
            slug="maintenance",
            created_by=self.owner,
            updated_by=self.owner,
        )
        self.add_revision("later", category=other, display_order=5)
        self.add_revision("earlier", category=category, display_order=1)
        self.add_revision("first", category=category, display_order=0)

        response = APIClient().get(f"{SERVICES_URL}?category=electrical")

        self.assertEqual(response.status_code, 200)
        self.assertEqual([item["slug"] for item in response.data], ["first", "earlier"])
        self.assertEqual(APIClient().post(SERVICES_URL).status_code, 405)

    def test_deactivated_category_hides_previously_published_services(self):
        revision = self.add_revision("categorized", category=self.category)
        self.category.is_active = False
        self.category.save(update_fields=("is_active",))

        self.assertEqual(APIClient().get(SERVICES_URL).data, [])
        self.assertEqual(
            APIClient().get(f"{SERVICES_URL}{revision.service.slug}/").status_code,
            404,
        )


class ServiceManagementApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.owner = User.objects.create_user("owner@example.com", PASSWORD)
        self.manager = User.objects.create_user(
            "manager@example.com",
            PASSWORD,
            role=User.Role.CONTENT_MANAGER,
        )
        self.technical_admin = User.objects.create_superuser(
            "technical@example.com",
            PASSWORD,
            first_name="Technical",
            last_name="Administrator",
        )
        self.client = APIClient()
        self.client.force_authenticate(user=self.owner)

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def create_service(self, slug="electrical", payload=None):
        return self.client.post(
            MANAGE_SERVICES_URL,
            {"slug": slug, **(payload or valid_content())},
            format="json",
        )

    def test_anonymous_content_manager_and_staff_only_access_are_denied(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(MANAGE_SERVICES_URL).status_code, 403)
        self.authenticate(self.manager)
        self.assertEqual(self.create_service().status_code, 403)

        self.manager.is_staff = True
        self.manager.save(update_fields=("is_staff",))
        self.assertEqual(self.client.get(MANAGE_SERVICES_URL).status_code, 403)

    def test_owner_and_technical_admin_can_create_service_drafts(self):
        response = self.create_service()

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["status"], RevisionStatus.DRAFT)
        self.assertEqual(response.data["slug"], "electrical")
        self.assertEqual(
            APIClient().get(SERVICES_URL).data,
            [],
        )

        self.client.force_authenticate(user=self.technical_admin)
        second = self.create_service("testing")
        self.assertEqual(second.status_code, 201)
        self.assertEqual(second.data["created_by"], self.technical_admin.pk)

    def test_create_rejects_duplicate_slug_and_invalid_content(self):
        self.assertEqual(self.create_service().status_code, 201)
        duplicate = self.create_service()
        self.assertEqual(duplicate.status_code, 409)

        invalid = self.create_service("bad", {"features": {"script": "bad"}})
        self.assertEqual(invalid.status_code, 400)
        self.assertFalse(Service.objects.filter(slug="bad").exists())

    def test_edit_preview_publish_and_preserve_previous_public_version(self):
        created = self.create_service()
        self.assertEqual(created.status_code, 201)
        self.assertEqual(
            self.client.patch(
                f"{MANAGE_SERVICES_URL}electrical/draft/",
                {"summary": "Updated summary."},
                format="json",
            ).status_code,
            200,
        )
        preview = self.client.get(f"{MANAGE_SERVICES_URL}electrical/preview/")
        self.assertEqual(preview.status_code, 200)
        self.assertEqual(preview.data["summary"], "Updated summary.")
        self.assertEqual(APIClient().get(f"{SERVICES_URL}electrical/").status_code, 404)
        self.assertEqual(
            self.client.post(f"{MANAGE_SERVICES_URL}electrical/publish/").status_code,
            200,
        )
        public = APIClient().get(f"{SERVICES_URL}electrical/")
        self.assertEqual(public.status_code, 200)
        self.assertEqual(public.data["summary"], "Updated summary.")
        self.assertNotIn("status", public.data)
        self.assertNotIn("updated_by", public.data)

        self.client.post(f"{MANAGE_SERVICES_URL}electrical/draft/")
        self.client.patch(
            f"{MANAGE_SERVICES_URL}electrical/draft/",
            {"summary": "A later draft."},
            format="json",
        )
        self.assertEqual(
            APIClient().get(f"{SERVICES_URL}electrical/").data["summary"],
            "Updated summary.",
        )

    def test_unpublished_incomplete_service_cannot_be_published(self):
        created = self.client.post(
            MANAGE_SERVICES_URL,
            {"slug": "incomplete", "title": "Incomplete"},
            format="json",
        )
        self.assertEqual(created.status_code, 201)

        response = self.client.post(f"{MANAGE_SERVICES_URL}incomplete/publish/")

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            APIClient().get(f"{SERVICES_URL}incomplete/").status_code,
            404,
        )

    def test_publish_archives_old_revision_and_restore_creates_new_draft(self):
        self.create_service()
        self.client.post(f"{MANAGE_SERVICES_URL}electrical/publish/")
        self.client.post(f"{MANAGE_SERVICES_URL}electrical/draft/")
        self.client.patch(
            f"{MANAGE_SERVICES_URL}electrical/draft/",
            {"summary": "Second published version."},
            format="json",
        )
        self.client.post(f"{MANAGE_SERVICES_URL}electrical/publish/")

        history = self.client.get(f"{MANAGE_SERVICES_URL}electrical/revisions/")
        self.assertEqual(history.status_code, 200)
        archived = next(
            revision
            for revision in history.data
            if revision["status"] == RevisionStatus.ARCHIVED
        )
        self.assertEqual(archived["created_by"], self.owner.pk)
        self.assertIsNotNone(archived["published_at"])
        restore = self.client.post(
            f"{MANAGE_SERVICES_URL}electrical/revisions/{archived['id']}/restore/"
        )
        self.assertEqual(restore.status_code, 201)
        self.assertEqual(restore.data["status"], RevisionStatus.DRAFT)
        self.assertEqual(
            restore.data["summary"],
            "Professional electrical installation services.",
        )
        self.assertEqual(
            APIClient().get(f"{SERVICES_URL}electrical/").data["summary"],
            "Second published version.",
        )

    def test_disable_and_enable_require_explicit_publication(self):
        self.create_service()
        self.client.post(f"{MANAGE_SERVICES_URL}electrical/publish/")

        self.client.post(f"{MANAGE_SERVICES_URL}electrical/draft/")
        self.client.patch(
            f"{MANAGE_SERVICES_URL}electrical/draft/",
            {"is_enabled": False},
            format="json",
        )
        self.assertEqual(APIClient().get(SERVICES_URL).status_code, 200)
        self.client.post(f"{MANAGE_SERVICES_URL}electrical/publish/")
        self.assertEqual(APIClient().get(SERVICES_URL).data, [])

        self.client.post(f"{MANAGE_SERVICES_URL}electrical/draft/")
        self.client.patch(
            f"{MANAGE_SERVICES_URL}electrical/draft/",
            {"is_enabled": True},
            format="json",
        )
        self.client.post(f"{MANAGE_SERVICES_URL}electrical/publish/")
        self.assertEqual(len(APIClient().get(SERVICES_URL).data), 1)

    def test_archive_hides_service_and_preserves_history(self):
        self.create_service()
        self.client.post(f"{MANAGE_SERVICES_URL}electrical/publish/")

        archived = self.client.post(f"{MANAGE_SERVICES_URL}electrical/archive/")

        self.assertEqual(archived.status_code, 200)
        self.assertTrue(archived.data["is_archived"])
        self.assertEqual(APIClient().get(SERVICES_URL).data, [])
        history = self.client.get(f"{MANAGE_SERVICES_URL}electrical/revisions/")
        self.assertEqual(len(history.data), 1)
        self.assertEqual(
            self.client.post(f"{MANAGE_SERVICES_URL}electrical/archive/").status_code,
            400,
        )

    def test_discard_new_draft_removes_unpublished_identity(self):
        self.create_service()

        response = self.client.post(f"{MANAGE_SERVICES_URL}electrical/discard-draft/")

        self.assertEqual(response.status_code, 204)
        self.assertFalse(Service.objects.filter(slug="electrical").exists())


class ServiceCategoryApiTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user("owner@example.com", PASSWORD)
        self.client = APIClient()
        self.client.force_authenticate(user=self.owner)

    def test_category_create_update_deactivate_and_unique_slug(self):
        created = self.client.post(
            CATEGORIES_URL,
            {"name": "Electrical Services", "display_order": 2},
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(created.data["slug"], "electrical-services")

        duplicate = self.client.post(
            CATEGORIES_URL,
            {"name": "electrical services", "slug": "another"},
            format="json",
        )
        self.assertEqual(duplicate.status_code, 400)

        changed = self.client.patch(
            f"{CATEGORIES_URL}electrical-services/",
            {"is_active": False, "display_order": 0},
            format="json",
        )
        self.assertEqual(changed.status_code, 200)
        self.assertFalse(changed.data["is_active"])
        self.assertEqual(changed.data["display_order"], 0)

    def test_category_endpoints_are_private_and_admin_is_registered(self):
        self.client.force_authenticate(user=None)
        self.assertEqual(self.client.get(CATEGORIES_URL).status_code, 403)
        self.assertIn(Service, admin.site._registry)
        self.assertIn(ServiceRevision, admin.site._registry)
        self.assertIn(ServiceCategory, admin.site._registry)


class FeaturedServicesHomepageTests(TestCase):
    def setUp(self):
        cache.clear()
        self.owner = User.objects.create_user("owner@example.com", PASSWORD)
        self.client = APIClient()
        self.client.force_authenticate(user=self.owner)

    def create_and_publish_service(self, slug, is_enabled=True):
        created = self.client.post(
            MANAGE_SERVICES_URL,
            {"slug": slug, **valid_content(is_enabled=is_enabled)},
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        self.client.post(f"{MANAGE_SERVICES_URL}{slug}/publish/")
        return Service.objects.get(slug=slug)

    def test_homepage_featured_services_are_curated_published_enabled_and_limited(self):
        first = self.create_and_publish_service("first")
        second = self.create_and_publish_service("second")
        disabled = self.create_and_publish_service("disabled", is_enabled=False)

        section = self.client.post(
            "/api/v1/manage/homepage/sections/",
            {
                "section_type": "FEATURED_SERVICES",
                "heading": "Our services",
                "item_limit": 1,
                "curated_services": [first.pk, second.pk, disabled.pk],
            },
            format="json",
        )
        self.assertEqual(section.status_code, 201)
        self.client.post(
            "/api/v1/manage/homepage/sections/FEATURED_SERVICES/draft/publish/"
        )

        public = APIClient().get("/api/v1/homepage/")

        self.assertEqual(public.status_code, 200)
        featured = public.data["sections"][0]["featured_services"]
        self.assertEqual(len(featured), 1)
        self.assertEqual(featured[0]["slug"], "first")
        self.assertNotIn("status", featured[0])
        self.assertNotIn("created_by", featured[0])

    def test_homepage_draft_clones_curated_services_without_publicing_draft(self):
        service = self.create_and_publish_service("real-service")
        self.client.post(
            "/api/v1/manage/homepage/sections/",
            {
                "section_type": "FEATURED_SERVICES",
                "heading": "Featured",
                "item_limit": 2,
                "curated_services": [service.pk],
            },
            format="json",
        )
        self.client.post(
            "/api/v1/manage/homepage/sections/FEATURED_SERVICES/draft/publish/"
        )

        self.client.post(
            "/api/v1/manage/homepage/sections/",
            {"section_type": "FEATURED_SERVICES"},
            format="json",
        )

        draft = HomepageSectionRevision.objects.get(
            section_type="FEATURED_SERVICES",
            status=RevisionStatus.DRAFT,
        )
        self.assertEqual(
            list(draft.curated_services.values_list("pk", flat=True)), [service.pk]
        )
        self.assertEqual(
            APIClient()
            .get("/api/v1/homepage/")
            .data["sections"][0]["featured_services"][0]["slug"],
            "real-service",
        )
