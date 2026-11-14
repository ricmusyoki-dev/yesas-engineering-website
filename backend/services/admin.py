from django.contrib import admin

from company.models import RevisionStatus

from .models import Service, ServiceCategory, ServiceRevision


@admin.register(ServiceCategory)
class ServiceCategoryAdmin(admin.ModelAdmin):
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


@admin.register(Service)
class ServiceAdmin(admin.ModelAdmin):
    list_display = (
        "slug",
        "is_archived",
        "created_at",
        "updated_at",
    )
    list_filter = ("is_archived",)
    search_fields = ("slug",)
    ordering = ("slug",)
    readonly_fields = (
        "slug",
        "is_archived",
        "created_at",
        "updated_at",
        "created_by",
        "updated_by",
        "archived_at",
        "archived_by",
    )

    def has_delete_permission(self, request, obj=None):
        return False

    def has_add_permission(self, request):
        return False

    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)


@admin.register(ServiceRevision)
class ServiceRevisionAdmin(admin.ModelAdmin):
    list_display = (
        "title",
        "service",
        "category",
        "status",
        "is_enabled",
        "is_featured",
        "display_order",
        "updated_at",
        "published_at",
    )
    list_filter = ("status", "is_enabled", "is_featured", "category")
    search_fields = ("title", "summary", "description", "service__slug")
    ordering = ("service__slug", "-created_at")
    readonly_fields = (
        "service",
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
        if obj is not None and obj.status != RevisionStatus.DRAFT:
            return (*fields, *(field.name for field in obj._meta.fields))
        return fields

    def has_delete_permission(self, request, obj=None):
        return False

    def has_add_permission(self, request):
        return False

    def save_model(self, request, obj, form, change):
        if not change:
            obj.created_by = request.user
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)
