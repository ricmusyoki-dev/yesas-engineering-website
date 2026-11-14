from rest_framework.permissions import BasePermission

from .models import User


def _is_active_role(user, role: str) -> bool:
    return bool(
        user
        and user.is_authenticated
        and user.is_active
        and user.role == role
    )


def _is_technical_admin(user) -> bool:
    return bool(
        _is_active_role(user, User.Role.TECHNICAL_ADMIN)
        and user.is_staff
        and user.is_superuser
    )


class IsOwnerOrTechnicalAdmin(BasePermission):
    """Allow active owners and valid technical superusers."""

    def has_permission(self, request, view) -> bool:
        user = request.user
        return _is_active_role(user, User.Role.OWNER) or _is_technical_admin(
            user
        )


class IsContentManagerOrOwner(BasePermission):
    """Allow active content managers, owners, and valid technical admins."""

    def has_permission(self, request, view) -> bool:
        user = request.user
        return (
            _is_active_role(user, User.Role.OWNER)
            or _is_active_role(user, User.Role.CONTENT_MANAGER)
            or _is_technical_admin(user)
        )
