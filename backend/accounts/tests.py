from django.contrib import admin, auth
from django.core.exceptions import ValidationError
from django.test import TestCase
from django.urls import reverse

from .forms import UserChangeForm, UserCreationForm
from .models import User


class UserManagerTests(TestCase):
    def test_create_user_defaults_to_owner_without_django_permissions(self):
        user = User.objects.create_user(
            "Owner@Example.COM",
            "a-strong-password-974!",
            first_name="Site",
            last_name="Owner",
        )

        self.assertEqual(user.email, "owner@example.com")
        self.assertEqual(user.role, User.Role.OWNER)
        self.assertTrue(user.is_active)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertTrue(user.is_authenticated)
        self.assertFalse(user.is_anonymous)
        self.assertFalse(user.has_perm("accounts.change_user"))
        self.assertFalse(user.groups.exists())
        self.assertFalse(user.user_permissions.exists())

    def test_password_is_hashed(self):
        raw_password = "a-strong-password-974!"
        user = User.objects.create_user(
            "owner@example.com",
            raw_password,
        )

        self.assertNotEqual(user.password, raw_password)
        self.assertTrue(user.password.startswith("pbkdf2_sha256$"))
        self.assertTrue(user.check_password(raw_password))

    def test_create_user_accepts_content_manager_role(self):
        user = User.objects.create_user(
            "editor@example.com",
            "a-strong-password-974!",
            role=User.Role.CONTENT_MANAGER,
        )

        self.assertEqual(user.role, User.Role.CONTENT_MANAGER)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)

    def test_create_user_rejects_privileged_or_invalid_configuration(self):
        cases = (
            ({"role": User.Role.TECHNICAL_ADMIN}, "technical administrators"),
            ({"role": "unknown"}, "valid application role"),
            ({"is_staff": True}, "staff accounts"),
            ({"is_superuser": True}, "technical administrators"),
        )
        for extra_fields, message in cases:
            with (
                self.subTest(extra_fields=extra_fields),
                self.assertRaisesRegex(ValueError, message),
            ):
                User.objects.create_user(
                    "person@example.com",
                    "a-strong-password-974!",
                    **extra_fields,
                )

    def test_create_superuser_has_technical_admin_privileges(self):
        user = User.objects.create_superuser(
            "admin@example.com",
            "a-strong-password-974!",
            first_name="Technical",
            last_name="Administrator",
        )

        self.assertEqual(user.role, User.Role.TECHNICAL_ADMIN)
        self.assertTrue(user.is_staff)
        self.assertTrue(user.is_superuser)
        self.assertTrue(user.has_perm("accounts.change_user"))

    def test_create_superuser_rejects_invalid_configuration(self):
        cases = (
            ({"is_staff": False}, "is_staff=True"),
            ({"is_superuser": False}, "is_superuser=True"),
            ({"role": User.Role.OWNER}, "technical_admin role"),
        )
        for extra_fields, message in cases:
            with (
                self.subTest(extra_fields=extra_fields),
                self.assertRaisesRegex(ValueError, message),
            ):
                User.objects.create_superuser(
                    "admin@example.com",
                    "a-strong-password-974!",
                    **extra_fields,
                )

    def test_create_user_rejects_missing_or_invalid_email(self):
        with self.assertRaisesRegex(ValueError, "email address is required"):
            User.objects.create_user("", "a-strong-password-974!")

        with self.assertRaises(ValidationError):
            User.objects.create_user("not-an-email", "a-strong-password-974!")

        self.assertFalse(User.objects.exists())

    def test_authentication_uses_email_and_rejects_inactive_users(self):
        user = User.objects.create_user(
            "owner@example.com",
            "a-strong-password-974!",
        )

        self.assertEqual(
            auth.authenticate(
                username="owner@example.com",
                password="a-strong-password-974!",
            ),
            user,
        )
        self.assertEqual(
            auth.authenticate(
                email="owner@example.com",
                password="a-strong-password-974!",
            ),
            user,
        )

        user.is_active = False
        user.save(update_fields=("is_active",))
        self.assertIsNone(
            auth.authenticate(
                email="owner@example.com",
                password="a-strong-password-974!",
            )
        )


class UserModelTests(TestCase):
    def test_authentication_fields_and_required_fields(self):
        self.assertEqual(User.USERNAME_FIELD, "email")
        self.assertEqual(User.REQUIRED_FIELDS, ["first_name", "last_name"])
        self.assertTrue(User._meta.get_field("email").unique)
        self.assertFalse(User._meta.get_field("email").blank)
        self.assertFalse(User._meta.get_field("first_name").blank)
        self.assertFalse(User._meta.get_field("last_name").blank)

    def test_model_save_normalizes_email(self):
        user = User(
            email=" Owner@Example.COM ",
            first_name="Site",
            last_name="Owner",
        )
        user.set_password("a-strong-password-974!")
        user.save()

        self.assertEqual(user.email, "owner@example.com")


class UserAdminAndFormTests(TestCase):
    def test_creation_form_creates_hashed_owner_and_hides_admin_role(self):
        form = UserCreationForm(
            data={
                "email": "new-owner@example.com",
                "first_name": "New",
                "last_name": "Owner",
                "role": User.Role.OWNER,
                "is_active": True,
                "password1": "a-strong-password-974!",
                "password2": "a-strong-password-974!",
            }
        )

        self.assertNotIn(
            User.Role.TECHNICAL_ADMIN,
            [choice[0] for choice in form.fields["role"].choices],
        )
        self.assertTrue(form.is_valid(), form.errors)
        user = form.save()
        self.assertEqual(user.role, User.Role.OWNER)
        self.assertFalse(user.is_staff)
        self.assertFalse(user.is_superuser)
        self.assertTrue(user.check_password("a-strong-password-974!"))

    def test_creation_form_rejects_technical_admin_role(self):
        form = UserCreationForm(
            data={
                "email": "admin@example.com",
                "first_name": "Technical",
                "last_name": "Administrator",
                "role": User.Role.TECHNICAL_ADMIN,
                "is_active": True,
                "password1": "a-strong-password-974!",
                "password2": "a-strong-password-974!",
            }
        )

        self.assertFalse(form.is_valid())
        self.assertIn("role", form.errors)

    def test_change_form_and_admin_registration_are_compatible(self):
        owner = User.objects.create_user("owner@example.com")
        form = UserChangeForm(instance=owner)
        registered_admin = admin.site._registry[User]

        self.assertEqual(form._meta.model, User)
        self.assertIn("email", form.fields)
        self.assertNotIn(
            User.Role.TECHNICAL_ADMIN,
            [choice[0] for choice in form.fields["role"].choices],
        )
        self.assertIn("role", registered_admin.list_display)
        self.assertIn("is_active", registered_admin.list_display)
        self.assertIn("is_staff", registered_admin.list_display)
        self.assertIn("email", registered_admin.search_fields)
        self.assertIn("first_name", registered_admin.search_fields)
        self.assertIn("last_name", registered_admin.search_fields)

    def test_ordinary_owner_cannot_access_django_admin(self):
        owner = User.objects.create_user("owner@example.com")
        self.client.force_login(owner)

        response = self.client.get("/admin/accounts/user/")

        self.assertEqual(response.status_code, 302)
        self.assertIn("/admin/login/", response["Location"])

    def test_technical_admin_can_render_user_add_and_change_forms(self):
        technical_admin = User.objects.create_superuser(
            "admin@example.com",
            "a-strong-password-974!",
            first_name="Technical",
            last_name="Administrator",
        )
        owner = User.objects.create_user(
            "owner@example.com",
            first_name="Site",
            last_name="Owner",
        )
        self.client.force_login(technical_admin)

        add_response = self.client.get(reverse("admin:accounts_user_add"))
        self.assertEqual(add_response.status_code, 200)
        add_form = add_response.context["adminform"].form
        self.assertNotIn(
            User.Role.TECHNICAL_ADMIN,
            [choice[0] for choice in add_form.fields["role"].choices],
        )

        change_response = self.client.get(
            reverse("admin:accounts_user_change", args=(owner.pk,))
        )
        self.assertEqual(change_response.status_code, 200)
        change_form = change_response.context["adminform"].form
        self.assertIn("groups", change_form.fields)
        self.assertIn("user_permissions", change_form.fields)
        self.assertIn("is_superuser", change_form.fields)
