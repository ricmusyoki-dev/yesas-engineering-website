from __future__ import annotations

from typing import TYPE_CHECKING, Any

from django.contrib.auth.base_user import BaseUserManager
from django.core.validators import validate_email

if TYPE_CHECKING:
    from .models import User


class UserManager(BaseUserManager):
    """Manager for email-based user accounts."""

    use_in_migrations = True

    def _create_user(
        self, email: str, password: str | None, **extra_fields: Any
    ) -> User:
        if not email:
            raise ValueError("An email address is required.")

        email = self.normalize_email(email).strip().lower()
        if not email:
            raise ValueError("An email address is required.")
        validate_email(email)

        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_user(
        self, email: str, password: str | None = None, **extra_fields: Any
    ) -> User:
        """Create an ordinary application user."""

        extra_fields.setdefault("is_staff", False)
        extra_fields.setdefault("is_superuser", False)
        extra_fields.setdefault("role", "owner")

        if extra_fields["is_staff"] is not False:
            raise ValueError(
                "Ordinary users cannot be Django staff accounts."
            )
        if extra_fields["is_superuser"] is not False:
            raise ValueError(
                "Use create_superuser() for technical administrators."
            )
        if extra_fields["role"] == "technical_admin":
            raise ValueError(
                "Use create_superuser() for technical administrators."
            )
        if extra_fields["role"] not in ("owner", "content_manager"):
            raise ValueError(
                "Ordinary users must have a valid application role."
            )

        return self._create_user(email, password, **extra_fields)

    def create_superuser(
        self, email: str, password: str | None = None, **extra_fields: Any
    ) -> User:
        """Create a separate technical Django administrator."""

        extra_fields.setdefault("is_staff", True)
        extra_fields.setdefault("is_superuser", True)
        extra_fields.setdefault("role", "technical_admin")

        if extra_fields["is_staff"] is not True:
            raise ValueError("A superuser must have is_staff=True.")
        if extra_fields["is_superuser"] is not True:
            raise ValueError("A superuser must have is_superuser=True.")
        if extra_fields["role"] != "technical_admin":
            raise ValueError(
                "A technical superuser must have the technical_admin role."
            )

        return self._create_user(email, password, **extra_fields)
