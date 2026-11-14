
from django.contrib import admin, messages
from django.core.exceptions import ValidationError

from company.models import (
    CompanyProfileMediaAttachment,
    HomepageSectionMediaAttachment,
)
from projects.models import ProjectMediaAttachment
from services.models import ServiceMediaAttachment

from .asset_workflows import (
    AssetHasPublicReferences,
    archive_media_asset,
    restore_media_asset,
)
from .models import MediaAsset


class ReadOnlyAttachmentInline(admin.TabularInline):
    extra = 0
    fields = (
        "revision",
        "role",
        "display_order",
        "caption_override",
        "alt_text_override",
        "created_by",
        "created_at",
    )
    readonly_fields = fields

    def has_add_permission(self, request, obj=None):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class ProjectAttachmentInline(ReadOnlyAttachmentInline):
    model = ProjectMediaAttachment
    fk_name = "asset"


class ServiceAttachmentInline(ReadOnlyAttachmentInline):
    model = ServiceMediaAttachment
    fk_name = "asset"


class CompanyProfileAttachmentInline(ReadOnlyAttachmentInline):
    model = CompanyProfileMediaAttachment
    fk_name = "asset"


class HomepageAttachmentInline(ReadOnlyAttachmentInline):
    model = HomepageSectionMediaAttachment
    fk_name = "asset"


@admin.register(MediaAsset)
class MediaAssetAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "title",
        "display_filename",
        "media_type",
        "lifecycle",
        "file_size",
        "uploader",
        "created_at",
    )
    list_filter = ("media_type", "lifecycle", "created_at")
    search_fields = ("title", "display_filename", "original_filename", "sha256")
    ordering = ("-created_at",)
    date_hierarchy = "created_at"
    inlines = (
        ProjectAttachmentInline,
        ServiceAttachmentInline,
        CompanyProfileAttachmentInline,
        HomepageAttachmentInline,
    )
    actions = ("archive_selected", "restore_selected")
    fields = (
        "id",
        "original_filename",
        "display_filename",
        "uploader",
        "media_type",
        "verified_mime_type",
        "file_extension",
        "file_size",
        "sha256",
        "width",
        "height",
        "duration_seconds",
        "processing_metadata",
        "title",
        "description",
        "alt_text",
        "caption",
        "credit",
        "accessibility_description",
        "lifecycle",
        "archived_at",
        "archived_by",
        "created_at",
        "updated_at",
    )
    readonly_fields = (
        "id",
        "original_filename",
        "display_filename",
        "uploader",
        "media_type",
        "verified_mime_type",
        "file_extension",
        "file_size",
        "sha256",
        "width",
        "height",
        "duration_seconds",
        "processing_metadata",
        "lifecycle",
        "archived_at",
        "archived_by",
        "created_at",
        "updated_at",
    )

    @admin.action(description="Archive selected media assets")
    def archive_selected(self, request, queryset):
        for asset in queryset:
            try:
                archive_media_asset(asset, request.user)
            except AssetHasPublicReferences:
                self.message_user(
                    request,
                    f"{asset} is still used by public content.",
                    level=messages.WARNING,
                )
            except ValidationError as error:
                self.message_user(request, str(error), level=messages.ERROR)

    @admin.action(description="Restore selected media assets")
    def restore_selected(self, request, queryset):
        for asset in queryset:
            try:
                restore_media_asset(asset)
            except ValidationError as error:
                self.message_user(request, str(error), level=messages.ERROR)

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
