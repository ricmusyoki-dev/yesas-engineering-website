from types import SimpleNamespace

from django.contrib.auth.models import AnonymousUser
from django.core.cache import cache
from django.test import TestCase
from rest_framework.test import APIClient

from .models import User
from .permissions import IsContentManagerOrOwner, IsOwnerOrTechnicalAdmin

PASSWORD = "a-strong-password-974!"
PROFILE_FIELDS = {"id", "email", "first_name", "last_name", "role"}


class AuthenticationApiTests(TestCase):
    def setUp(self):
        cache.clear()
        self.owner = User.objects.create_user(
            "owner@example.com",
            PASSWORD,
            first_name="Site",
            last_name="Owner",
        )
        self.technical_admin = User.objects.create_superuser(
            "technical@example.com",
            PASSWORD,
            first_name="Technical",
            last_name="Administrator",
        )

    def csrf_client(self):
        client = APIClient(enforce_csrf_checks=True)
        response = client.get("/api/v1/auth/csrf/")
        self.assertEqual(response.status_code, 200)
        return client, response.data["csrfToken"]

    def login(self, client, csrf_token, email="owner@example.com"):
        return client.post(
            "/api/v1/auth/login/",
            {"email": email, "password": PASSWORD},
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )

    def test_csrf_endpoint_returns_token_and_sets_cookie(self):
        client = APIClient(enforce_csrf_checks=True)

        response = client.get("/api/v1/auth/csrf/")

        self.assertEqual(response.status_code, 200)
        self.assertTrue(response.data["csrfToken"])
        self.assertIn("csrftoken", client.cookies)

    def test_login_rejects_missing_csrf_token(self):
        client = APIClient(enforce_csrf_checks=True)

        response = client.post(
            "/api/v1/auth/login/",
            {"email": self.owner.email, "password": PASSWORD},
            format="json",
        )

        self.assertEqual(response.status_code, 403)

    def test_login_rejects_invalid_csrf_token(self):
        client = APIClient(enforce_csrf_checks=True)
        client.get("/api/v1/auth/csrf/")

        response = client.post(
            "/api/v1/auth/login/",
            {"email": self.owner.email, "password": PASSWORD},
            format="json",
            HTTP_X_CSRFTOKEN="invalid-token",
        )

        self.assertEqual(response.status_code, 403)

    def test_valid_csrf_protected_login_establishes_owner_session(self):
        client, csrf_token = self.csrf_client()

        response = self.login(client, csrf_token, email="OWNER@EXAMPLE.COM")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(response.data), PROFILE_FIELDS)
        self.assertEqual(response.data["id"], self.owner.pk)
        self.assertEqual(response.data["email"], self.owner.email)
        self.assertEqual(response.data["role"], User.Role.OWNER)
        self.assertIn("sessionid", client.cookies)
        self.assertNotIn(b"password", response.content.lower())
        self.assertNotIn(b"session", response.content.lower())

        profile_response = client.get("/api/v1/auth/me/")
        self.assertEqual(profile_response.status_code, 200)
        self.assertEqual(profile_response.data, response.data)

    def test_technical_admin_can_login_without_sensitive_profile_fields(self):
        client, csrf_token = self.csrf_client()

        response = self.login(
            client,
            csrf_token,
            email=self.technical_admin.email,
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(set(response.data), PROFILE_FIELDS)
        self.assertEqual(response.data["role"], User.Role.TECHNICAL_ADMIN)
        self.assertNotIn("is_staff", response.data)
        self.assertNotIn("is_superuser", response.data)
        self.assertNotIn("password", response.data)
        self.assertIn("sessionid", client.cookies)
        self.assertEqual(
            client.get("/api/v1/auth/me/").data,
            response.data,
        )

    def test_invalid_password_and_unknown_email_have_same_error(self):
        client, csrf_token = self.csrf_client()
        invalid_password = client.post(
            "/api/v1/auth/login/",
            {"email": self.owner.email, "password": "incorrect"},
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        unknown_email = self.login(
            client,
            csrf_token,
            email="unknown@example.com",
        )

        self.assertEqual(invalid_password.status_code, 400)
        self.assertEqual(
            invalid_password.data,
            {"detail": "Invalid email or password."},
        )
        self.assertEqual(unknown_email.status_code, 400)
        self.assertEqual(unknown_email.data, invalid_password.data)

    def test_malformed_login_input_has_generic_authentication_error(self):
        client, csrf_token = self.csrf_client()

        response = client.post(
            "/api/v1/auth/login/",
            {"email": "not-an-email", "password": PASSWORD},
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data,
            {"detail": "Invalid email or password."},
        )

    def test_inactive_account_cannot_log_in(self):
        self.owner.is_active = False
        self.owner.save(update_fields=("is_active",))
        client, csrf_token = self.csrf_client()

        response = self.login(client, csrf_token)

        self.assertEqual(response.status_code, 400)
        self.assertEqual(
            response.data,
            {"detail": "Invalid email or password."},
        )
        self.assertNotIn("sessionid", client.cookies)

    def test_anonymous_user_cannot_access_profile(self):
        response = APIClient().get("/api/v1/auth/me/")

        self.assertEqual(response.status_code, 403)

    def test_logout_requires_csrf_and_destroys_session(self):
        client, csrf_token = self.csrf_client()
        login_response = self.login(client, csrf_token)
        self.assertEqual(login_response.status_code, 200)

        csrf_response = client.get("/api/v1/auth/csrf/")
        csrf_token = csrf_response.data["csrfToken"]
        csrf_rejected = client.post("/api/v1/auth/logout/", format="json")
        self.assertEqual(csrf_rejected.status_code, 403)

        logout_response = client.post(
            "/api/v1/auth/logout/",
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )
        self.assertEqual(logout_response.status_code, 204)
        self.assertEqual(client.get("/api/v1/auth/me/").status_code, 403)

    def test_anonymous_user_cannot_log_out(self):
        client, csrf_token = self.csrf_client()

        response = client.post(
            "/api/v1/auth/logout/",
            format="json",
            HTTP_X_CSRFTOKEN=csrf_token,
        )

        self.assertEqual(response.status_code, 403)

    def test_login_rate_limit_returns_too_many_requests(self):
        client, csrf_token = self.csrf_client()
        responses = [
            client.post(
                "/api/v1/auth/login/",
                {"email": self.owner.email, "password": "incorrect"},
                format="json",
                HTTP_X_CSRFTOKEN=csrf_token,
            )
            for _ in range(6)
        ]

        self.assertEqual(
            [response.status_code for response in responses],
            [400, 400, 400, 400, 400, 429],
        )


class RolePermissionTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user("owner@example.com")
        self.content_manager = User.objects.create_user(
            "manager@example.com",
            role=User.Role.CONTENT_MANAGER,
        )
        self.technical_admin = User.objects.create_superuser(
            "technical@example.com"
        )
        self.owner_permission = IsOwnerOrTechnicalAdmin()
        self.content_permission = IsContentManagerOrOwner()

    def allowed(self, permission, user):
        return permission.has_permission(
            SimpleNamespace(user=user),
            None,
        )

    def test_owner_permissions(self):
        self.assertTrue(self.allowed(self.owner_permission, self.owner))
        self.assertTrue(self.allowed(self.content_permission, self.owner))

    def test_content_manager_permissions(self):
        self.assertFalse(
            self.allowed(self.owner_permission, self.content_manager)
        )
        self.assertTrue(
            self.allowed(self.content_permission, self.content_manager)
        )

    def test_technical_admin_permissions_require_superuser_privileges(self):
        self.assertTrue(
            self.allowed(self.owner_permission, self.technical_admin)
        )
        self.assertTrue(
            self.allowed(self.content_permission, self.technical_admin)
        )

        self.technical_admin.is_superuser = False
        self.assertFalse(
            self.allowed(self.owner_permission, self.technical_admin)
        )
        self.assertFalse(
            self.allowed(self.content_permission, self.technical_admin)
        )
        self.technical_admin.is_superuser = True
        self.technical_admin.is_staff = False
        self.assertFalse(
            self.allowed(self.owner_permission, self.technical_admin)
        )
        self.assertFalse(
            self.allowed(self.content_permission, self.technical_admin)
        )

    def test_anonymous_and_inactive_users_are_denied(self):
        self.assertFalse(
            self.allowed(self.owner_permission, AnonymousUser())
        )
        self.assertFalse(
            self.allowed(self.content_permission, AnonymousUser())
        )

        self.owner.is_active = False
        self.assertFalse(self.allowed(self.owner_permission, self.owner))
        self.assertFalse(self.allowed(self.content_permission, self.owner))
        self.content_manager.is_active = False
        self.assertFalse(
            self.allowed(self.owner_permission, self.content_manager)
        )
        self.assertFalse(
            self.allowed(self.content_permission, self.content_manager)
        )
        self.technical_admin.is_active = False
        self.assertFalse(
            self.allowed(self.owner_permission, self.technical_admin)
        )
        self.assertFalse(
            self.allowed(self.content_permission, self.technical_admin)
        )

    def test_staff_flag_does_not_grant_owner_permissions(self):
        self.content_manager.is_staff = True

        self.assertFalse(
            self.allowed(self.owner_permission, self.content_manager)
        )
        self.assertTrue(
            self.allowed(self.content_permission, self.content_manager)
        )

        staff_only = User.objects.create_user("staff@example.com")
        staff_only.role = "unrecognized"
        staff_only.is_staff = True
        self.assertFalse(self.allowed(self.owner_permission, staff_only))
        self.assertFalse(self.allowed(self.content_permission, staff_only))
