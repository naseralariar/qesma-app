from datetime import date
from decimal import Decimal

from django.test import TestCase
from django.test.utils import override_settings
from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient

from apps.accounts.models import Department, User
from apps.core.models import AuditLog
from apps.distributions.models import Creditor, Debtor, Distribution


@override_settings(REST_FRAMEWORK={"DEFAULT_THROTTLE_CLASSES": [], "DEFAULT_THROTTLE_RATES": {}})
class ReportsAPITests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.dep_a = Department.objects.create(code="EXE-RA", name="إدارة تقارير A")
        self.dep_b = Department.objects.create(code="EXE-RB", name="إدارة تقارير B")

        self.admin = User.objects.create_user(username="admin_reports", password="Pass@12345", role="admin", department=self.dep_a)
        self.officer_a = User.objects.create_user(username="officer_reports_a", password="Pass@12345", role="officer", department=self.dep_a)
        self.officer_b = User.objects.create_user(username="officer_reports_b", password="Pass@12345", role="officer", department=self.dep_b)

        debtor_a = Debtor.objects.create(full_name="مدين تقارير", civil_id="333333333333", department=self.dep_a)

        self.distribution_a = Distribution.objects.create(
            debtor=debtor_a,
            department=self.dep_a,
            distribution_type="cash",
            deposit_or_sale_date=date(2026, 2, 10),
            proceed_amount=Decimal("2500.000"),
            machine_number="323456780",
            distribution_date=date(2026, 2, 11),
            list_type="temporary",
        )

        Creditor.objects.create(
            distribution=self.distribution_a,
            machine_number="111111110",
            creditor_name="دائن تجريبي",
            attachment_date=date(2026, 2, 1),
            attachment_type="تنفيذي",
            debt_amount=Decimal("1000.000"),
            debt_rank=1,
            distribution_amount=Decimal("1000.000"),
        )

    def test_distribution_print_allowed_same_department_and_logs_print(self):
        self.client.force_authenticate(user=self.officer_a)

        response = self.client.get(reverse("distribution-print", kwargs={"distribution_id": self.distribution_a.id}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.get("Content-Type"), "application/pdf")

        log = AuditLog.objects.filter(
            action="PRINT",
            user=self.officer_a,
            model_name="Distribution",
            object_id=str(self.distribution_a.id),
            details__mode="distribution_print",
        ).first()
        self.assertIsNotNone(log)

    def test_distribution_print_forbidden_for_other_department(self):
        self.client.force_authenticate(user=self.officer_b)

        response = self.client.get(reverse("distribution-print", kwargs={"distribution_id": self.distribution_a.id}))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_attendance_notice_forbidden_for_other_department(self):
        self.client.force_authenticate(user=self.officer_b)
        payload = {
            "distribution_id": self.distribution_a.id,
            "attendance_date": "2026-03-01",
            "attendance_time": "10:30:00",
            "location": "قصر العدل الجديد",
            "floor": "3",
            "room_number": "12",
        }

        response = self.client.post(reverse("attendance-notices"), payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_attendance_notice_allowed_same_department(self):
        self.client.force_authenticate(user=self.officer_a)
        payload = {
            "distribution_id": self.distribution_a.id,
            "attendance_date": "2026-03-01",
            "attendance_time": "10:30:00",
            "location": "قصر العدل الجديد",
            "floor": "3",
            "room_number": "12",
        }

        response = self.client.post(reverse("attendance-notices"), payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.get("Content-Type"), "application/pdf")

    def test_attendance_notice_forbidden_when_location_not_allowed(self):
        self.officer_a.attendance_allow_all_locations = False
        self.officer_a.attendance_allowed_locations = ["مجمع محاكم حولي"]
        self.officer_a.save(update_fields=["attendance_allow_all_locations", "attendance_allowed_locations"])
        self.client.force_authenticate(user=self.officer_a)
        payload = {
            "distribution_id": self.distribution_a.id,
            "attendance_date": "2026-03-01",
            "attendance_time": "10:30:00",
            "location": "قصر العدل الجديد",
            "floor": "3",
            "room_number": "12",
        }

        response = self.client.post(reverse("attendance-notices"), payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_session_minutes_get_and_post_generate_pdf(self):
        self.client.force_authenticate(user=self.officer_a)

        response_get = self.client.get(reverse("session-minutes"))
        self.assertEqual(response_get.status_code, status.HTTP_200_OK)
        self.assertEqual(response_get.get("Content-Type"), "application/pdf")

        response_post = self.client.post(
            reverse("session-minutes"),
            {
                "page1_body": "نص محرر للصفحة الأولى",
                "page2_body": "نص محرر للصفحة الثانية",
            },
            format="json",
        )
        self.assertEqual(response_post.status_code, status.HTTP_200_OK)
        self.assertEqual(response_post.get("Content-Type"), "application/pdf")

    def test_admin_can_print_any_department(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.get(reverse("distribution-print", kwargs={"distribution_id": self.distribution_a.id}))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.get("Content-Type"), "application/pdf")

    def test_session_minutes_rejects_page1_line_over_200_chars(self):
        self.client.force_authenticate(user=self.officer_a)
        long_line = "أ" * 201

        response = self.client.post(
            reverse("session-minutes"),
            {
                "distribution_id": self.distribution_a.id,
                "page1_body": long_line,
                "page2_body": "",
            },
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
