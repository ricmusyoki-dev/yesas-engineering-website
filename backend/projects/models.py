from __future__ import annotations

from typing import ClassVar

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MinValueValidator
from django.db import models
from django.db.models import Q
from django.utils import timezone
from django.utils.text import slugify

from media_library.models import (
    AttachmentRole,
    MediaType,
    RevisionMediaAttachment,
)


class ProjectRevisionStatus(models.TextChoices):
    DRAFT = "draft", "Draft"
    PUBLISHED = "published", "Published"
    ARCHIVED = "archived", "Archived"


class ProjectAvailability(models.TextChoices):
    ENABLED = "enabled", "Enabled"
    DISABLED = "disabled", "Disabled"
    ARCHIVED = "archived", "Archived"


class ProjectExecutionStatus(models.TextChoices):
    PLANNING = "planning", "Planning"
    IN_PROGRESS = "in_progress", "In progress"
    COMPLETED = "completed", "Completed"
    ON_HOLD = "on_hold", "On hold"


PROJECT_CONTENT_FIELDS = (
    "title",
    "summary",
    "description",
    "category",
    "location",
    "country",
    "start_date",
    "completion_date",
    "execution_status",
    "project_background",
    "engineering_challenge",
    "proposed_solution",
    "work_carried_out",
    "technical_specifications",
    "outcomes",
    "display_order",
    "is_featured",
    "client_name",
    "show_client_name",
    "seo_title",
    "seo_description",
)


class ProjectCategory(models.Model):
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
        related_name="created_project_categories",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="updated_project_categories",
    )

    class Meta:
        ordering = ("display_order", "name")
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                models.functions.Lower("name"),
                name="proj_category_name_ci_uniq",
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


class ProjectTag(models.Model):
    name = models.CharField(max_length=50)
    slug = models.SlugField(max_length=60, unique=True)
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_project_tags",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="updated_project_tags",
    )

    class Meta:
        ordering = ("name",)
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                models.functions.Lower("name"),
                name="proj_tag_name_ci_uniq",
            ),
        ]

    def clean(self):
        super().clean()
        self.name = self.name.strip()
        self.slug = slugify(self.slug or self.name)
        if not self.name:
            raise ValidationError({"name": "A tag name is required."})
        if not self.slug:
            raise ValidationError({"slug": "A valid tag slug is required."})

    def __str__(self):
        return self.name


class Project(models.Model):
    slug = models.SlugField(max_length=180, unique=True)
    availability = models.CharField(
        max_length=16,
        choices=ProjectAvailability.choices,
        default=ProjectAvailability.ENABLED,
    )
    archived_at = models.DateTimeField(null=True, blank=True, editable=False)
    archived_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="archived_projects",
        null=True,
        blank=True,
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_projects",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="updated_projects",
    )

    class Meta:
        ordering = ("slug",)
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.CheckConstraint(
                condition=Q(availability__in=ProjectAvailability.values),
                name="project_valid_availability",
            ),
            models.CheckConstraint(
                condition=(
                    Q(
                        availability=ProjectAvailability.ARCHIVED,
                        archived_at__isnull=False,
                        archived_by__isnull=False,
                    )
                    | Q(
                        availability__in=(
                            ProjectAvailability.ENABLED,
                            ProjectAvailability.DISABLED,
                        ),
                        archived_at__isnull=True,
                        archived_by__isnull=True,
                    )
                ),
                name="project_archive_state_ok",
            ),
        ]

    def clean(self):
        super().clean()
        self.slug = slugify(self.slug)
        if not self.slug:
            raise ValidationError({"slug": "A valid project slug is required."})

    def __str__(self):
        return self.slug


class ProjectRevision(models.Model):
    project = models.ForeignKey(
        Project,
        on_delete=models.PROTECT,
        related_name="revisions",
    )
    status = models.CharField(
        max_length=16,
        choices=ProjectRevisionStatus.choices,
        default=ProjectRevisionStatus.DRAFT,
    )
    title = models.CharField(max_length=200, blank=True, default="")
    summary = models.CharField(max_length=300, blank=True, default="")
    description = models.TextField(blank=True, default="")
    category = models.ForeignKey(
        ProjectCategory,
        on_delete=models.PROTECT,
        related_name="project_revisions",
        null=True,
        blank=True,
    )
    location = models.CharField(max_length=160, blank=True, default="")
    country = models.CharField(max_length=120, blank=True, default="")
    start_date = models.DateField(null=True, blank=True)
    completion_date = models.DateField(null=True, blank=True)
    execution_status = models.CharField(
        max_length=16,
        choices=ProjectExecutionStatus.choices,
        blank=True,
        default="",
    )
    project_background = models.TextField(blank=True, default="")
    engineering_challenge = models.TextField(blank=True, default="")
    proposed_solution = models.TextField(blank=True, default="")
    work_carried_out = models.TextField(blank=True, default="")
    technical_specifications = models.TextField(blank=True, default="")
    outcomes = models.TextField(blank=True, default="")
    related_services = models.ManyToManyField(
        "services.Service",
        related_name="project_revisions",
        blank=True,
    )
    tags = models.ManyToManyField(
        ProjectTag,
        related_name="project_revisions",
        blank=True,
    )
    display_order = models.PositiveSmallIntegerField(
        default=0,
        validators=(MinValueValidator(0),),
    )
    is_featured = models.BooleanField(default=False)
    client_name = models.CharField(max_length=200, blank=True, default="")
    show_client_name = models.BooleanField(default=False)
    seo_title = models.CharField(max_length=70, blank=True, default="")
    seo_description = models.CharField(max_length=160, blank=True, default="")
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="created_project_revisions",
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="updated_project_revisions",
    )
    published_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.PROTECT,
        related_name="published_project_revisions",
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
                condition=Q(status__in=ProjectRevisionStatus.values),
                name="project_revision_valid_status",
            ),
            models.UniqueConstraint(
                fields=("project",),
                condition=Q(status=ProjectRevisionStatus.DRAFT),
                name="project_one_draft_revision",
            ),
            models.UniqueConstraint(
                fields=("project",),
                condition=Q(status=ProjectRevisionStatus.PUBLISHED),
                name="project_one_published_revision",
            ),
            models.CheckConstraint(
                condition=(
                    Q(start_date__isnull=True)
                    | Q(completion_date__isnull=True)
                    | Q(completion_date__gte=models.F("start_date"))
                ),
                name="project_completion_after_start",
            ),
        ]

    def clean(self):
        super().clean()
        errors = {}
        self.title = self.title.strip()
        self.summary = self.summary.strip()
        self.location = self.location.strip()
        self.country = self.country.strip()
        self.client_name = self.client_name.strip()
        self.seo_title = self.seo_title.strip()
        self.seo_description = self.seo_description.strip()

        if self.start_date and self.completion_date and self.completion_date < self.start_date:
            errors["completion_date"] = (
                "Completion date cannot be earlier than the start date."
            )
        if self.status == ProjectRevisionStatus.PUBLISHED:
            if not self.title:
                errors["title"] = "A project title is required."
            if not self.summary:
                errors["summary"] = "A short project summary is required."
            if not self.description.strip():
                errors["description"] = "A detailed project description is required."
            if self.category_id and not self.category.is_active:
                errors["category"] = (
                    "A project cannot be published in an inactive category."
                )
        if self.show_client_name and not self.client_name:
            errors["client_name"] = (
                "A client name is required before it can be displayed publicly."
            )
        if errors:
            raise ValidationError(errors)

    def __str__(self):
        return f"{self.title} ({self.status})"


class ProjectMediaAttachment(RevisionMediaAttachment):
    revision = models.ForeignKey(
        ProjectRevision,
        on_delete=models.CASCADE,
        related_name="media_attachments",
    )

    ALLOWED_ROLES: ClassVar[dict[str, str]] = {
        AttachmentRole.COVER_IMAGE: MediaType.IMAGE,
        AttachmentRole.GALLERY_IMAGE: MediaType.IMAGE,
        AttachmentRole.VIDEO: MediaType.VIDEO,
    }

    class Meta(RevisionMediaAttachment.Meta):
        abstract = False
        constraints: ClassVar[list[models.BaseConstraint]] = [
            models.UniqueConstraint(
                fields=("revision", "asset"),
                name="project_media_asset_once",
            ),
            models.UniqueConstraint(
                fields=("revision",),
                condition=Q(role=AttachmentRole.COVER_IMAGE),
                name="project_one_media_cover",
            ),
        ]
