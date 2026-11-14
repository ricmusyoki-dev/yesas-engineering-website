from django.contrib import admin

from .models import (
    Project,
    ProjectCategory,
    ProjectRevision,
    ProjectRevisionStatus,
    ProjectTag,
)


@admin.register(ProjectCategory)
class ProjectCategoryAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "is_active", "display_order", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("name", "slug")
    ordering = ("display_order", "name")
    readonly_fields = ("created_at", "updated_at", "created_by", "updated_by")

    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(ProjectTag)
class ProjectTagAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "is_active", "updated_at")
    list_filter = ("is_active",)
    search_fields = ("name", "slug")
    ordering = ("name",)
    readonly_fields = ("created_at", "updated_at", "created_by", "updated_by")

    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("slug", "availability", "created_at", "updated_at")
    list_filter = ("availability",)
    search_fields = ("slug",)
    ordering = ("slug",)
    readonly_fields = (
        "slug",
        "availability",
        "archived_at",
        "archived_by",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
    )

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(ProjectRevision)
class ProjectRevisionAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "project",
        "category",
        "status",
        "is_featured",
        "display_order",
        "updated_at",
        "published_at",
    )
    list_filter = ("status", "is_featured", "category", "project__availability")
    search_fields = ("title", "summary", "description", "project__slug")
    ordering = ("project__slug", "-created_at")
    readonly_fields = (
        "project",
        "status",
        "created_by",
        "updated_by",
        "published_by",
        "created_at",
        "updated_at",
        "published_at",
    )

    def get_readonly_fields(self, request, obj=None):
        fields = super().get_readonly_fields(request, obj)
        if obj is not None and obj.status != ProjectRevisionStatus.DRAFT:
            concrete_fields = (field.name for field in obj._meta.concrete_fields)
            return (*fields, *concrete_fields, "related_services", "tags")
        return fields

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False

    def save_model(self, request, obj, form, change):
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)
