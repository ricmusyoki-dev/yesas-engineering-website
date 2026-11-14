from django.contrib import admin
from django.core.cache import cache
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import TestCase
from rest_framework.test import APIClient

from accounts.models import User

from .models import (
    CompanyProfileRevision,
    HomepageSectionRevision,
    RevisionStatus,
)

PASSWORD = "a-strong-password-974!"
PROFILE_URL = "/api/v1/company/"
HOMEPAGE_URL = "/api/v1/homepage/"
MANAGE_COMPANY_URL = "/api/v1/manage/company/"
COMPANY_DRAFT_URL = "/api/v1/manage/company/draft/"
COMPANY_PUBLISH_URL = "/api/v1/manage/company/draft/publish/"
COMPANY_REVISIONS_URL = "/api/v1/manage/company/revisions/"
MANAGE_SECTIONS_URL = "/api/v1/manage/homepage/sections/"
HOMEPAGE_REVISIONS_URL = "/api/v1/manage/homepage/revisions/"


class CompanyContentModelTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user("owner@example.com", PASSWORD)

    def test_company_profile_has_single_draft_and_published_slots(self):
        draft = CompanyProfileRevision.objects.create(
            created_by=self.owner,
            updated_by=self.owner,
        )
        with self.assertRaises(IntegrityError), transaction.atomic():
            CompanyProfileRevision.objects.create(
                created_by=self.owner,
                updated_by=self.owner,
            )

        draft.status = RevisionStatus.PUBLISHED
        draft.published_by = self.owner
        draft.save()
        with self.assertRaises(IntegrityError), transaction.atomic():
            CompanyProfileRevision.objects.create(
                status=RevisionStatus.PUBLISHED,
                created_by=self.owner,
                updated_by=self.owner,
                published_by=self.owner,
            )

    def test_profile_requires_known_identity_and_accepts_blank_optional_fields(self):
        profile = CompanyProfileRevision(
            created_by=self.owner,
            updated_by=self.owner,
        )
        profile.full_clean()
        self.assertEqual(profile.name, "Yesas Engineering")
        self.assertEqual(profile.tagline, "Expertise Wired to Perfection.")
        self.assertEqual(profile.business_email, "")
        self.assertEqual(profile.service_areas, [])

    def test_company_scope_is_enforced_by_database_and_phone_is_validated(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            CompanyProfileRevision.objects.create(
                scope="another-company",
                created_by=self.owner,
                updated_by=self.owner,
            )

        profile = CompanyProfileRevision(
            created_by=self.owner,
            updated_by=self.owner,
            business_phone="call-me",
        )
        with self.assertRaisesMessage(ValidationError, "7 to 15 digits"):
            profile.full_clean()

    def test_social_urls_and_service_areas_are_validated(self):
        profile = CompanyProfileRevision(
            created_by=self.owner,
            updated_by=self.owner,
            linkedin_url="javascript:alert(1)",
        )
        with self.assertRaisesMessage(ValidationError, "Enter a safe HTTPS URL."):
            profile.full_clean()

        profile.linkedin_url = "https://attacker.example/profile"
        with self.assertRaisesMessage(ValidationError, "valid Linkedin profile URL"):
            profile.full_clean()

        profile.linkedin_url = "https://www.linkedin.com/company/yesas"
        profile.service_areas = "Nairobi"
        with self.assertRaisesMessage(ValidationError, "list of non-empty strings"):
            profile.full_clean()

    def test_section_constraints_reject_invalid_types(self):
        with self.assertRaises(IntegrityError), transaction.atomic():
            HomepageSectionRevision.objects.create(
                section_type="UNKNOWN",
                created_by=self.owner,
                updated_by=self.owner,
            )

    def test_section_validation_checks_cta_feature_config_and_heading(self):
        section = HomepageSectionRevision(
            section_type=HomepageSectionRevision.SectionType.HERO,
            heading="Welcome",
            cta_label="Contact us",
            cta_destination="javascript:alert(1)",
            status=RevisionStatus.PUBLISHED,
            created_by=self.owner,
            updated_by=self.owner,
            published_by=self.owner,
        )
        with self.assertRaisesMessage(ValidationError, "safe HTTPS URL"):
            section.full_clean()

        section.cta_destination = "/\\evil.example/path"
        with self.assertRaisesMessage(ValidationError, "safe HTTPS URL"):
            section.full_clean()

        section.cta_destination = "/contact/"
        section.item_limit = 3
        with self.assertRaisesMessage(ValidationError, "Only featured sections"):
            section.full_clean()

        section.item_limit = None
        section.section_type = HomepageSectionRevision.SectionType.FEATURED_SERVICES
        section.cta_label = ""
        section.cta_destination = ""
        with self.assertRaisesMessage(ValidationError, "positive item limit"):
            section.full_clean()
        section.item_limit = 4
        section.heading = ""
        with self.assertRaisesMessage(ValidationError, "requires a heading"):
            section.full_clean()

    def test_admin_exposes_history_and_locks_published_revision_content(self):
        profile = CompanyProfileRevision.objects.create(
            status=RevisionStatus.PUBLISHED,
            published_by=self.owner,
            created_by=self.owner,
            updated_by=self.owner,
        )
        model_admin = admin.site._registry[CompanyProfileRevision]

        readonly_fields = model_admin.get_readonly_fields(None, profile)

        self.assertIn("status", readonly_fields)
        self.assertIn("description", readonly_fields)
        self.assertIn("published_at", readonly_fields)
        self.assertFalse(model_admin.has_delete_permission(None, profile))


class CompanyPublicApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.owner = User.objects.create_user("owner@example.com", PASSWORD)

    def test_company_endpoint_is_anonymous_read_only_and_published_only(self):
        draft = CompanyProfileRevision.objects.create(
            name="Draft name",
            created_by=self.owner,
            updated_by=self.owner,
        )
        response = APIClient().get(PROFILE_URL)
        self.assertEqual(response.status_code, 404)
        self.assertNotIn(str(draft.pk).encode(), response.content)

        draft.status = RevisionStatus.PUBLISHED
        draft.published_by = self.owner
        draft.save()
        response = APIClient().get(PROFILE_URL)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["name"], "Draft name")
        self.assertEqual(
            set(response.data),
            {
                "name",
                "tagline",
                "description",
                "overview",
                "business_phone",
                "whatsapp_number",
                "business_email",
                "physical_address",
                "city",
                "country",
                "service_areas",
                "linkedin_url",
                "instagram_url",
                "facebook_url",
                "tiktok_url",
                "youtube_url",
                "logo",
                "images",
            },
        )
        self.assertIsNone(response.data["logo"])
        self.assertEqual(response.data["images"], [])
        self.assertEqual(APIClient().post(PROFILE_URL).status_code, 405)

    def test_homepage_is_public_ordered_visible_and_published_only(self):
        hidden = HomepageSectionRevision.objects.create(
            section_type=HomepageSectionRevision.SectionType.INTRODUCTION,
            heading="Hidden",
            is_visible=False,
            display_order=0,
            status=RevisionStatus.PUBLISHED,
            created_by=self.owner,
            updated_by=self.owner,
            published_by=self.owner,
        )
        draft = HomepageSectionRevision.objects.create(
            section_type=HomepageSectionRevision.SectionType.HERO,
            heading="Draft hero",
            display_order=1,
            created_by=self.owner,
            updated_by=self.owner,
        )
        HomepageSectionRevision.objects.create(
            section_type=HomepageSectionRevision.SectionType.CONTACT_CTA,
            heading="Contact",
            display_order=5,
            status=RevisionStatus.PUBLISHED,
            created_by=self.owner,
            updated_by=self.owner,
            published_by=self.owner,
        )

        response = APIClient().get(HOMEPAGE_URL)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            [item["heading"] for item in response.data["sections"]], ["Contact"]
        )
        self.assertNotIn(str(draft.pk).encode(), response.content)
        self.assertNotIn(str(hidden.pk).encode(), response.content)
        self.assertEqual(APIClient().post(HOMEPAGE_URL).status_code, 405)

    def test_public_homepage_orders_multiple_published_sections(self):
        for section_type, heading, order in (
            (HomepageSectionRevision.SectionType.INTRODUCTION, "Intro", 2),
            (HomepageSectionRevision.SectionType.HERO, "Hero", 0),
        ):
            HomepageSectionRevision.objects.create(
                section_type=section_type,
                heading=heading,
                display_order=order,
                status=RevisionStatus.PUBLISHED,
                created_by=self.owner,
                updated_by=self.owner,
                published_by=self.owner,
            )

        response = APIClient().get(HOMEPAGE_URL)

        self.assertEqual(
            [section["heading"] for section in response.data["sections"]],
            ["Hero", "Intro"],
        )


class CompanyManagementApiTests(TestCase):
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

    def authenticate(self, user):
        self.client.force_authenticate(user=user)

    def test_anonymous_and_content_manager_cannot_manage_or_preview_content(self):
        for path in (
            MANAGE_COMPANY_URL,
            COMPANY_DRAFT_URL,
            COMPANY_REVISIONS_URL,
            MANAGE_SECTIONS_URL,
            HOMEPAGE_REVISIONS_URL,
        ):
            with self.subTest(path=path):
                self.assertEqual(self.client.get(path).status_code, 403)

        self.authenticate(self.manager)
        self.assertEqual(self.client.get(MANAGE_COMPANY_URL).status_code, 403)
        self.assertEqual(self.client.post(COMPANY_DRAFT_URL).status_code, 403)
        self.assertEqual(self.client.get(COMPANY_REVISIONS_URL).status_code, 403)

    def test_staff_flag_alone_does_not_authorize_content_management(self):
        self.manager.is_staff = True
        self.manager.save(update_fields=("is_staff",))
        self.authenticate(self.manager)

        self.assertEqual(self.client.post(COMPANY_DRAFT_URL).status_code, 403)

    def test_content_manager_cannot_publish_or_restore_revisions(self):
        archived = CompanyProfileRevision.objects.create(
            status=RevisionStatus.ARCHIVED,
            created_by=self.owner,
            updated_by=self.owner,
        )
        self.authenticate(self.manager)

        self.assertEqual(self.client.post(COMPANY_PUBLISH_URL).status_code, 403)
        self.assertEqual(
            self.client.post(
                f"{COMPANY_REVISIONS_URL}{archived.pk}/restore/"
            ).status_code,
            403,
        )

    def test_technical_admin_can_manage_content(self):
        self.authenticate(self.technical_admin)

        response = self.client.post(COMPANY_DRAFT_URL, {}, format="json")

        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.data["created_by"], self.technical_admin.pk)

    def test_company_draft_publish_history_and_restore_workflow(self):
        self.authenticate(self.owner)
        first_draft = self.client.post(
            COMPANY_DRAFT_URL,
            {"description": "First published description"},
            format="json",
        )
        self.assertEqual(first_draft.status_code, 201)
        self.assertEqual(first_draft.data["status"], RevisionStatus.DRAFT)

        self.assertEqual(
            self.client.get(PROFILE_URL).status_code,
            404,
        )
        preview = self.client.get("/api/v1/manage/company/preview/")
        self.assertEqual(preview.status_code, 200)
        self.assertEqual(
            preview.data["description"],
            "First published description",
        )

        self.assertEqual(
            self.client.post(COMPANY_PUBLISH_URL).status_code,
            200,
        )
        public = self.client.get(PROFILE_URL)
        self.assertEqual(public.status_code, 200)
        self.assertEqual(
            public.data["description"],
            "First published description",
        )

        duplicate = self.client.post(COMPANY_DRAFT_URL, {}, format="json")
        self.assertEqual(duplicate.status_code, 201)
        self.assertEqual(
            self.client.patch(
                COMPANY_DRAFT_URL,
                {"description": "Unpublished edit"},
                format="json",
            ).status_code,
            200,
        )
        self.assertEqual(
            self.client.get(PROFILE_URL).data["description"],
            "First published description",
        )
        second_publish = self.client.post(COMPANY_PUBLISH_URL)
        self.assertEqual(second_publish.status_code, 200)
        self.assertEqual(
            self.client.get(PROFILE_URL).data["description"],
            "Unpublished edit",
        )

        history = self.client.get(COMPANY_REVISIONS_URL)
        self.assertEqual(history.status_code, 200)
        self.assertEqual(len(history.data), 2)
        archived = next(
            item for item in history.data if item["status"] == RevisionStatus.ARCHIVED
        )
        self.assertEqual(archived["created_by"], self.owner.pk)
        self.assertIsNotNone(archived["created_at"])
        self.assertIsNotNone(archived["published_at"])

        restored = self.client.post(f"{COMPANY_REVISIONS_URL}{archived['id']}/restore/")
        self.assertEqual(restored.status_code, 201)
        self.assertEqual(restored.data["status"], RevisionStatus.DRAFT)
        self.assertEqual(
            restored.data["description"],
            "First published description",
        )
        self.assertEqual(
            self.client.get(PROFILE_URL).data["description"], "Unpublished edit"
        )
        self.assertEqual(
            self.client.post(COMPANY_PUBLISH_URL).status_code,
            200,
        )
        self.assertEqual(
            self.client.get(PROFILE_URL).data["description"],
            "First published description",
        )

    def test_company_draft_rejects_unsafe_social_urls_and_invalid_email(self):
        self.authenticate(self.owner)

        response = self.client.post(
            COMPANY_DRAFT_URL,
            {"linkedin_url": "https://evil.example/profile"},
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("linkedin_url", response.data)
        self.assertFalse(CompanyProfileRevision.objects.filter(status="draft").exists())

        response = self.client.post(
            COMPANY_DRAFT_URL,
            {"business_phone": "not a phone"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("business_phone", response.data)
        self.assertFalse(CompanyProfileRevision.objects.filter(status="draft").exists())

        response = self.client.post(
            COMPANY_DRAFT_URL,
            {"business_email": "not-an-email"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.assertIn("business_email", response.data)
        self.assertFalse(CompanyProfileRevision.objects.filter(status="draft").exists())

    def test_invalid_incomplete_section_cannot_be_published(self):
        self.authenticate(self.owner)
        self.client.post(
            MANAGE_SECTIONS_URL,
            {"section_type": "HERO"},
            format="json",
        )

        response = self.client.post(
            "/api/v1/manage/homepage/sections/HERO/draft/publish/"
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            HomepageSectionRevision.objects.get(section_type="HERO").status,
            RevisionStatus.DRAFT,
        )

    def test_section_drafts_publish_versions_restore_and_order_publicly(self):
        self.authenticate(self.owner)
        hero_publish_url = "/api/v1/manage/homepage/sections/HERO/draft/publish/"
        created = self.client.post(
            MANAGE_SECTIONS_URL,
            {
                "section_type": "HERO",
                "heading": "Welcome",
                "body": "Electrical engineering services.",
                "cta_label": "Contact us",
                "cta_destination": "/contact/",
                "display_order": 2,
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        edited = self.client.patch(
            "/api/v1/manage/homepage/sections/HERO/draft/",
            {"body": "Edited electrical engineering introduction."},
            format="json",
        )
        self.assertEqual(edited.status_code, 200)
        self.assertEqual(
            edited.data["body"],
            "Edited electrical engineering introduction.",
        )
        self.assertEqual(self.client.get(HOMEPAGE_URL).data["sections"], [])
        self.assertEqual(
            self.client.get("/api/v1/manage/homepage/preview/").status_code,
            200,
        )
        self.assertEqual(self.client.post(hero_publish_url).status_code, 200)
        self.assertEqual(
            self.client.get(HOMEPAGE_URL).data["sections"][0]["heading"],
            "Welcome",
        )

        self.client.post(
            MANAGE_SECTIONS_URL,
            {
                "section_type": "HERO",
                "heading": "Updated welcome",
                "display_order": 0,
            },
            format="json",
        )
        self.assertEqual(
            self.client.get(HOMEPAGE_URL).data["sections"][0]["heading"],
            "Welcome",
        )
        self.client.post(hero_publish_url)
        revisions = self.client.get(f"{HOMEPAGE_REVISIONS_URL}?section_type=HERO")
        archived = next(
            item for item in revisions.data if item["status"] == RevisionStatus.ARCHIVED
        )
        self.assertEqual(
            self.client.get(HOMEPAGE_URL).data["sections"][0]["heading"],
            "Updated welcome",
        )

        restored = self.client.post(
            f"{HOMEPAGE_REVISIONS_URL}{archived['id']}/restore/"
        )
        self.assertEqual(restored.status_code, 201)
        self.assertEqual(restored.data["status"], RevisionStatus.DRAFT)
        self.client.post(hero_publish_url)
        public_sections = self.client.get(HOMEPAGE_URL).data["sections"]
        self.assertEqual(public_sections[0]["heading"], "Welcome")

    def test_hidden_published_section_and_unsupported_content_are_not_public(self):
        self.authenticate(self.owner)
        created = self.client.post(
            MANAGE_SECTIONS_URL,
            {
                "section_type": "INTRODUCTION",
                "heading": "About our company",
                "display_order": 0,
                "is_visible": False,
            },
            format="json",
        )
        self.assertEqual(created.status_code, 201)
        self.assertEqual(
            self.client.patch(
                "/api/v1/manage/homepage/sections/INTRODUCTION/draft/",
                {
                    "cta_label": "Click here",
                    "cta_destination": "/contact/",
                },
                format="json",
            ).status_code,
            400,
        )
        self.client.post("/api/v1/manage/homepage/sections/INTRODUCTION/draft/publish/")
        self.assertEqual(self.client.get(HOMEPAGE_URL).data["sections"], [])

        invalid = self.client.post(
            MANAGE_SECTIONS_URL,
            {"section_type": "UNKNOWN"},
            format="json",
        )
        self.assertEqual(invalid.status_code, 400)

    def test_revision_history_is_private_and_draft_ids_are_not_public(self):
        draft = CompanyProfileRevision.objects.create(
            created_by=self.owner,
            updated_by=self.owner,
        )

        anonymous = APIClient()
        self.assertEqual(anonymous.get(COMPANY_REVISIONS_URL).status_code, 403)
        self.assertEqual(
            anonymous.get(f"{COMPANY_REVISIONS_URL}{draft.pk}/restore/").status_code,
            403,
        )
        self.assertEqual(anonymous.get(PROFILE_URL).status_code, 404)

        self.authenticate(self.owner)
        history = self.client.get(COMPANY_REVISIONS_URL)
        self.assertEqual(history.status_code, 200)
        self.assertEqual(history.data[0]["id"], draft.pk)
        self.assertEqual(
            self.client.post(f"{COMPANY_REVISIONS_URL}{draft.pk}/restore/").status_code,
            404,
        )

    def test_deactivated_owner_cannot_manage_content(self):
        self.owner.is_active = False
        self.owner.save(update_fields=("is_active",))
        self.authenticate(self.owner)

        self.assertEqual(self.client.post(COMPANY_DRAFT_URL).status_code, 403)

    def test_restore_refuses_to_replace_an_existing_draft(self):
        self.authenticate(self.owner)
        self.client.post(
            COMPANY_DRAFT_URL,
            {"description": "First"},
            format="json",
        )
        self.client.post(COMPANY_PUBLISH_URL)
        self.client.post(COMPANY_DRAFT_URL, {}, format="json")
        self.client.patch(
            COMPANY_DRAFT_URL,
            {"description": "Second"},
            format="json",
        )
        self.client.post(COMPANY_PUBLISH_URL)
        archived = CompanyProfileRevision.objects.filter(
            status=RevisionStatus.ARCHIVED
        ).first()
        self.client.post(COMPANY_DRAFT_URL, {}, format="json")

        response = self.client.post(f"{COMPANY_REVISIONS_URL}{archived.pk}/restore/")

        self.assertEqual(response.status_code, 409)
