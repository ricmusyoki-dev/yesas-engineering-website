from django.contrib.auth.forms import (
    UserChangeForm as DjangoUserChangeForm,
)
from django.contrib.auth.forms import (
    UserCreationForm as DjangoUserCreationForm,
)
from django.core.exceptions import ValidationError

from .models import User


class UserCreationForm(DjangoUserCreationForm):
    """Form for creating email-based user accounts."""

    class Meta(DjangoUserCreationForm.Meta):
        model = User
        fields = (
            "email",
            "first_name",
            "last_name",
            "role",
            "is_active",
        )

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.fields["role"].choices = tuple(
            choice
            for choice in self.fields["role"].choices
            if choice[0] != User.Role.TECHNICAL_ADMIN
        )


class UserChangeForm(DjangoUserChangeForm):
    """Form for editing existing user accounts."""

    class Meta(DjangoUserChangeForm.Meta):
        model = User
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        role_field = self.fields.get("role")
        if role_field is not None and not self.instance.is_superuser:
            role_field.choices = tuple(
                choice
                for choice in role_field.choices
                if choice[0] != User.Role.TECHNICAL_ADMIN
            )

    def clean(self):
        cleaned_data = super().clean()
        role = cleaned_data.get("role")
        is_superuser = cleaned_data.get(
            "is_superuser", self.instance.is_superuser
        )
        if role is not None and is_superuser != (
            role == User.Role.TECHNICAL_ADMIN
        ):
            raise ValidationError(
                "Only a technical administrator can have the "
                "technical administrator role."
            )
        return cleaned_data
