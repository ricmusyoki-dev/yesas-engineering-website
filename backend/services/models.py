from __future__ import annotations

from typing import ClassVar

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q
from django.utils import timezone
from django.utils.text import slugify

from company.models import RevisionStatus
from company.validators import validate_cta_destination

SERVICE_CONTENT_FIELDS = (
    "title",
    "summary",
    "description",
    "category",
    "display_order",
    "is_enabled",
    "is_featured",
    "features",
    "benefits",
    "process",
    "cta_label",
    "cta_destination",
    "seo_title",
    "seo_description",
)


class ServiceCategory(models.Model):
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=120, unique=True)
    description = models.TextField(blank=True, default="")
    display_order = models.PositiveSmallIntegerField(
        default=0,
        validators=(MinValueValidator(0),),
    )
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_service_categories",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="updated_service_categories",
    )

    class Meta:
        ordering = ("display_order", "name")
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                models.functions.Lower("name"),
                name="service_category_name_case_insensitive_unique",
            ),
        ]

    def clean(self):
        super().clean()
        self.name = self.name.strip()
        self.slug = slugify(self.slug or self.name)
        if not self.name:
            raise ValidationError({"name": "A category name is required."})
        if not self.slug:
            raise ValidationError({"slug": "A valid category slug is required."})

    def __str__(self):
        return self.name


class Service(models.Model):
    slug = models.SlugField(max_length=180, unique=True)
    is_archived = models.BooleanField(default=False)
    archived_at = models.DateTimeField(null=True, blank=True, editable=False)
    archived_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="archived_services",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_services",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="updated_services",
    )

    class Meta:
        ordering = ("slug",)
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(
                condition=(
                    Q(
                        is_archived=False,
                        archived_at__isnull=True,
                        archived_by__isnull=True,
                    )
                    | Q(
                        is_archived=True,
                        archived_at__isnull=False,
                        archived_by__isnull=False,
                    )
                ),
                name="service_archive_metadata_consistent",
            ),
        ]

    def clean(self):
        super().clean()
        self.slug = slugify(self.slug)
        if not self.slug:
            raise ValidationError({"slug": "A valid service slug is required."})

    def __str__(self):
        return self.slug


class ServiceRevision(models.Model):
    service = models.ForeignKey(
        Service,
        on_delete=models.PROTECT,
        related_name="revisions",
    )
    status = models.CharField(
        max_length=16,
        choices=RevisionStatus.choices,
        default=RevisionStatus.DRAFT,
    )
    title = models.CharField(max_length=200, blank=True, default="")
    summary = models.CharField(max_length=300, blank=True, default="")
    description = models.TextField(blank=True, default="")
    category = models.ForeignKey(
        ServiceCategory,
        on_delete=models.PROTECT,
        related_name="service_revisions",
        null=True,
        blank=True,
    )
    display_order = models.PositiveSmallIntegerField(
        default=0,
        validators=(MinValueValidator(0),),
    )
    is_enabled = models.BooleanField(default=True)
    is_featured = models.BooleanField(default=False)
    features = models.JSONField(default=list, blank=True)
    benefits = models.JSONField(default=list, blank=True)
    process = models.TextField(blank=True, default="")
    cta_label = models.CharField(max_length=100, blank=True, default="")
    cta_destination = models.CharField(max_length=500, blank=True, default="")
    seo_title = models.CharField(max_length=70, blank=True, default="")
    seo_description = models.CharField(max_length=160, blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_service_revisions",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="updated_service_revisions",
    )
    published_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="published_service_revisions",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)
    published_at = models.DateTimeField(null=True, blank=True, editable=False)

    class Meta:
        ordering = ("display_order", "title", "-created_at", "-pk")
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(
                condition=Q(status__in=RevisionStatus.values),
                name="service_revision_valid_status",
            ),
            models.UniqueConstraint(
                fields=("service",),
                condition=Q(status=RevisionStatus.DRAFT),
                name="service_one_draft_revision",
            ),
            models.UniqueConstraint(
                fields=("service",),
                condition=Q(status=RevisionStatus.PUBLISHED),
                name="service_one_published_revision",
            ),
        ]

    def clean(self):
        super().clean()
        errors = {}
        self.title = self.title.strip()
        self.summary = self.summary.strip()
        if self.status == RevisionStatus.PUBLISHED and not self.title:
            errors["title"] = "A service title is required."
        if self.status == RevisionStatus.PUBLISHED and not self.summary:
            errors["summary"] = "A short service summary is required."
        if self.status == RevisionStatus.PUBLISHED and not self.description.strip():
            errors["description"] = "A detailed service description is required."

        for field in ("features", "benefits"):
            collection = getattr(self, field)
            if (
                not isinstance(collection, list)
                or len(collection) > 20
                or any(
                    not isinstance(item, str) or not item.strip() or len(item) > 300
                    for item in collection
                )
            ):
                errors[field] = (
                    "Enter up to 20 non-empty text items, each no longer "
                    "than 300 characters."
                )

        if bool(self.cta_label.strip()) != bool(self.cta_destination.strip()):
            errors["cta_destination"] = (
                "CTA label and destination must be provided together."
            )
        elif self.cta_destination:
            try:
                validate_cta_destination(self.cta_destination)
            except ValidationError as error:
                errors["cta_destination"] = error

        if (
            self.category_id
            and self.status == RevisionStatus.PUBLISHED
            and not self.category.is_active
        ):
            errors["category"] = (
                "A service cannot be published in an inactive category."
            )

        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return f"{self.title} ({self.status})"
