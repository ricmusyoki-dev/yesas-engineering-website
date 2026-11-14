from django.contrib import admin

from .models import CompanyProfileRevision, HomepageSectionRevision, RevisionStatus


class RevisionAdmin(admin.ModelAdmin):
    readonly_fields = (
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
            return (
                *fields,
                *(field.name for field in obj._meta.fields),
                *(field.name for field in obj._meta.many_to_many),
            )
        return fields

    def save_model(self, request, obj, form, change):
        if not change:
            obj.status = RevisionStatus.DRAFT
            obj.created_by = request.user
        obj.updated_by = request.user
        super().save_model(request, obj, form, change)

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(CompanyProfileRevision)
class CompanyProfileRevisionAdmin(RevisionAdmin):
    readonly_fields = (*RevisionAdmin.readonly_fields, "scope")
    list_display = (
        "name",
        "status",
        "updated_by",
        "updated_at",
        "published_at",
    )
    list_filter = ("status", "country", "city")
    search_fields = ("name", "tagline", "business_email", "city", "country")
    ordering = ("-created_at", "-pk")
    fieldsets = (
        ("Revision", {"fields": ("status", "scope")}),
        (
            "Company identity",
            {"fields": ("name", "tagline", "description", "overview")},
        ),
        (
            "Contact information",
            {
                "fields": (
                    "business_phone",
                    "whatsapp_number",
                    "business_email",
                    "physical_address",
                    "city",
                    "country",
                    "service_areas",
                )
            },
        ),
        (
            "Social media",
            {
                "fields": (
                    "linkedin_url",
                    "instagram_url",
                    "facebook_url",
                    "tiktok_url",
                    "youtube_url",
                )
            },
        ),
        (
            "Revision history",
            {
                "fields": (
                    "created_by",
                    "updated_by",
                    "published_by",
                    "created_at",
                    "updated_at",
                    "published_at",
                )
            },
        ),
    )


@admin.register(HomepageSectionRevision)
class HomepageSectionRevisionAdmin(RevisionAdmin):
    list_display = (
        "section_type",
        "heading",
        "status",
        "is_visible",
        "display_order",
        "updated_at",
        "published_at",
    )
    list_filter = ("section_type", "status", "is_visible")
    search_fields = ("heading", "body")
    ordering = ("display_order", "section_type", "-created_at")
    fieldsets = (
        ("Revision", {"fields": ("status", "section_type")}),
        (
            "Section content",
            {
                "fields": (
                    "heading",
                    "body",
                    "cta_label",
                    "cta_destination",
                    "item_limit",
                    "curated_services",
                    "curated_projects",
                )
            },
        ),
        ("Display", {"fields": ("is_visible", "display_order")}),
        (
            "Revision history",
            {
                "fields": (
                    "created_by",
                    "updated_by",
                    "published_by",
                    "created_at",
                    "updated_at",
                    "published_at",
                )
            },
        ),
    )
