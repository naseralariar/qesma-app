from django.test import TestCase
from django.urls import reverse
from django.test.utils import override_settings
from django.core.cache import cache
from rest_framework import status
from rest_framework.test import APIClient

from apps.core.models import AuditLog

from .models import Department, User


@override_settings(REST_FRAMEWORK={"DEFAULT_THROTTLE_CLASSES": [], "DEFAULT_THROTTLE_RATES": {}})
class AccountsAuthAuditTests(TestCase):
    def setUp(self):
        cache.clear()
        self.client = APIClient()
        self.department = Department.objects.create(code="EXE-T", name="إدارة اختبار")
        self.user = User.objects.create_user(
            username="audit_user",
            password="Pass@12345",
            role="officer",
            department=self.department,
            is_active=True,
        )

    def _login(self, username, password):
        return self.client.post(
            reverse("token_obtain_pair"),
            {"username": username, "password": password},
            format="json",
        )

    def test_login_success_creates_audit_log(self):
        response = self._login("audit_user", "Pass@12345")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("access", response.data)

        log = AuditLog.objects.filter(action="LOGIN", user=self.user).first()
        self.assertIsNotNone(log)
        self.assertEqual(log.details.get("status"), "success")
        self.assertEqual(log.details.get("username"), "audit_user")

    def test_login_failure_creates_audit_log(self):
        response = self._login("audit_user", "WrongPass")

        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

        log = AuditLog.objects.filter(action="LOGIN", details__status="failure").first()
        self.assertIsNotNone(log)
        self.assertEqual(log.details.get("status"), "failure")
        self.assertEqual(log.details.get("username"), "audit_user")

    def test_change_password_success_and_relogin(self):
        login_response = self._login("audit_user", "Pass@12345")
        token = login_response.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        response = self.client.post(
            reverse("auth-change-password"),
            {
                "current_password": "Pass@12345",
                "new_password": "NewPass@12345",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_200_OK)

        update_log = AuditLog.objects.filter(action="UPDATE", user=self.user, details__event="password_change").first()
        self.assertIsNotNone(update_log)

        self.client.credentials()
        old_login = self._login("audit_user", "Pass@12345")
        self.assertEqual(old_login.status_code, status.HTTP_401_UNAUTHORIZED)

        new_login = self._login("audit_user", "NewPass@12345")
        self.assertEqual(new_login.status_code, status.HTTP_200_OK)

    def test_change_password_rejects_wrong_current_password(self):
        login_response = self._login("audit_user", "Pass@12345")
        token = login_response.data["access"]
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")

        response = self.client.post(
            reverse("auth-change-password"),
            {
                "current_password": "incorrect-current",
                "new_password": "AnotherPass@123",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("current_password", str(response.data))

    def test_officer_login_includes_dashboard_hidden_by_default(self):
        response = self._login("audit_user", "Pass@12345")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn("dashboard", response.data["user"].get("sidebar_hidden_items", []))

    def test_manager_login_does_not_hide_dashboard_by_default(self):
        manager = User.objects.create_user(
            username="manager_user",
            password="Pass@12345",
            role="manager",
            department=self.department,
            is_active=True,
        )

        response = self._login("manager_user", "Pass@12345")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertNotIn("dashboard", response.data["user"].get("sidebar_hidden_items", []))
        self.assertIsNotNone(manager.id)
