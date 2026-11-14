import re
from typing import ClassVar

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q
from django.utils import timezone

from .validators import validate_cta_destination, validate_social_url

COMPANY_SCOPE = "company"
HOMEPAGE_SECTION_TYPES = (
    "HERO",
    "INTRODUCTION",
    "FEATURED_SERVICES",
    "FEATURED_PROJECTS",
    "CONTACT_CTA",
)


class RevisionStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    PUBLISHED = "published", "Published"
    ARCHIVED = "archived", "Archived"


class RevisionMetadata(models.Model):
    status = models.CharField(
        max_length=16,
        choices=RevisionStatus.choices,
        default=RevisionStatus.DRAFT,
    )
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="+",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="+",
    )
    published_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="+",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)
    published_at = models.DateTimeField(null=True, blank=True, editable=False)

    class Meta:
        abstract = True


class CompanyProfileRevision(RevisionMetadata):
    COMPANY_SCOPE = COMPANY_SCOPE

    scope = models.CharField(
        max_length=16,
        default=COMPANY_SCOPE,
        editable=False,
    )

    name = models.CharField(max_length=200, default="Yesas Engineering")
    tagline = models.CharField(
        max_length=255,
        default="Expertise Wired to Perfection.",
    )
    description = models.TextField(blank=True, default="")
    overview = models.TextField(blank=True, default="")

    business_phone = models.CharField(max_length=32, blank=True, default="")
    whatsapp_number = models.CharField(max_length=32, blank=True, default="")
    business_email = models.EmailField(blank=True, default="")
    physical_address = models.TextField(blank=True, default="")
    city = models.CharField(max_length=120, blank=True, default="")
    country = models.CharField(max_length=120, blank=True, default="")
    service_areas = models.JSONField(default=list, blank=True)

    linkedin_url = models.URLField(blank=True, default="")
    instagram_url = models.URLField(blank=True, default="")
    facebook_url = models.URLField(blank=True, default="")
    tiktok_url = models.URLField(blank=True, default="")
    youtube_url = models.URLField(blank=True, default="")

    class Meta:
        ordering = ("-created_at", "-pk")
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(
                condition=Q(scope=COMPANY_SCOPE),
                name="company_profile_scope_is_singleton",
            ),
            models.CheckConstraint(
                condition=Q(status__in=RevisionStatus.values),
                name="company_profile_valid_status",
            ),
            models.UniqueConstraint(
                fields=("scope",),
                condition=Q(status=RevisionStatus.DRAFT),
                name="company_profile_one_draft",
            ),
            models.UniqueConstraint(
                fields=("scope",),
                condition=Q(status=RevisionStatus.PUBLISHED),
                name="company_profile_one_published",
            ),
        ]

    def clean(self):
        super().clean()
        errors = {}
        for field in (
            "linkedin_url",
            "instagram_url",
            "facebook_url",
            "tiktok_url",
            "youtube_url",
        ):
            value = getattr(self, field)
            if value:
                try:
                    validate_social_url(value, field.removesuffix("_url"))
                except ValidationError as error:
                    errors[field] = error

        for field in ("business_phone", "whatsapp_number"):
            value = getattr(self, field)
            if value and (
                not re.fullmatch(r"[+0-9().\-\s]+", value)
                or not 7 <= len(re.sub(r"\D", "", value)) <= 15
            ):
                errors[field] = "Enter a phone number containing 7 to 15 digits."

        if not isinstance(self.service_areas, list) or any(
            not isinstance(area, str) or not area.strip() for area in self.service_areas
        ):
            errors["service_areas"] = (
                "Enter service areas as a list of non-empty strings."
            )
        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return f"{self.name} ({self.status})"


class HomepageSectionRevision(RevisionMetadata):
    class SectionType(models.TextChoices):
        HERO = HOMEPAGE_SECTION_TYPES[0], "Hero"
        INTRODUCTION = HOMEPAGE_SECTION_TYPES[1], "Introduction"
        FEATURED_SERVICES = HOMEPAGE_SECTION_TYPES[2], "Featured services"
        FEATURED_PROJECTS = HOMEPAGE_SECTION_TYPES[3], "Featured projects"
        CONTACT_CTA = HOMEPAGE_SECTION_TYPES[4], "Contact call to action"

    section_type = models.CharField(
        max_length=32,
        choices=SectionType.choices,
    )
    heading = models.CharField(max_length=200, blank=True, default="")
    body = models.TextField(blank=True, default="")
    cta_label = models.CharField(max_length=100, blank=True, default="")
    cta_destination = models.CharField(max_length=500, blank=True, default="")
    is_visible = models.BooleanField(default=True)
    display_order = models.PositiveSmallIntegerField(
        default=0,
        validators=(MinValueValidator(0),),
    )
    item_limit = models.PositiveSmallIntegerField(null=True, blank=True)
    curated_services = models.ManyToManyField(
        "services.Service",
        related_name="homepage_revisions",
        blank=True,
    )
    curated_projects = models.ManyToManyField(
        "projects.Project",
        related_name="homepage_revisions",
        blank=True,
    )

    class Meta:
        ordering = ("display_order", "section_type", "-created_at", "-pk")
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(
                condition=Q(section_type__in=HOMEPAGE_SECTION_TYPES),
                name="homepage_section_valid_type",
            ),
            models.CheckConstraint(
                condition=Q(status__in=RevisionStatus.values),
                name="homepage_section_valid_status",
            ),
            models.UniqueConstraint(
                fields=("section_type",),
                condition=Q(status=RevisionStatus.DRAFT),
                name="homepage_section_one_draft_per_type",
            ),
            models.UniqueConstraint(
                fields=("section_type",),
                condition=Q(status=RevisionStatus.PUBLISHED),
                name="homepage_section_one_published_per_type",
            ),
            models.CheckConstraint(
                condition=Q(item_limit__isnull=True) | Q(item_limit__gte=1),
                name="homepage_section_item_limit_positive",
            ),
        ]

    def clean(self):
        super().clean()
        errors = {}
        cta_types = {
            self.SectionType.HERO,
            self.SectionType.CONTACT_CTA,
        }
        featured_types = {
            self.SectionType.FEATURED_SERVICES,
            self.SectionType.FEATURED_PROJECTS,
        }

        if self.section_type in cta_types:
            if bool(self.cta_label) != bool(self.cta_destination):
                errors["cta_destination"] = (
                    "CTA label and destination must be provided together."
                )
            elif self.cta_destination:
                try:
                    validate_cta_destination(self.cta_destination)
                except ValidationError as error:
                    errors["cta_destination"] = error
        elif self.cta_label or self.cta_destination:
            errors["cta_label"] = (
                "CTA content is only supported for hero and contact sections."
            )

        if self.section_type in featured_types:
            if self.item_limit is None:
                errors["item_limit"] = (
                    "Featured sections require a positive item limit."
                )
        elif self.item_limit is not None:
            errors["item_limit"] = "Only featured sections may configure an item limit."

        if self.status == RevisionStatus.PUBLISHED and not self.heading.strip():
            errors["heading"] = "A published section requires a heading."
        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return f"{self.get_section_type_display()} ({self.status})"
