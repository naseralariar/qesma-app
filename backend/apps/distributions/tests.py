from datetime import date
from decimal import Decimal

from django.urls import reverse
from rest_framework import status
from rest_framework.test import APIClient
from django.test import TestCase

from apps.accounts.models import Department, User

from .models import Debtor, Distribution
from .services import distribute_proceeds


class DistributionAlgorithmTests(TestCase):
    def test_higher_rank_takes_priority(self):
        creditors = [
            {"debt_amount": Decimal("100.000"), "debt_rank": 1},
            {"debt_amount": Decimal("50.000"), "debt_rank": 2},
        ]

        result = distribute_proceeds(Decimal("100.000"), creditors)

        self.assertEqual(result[0]["distribution_amount"], Decimal("100.000"))
        self.assertEqual(result[1]["distribution_amount"], Decimal("0.000"))

    def test_pro_rata_inside_same_rank_when_insufficient(self):
        creditors = [
            {"debt_amount": Decimal("100.000"), "debt_rank": 1},
            {"debt_amount": Decimal("300.000"), "debt_rank": 1},
        ]

        result = distribute_proceeds(Decimal("200.000"), creditors)

        self.assertEqual(result[0]["distribution_amount"], Decimal("50.000"))
        self.assertEqual(result[1]["distribution_amount"], Decimal("150.000"))

    def test_rounding_precision_three_decimals(self):
        creditors = [
            {"debt_amount": Decimal("10.000"), "debt_rank": 1},
            {"debt_amount": Decimal("10.000"), "debt_rank": 1},
            {"debt_amount": Decimal("10.000"), "debt_rank": 1},
        ]

        result = distribute_proceeds(Decimal("10.000"), creditors)
        total_distributed = sum((r["distribution_amount"] for r in result), Decimal("0.000"))

        self.assertEqual(total_distributed, Decimal("10.000"))
        for row in result:
            self.assertEqual(row["distribution_amount"].as_tuple().exponent, -3)


class DistributionAPIScopeTests(TestCase):
    def setUp(self):
        self.client = APIClient()

        self.dep_a = Department.objects.create(code="EXE-A", name="إدارة A")
        self.dep_b = Department.objects.create(code="EXE-B", name="إدارة B")

        self.admin = User.objects.create_user(username="admin_t", password="Pass@12345", role="admin", department=self.dep_a)
        self.officer_a = User.objects.create_user(username="officer_a", password="Pass@12345", role="officer", department=self.dep_a)

        debtor_a = Debtor.objects.create(full_name="مدين اول", civil_id="111111111111", department=self.dep_a)
        debtor_b = Debtor.objects.create(full_name="مدين ثاني", civil_id="222222222222", department=self.dep_b)

        self.dist_a = Distribution.objects.create(
            debtor=debtor_a,
            department=self.dep_a,
            distribution_type="cash",
            deposit_or_sale_date=date(2026, 2, 1),
            proceed_amount=Decimal("1000.000"),
            machine_number="123456780",
            distribution_date=date(2026, 2, 2),
            list_type="temporary",
        )

        self.dist_b = Distribution.objects.create(
            debtor=debtor_b,
            department=self.dep_b,
            distribution_type="cash",
            deposit_or_sale_date=date(2026, 2, 3),
            proceed_amount=Decimal("2000.000"),
            machine_number="223456780",
            distribution_date=date(2026, 2, 4),
            list_type="final",
        )

    def test_non_admin_list_is_department_scoped(self):
        self.client.force_authenticate(user=self.officer_a)

        response = self.client.get(reverse("distribution-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 1)
        self.assertEqual(response.data[0]["id"], self.dist_a.id)

    def test_admin_list_sees_all_departments(self):
        self.client.force_authenticate(user=self.admin)

        response = self.client.get(reverse("distribution-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_non_admin_cannot_retrieve_other_department_distribution(self):
        self.client.force_authenticate(user=self.officer_a)

        response = self.client.get(reverse("distribution-detail", kwargs={"pk": self.dist_b.id}))

        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_non_admin_with_search_permission_can_list_all_departments(self):
        self.officer_a.permission_search_outside_department = True
        self.officer_a.save(update_fields=["permission_search_outside_department"])
        self.client.force_authenticate(user=self.officer_a)

        response = self.client.get(reverse("distribution-list"))

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(len(response.data), 2)

    def test_revoke_edit_permission_blocks_distribution_update(self):
        self.officer_a.permission_edit_distribution = False
        self.officer_a.save(update_fields=["permission_edit_distribution"])
        self.client.force_authenticate(user=self.officer_a)

        response = self.client.patch(
            reverse("distribution-detail", kwargs={"pk": self.dist_a.id}),
            {"notes": "تعديل غير مسموح"},
            format="json",
        )

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_revoke_delete_permission_blocks_distribution_delete(self):
        self.officer_a.permission_delete_distribution = False
        self.officer_a.save(update_fields=["permission_delete_distribution"])
        self.client.force_authenticate(user=self.officer_a)

        response = self.client.delete(reverse("distribution-detail", kwargs={"pk": self.dist_a.id}))

        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_calculate_endpoint_returns_expected_amounts(self):
        self.client.force_authenticate(user=self.officer_a)
        payload = {
            "proceed_amount": "150.000",
            "creditors": [
                {"debt_amount": "100.000", "debt_rank": 1},
                {"debt_amount": "100.000", "debt_rank": 1},
                {"debt_amount": "100.000", "debt_rank": 2},
            ],
        }

        response = self.client.post(reverse("distribution-calculate"), payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data["creditors"][0]["distribution_amount"], "75.000")
        self.assertEqual(response.data["creditors"][1]["distribution_amount"], "75.000")
        self.assertEqual(response.data["creditors"][2]["distribution_amount"], "0.000")

    def test_same_debtor_allows_different_proceed_amount(self):
        self.client.force_authenticate(user=self.officer_a)
        payload = {
            "debtor": self.dist_a.debtor_id,
            "department": self.dep_a.id,
            "distribution_type": "cash",
            "deposit_or_sale_date": "2026-02-10",
            "proceed_amount": "1200.000",
            "machine_number": "323456780",
            "distribution_date": "2026-02-11",
            "list_type": "temporary",
            "notes": "",
            "creditors": [
                {
                    "machine_number": "423456780",
                    "creditor_name": "دائن 1",
                    "attachment_date": "2026-02-01",
                    "attachment_type": "حجز",
                    "debt_amount": "300.000",
                    "debt_rank": 1,
                }
            ],
        }

        response = self.client.post(reverse("distribution-list"), payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_same_debtor_allows_same_proceed_with_different_deposit_date(self):
        self.client.force_authenticate(user=self.officer_a)
        payload = {
            "debtor": self.dist_a.debtor_id,
            "department": self.dep_a.id,
            "distribution_type": "cash",
            "deposit_or_sale_date": "2026-02-10",
            "proceed_amount": "1000.000",
            "machine_number": "423456780",
            "distribution_date": "2026-02-11",
            "list_type": "temporary",
            "notes": "",
            "creditors": [
                {
                    "machine_number": "523456780",
                    "creditor_name": "دائن 1",
                    "attachment_date": "2026-02-01",
                    "attachment_type": "حجز",
                    "debt_amount": "300.000",
                    "debt_rank": 1,
                }
            ],
        }

        response = self.client.post(reverse("distribution-list"), payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_same_debtor_rejects_same_proceed_and_same_deposit_date(self):
        self.client.force_authenticate(user=self.officer_a)
        payload = {
            "debtor": self.dist_a.debtor_id,
            "department": self.dep_a.id,
            "distribution_type": "cash",
            "deposit_or_sale_date": "2026-02-01",
            "proceed_amount": "1000.000",
            "machine_number": "523456780",
            "distribution_date": "2026-02-11",
            "list_type": "temporary",
            "notes": "",
            "creditors": [
                {
                    "machine_number": "623456780",
                    "creditor_name": "دائن 1",
                    "attachment_date": "2026-02-01",
                    "attachment_type": "حجز",
                    "debt_amount": "300.000",
                    "debt_rank": 1,
                }
            ],
        }

        response = self.client.post(reverse("distribution-list"), payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn("non_field_errors", response.data)

    def test_same_department_allows_duplicate_machine_number(self):
        self.client.force_authenticate(user=self.officer_a)
        payload = {
            "debtor": self.dist_a.debtor_id,
            "department": self.dep_a.id,
            "distribution_type": "cash",
            "deposit_or_sale_date": "2026-02-12",
            "proceed_amount": "800.000",
            "machine_number": self.dist_a.machine_number,
            "distribution_date": "2026-02-13",
            "list_type": "temporary",
            "notes": "",
            "creditors": [
                {
                    "machine_number": "723456780",
                    "creditor_name": "دائن 1",
                    "attachment_date": "2026-02-01",
                    "attachment_type": "حجز",
                    "debt_amount": "300.000",
                    "debt_rank": 1,
                }
            ],
        }

        response = self.client.post(reverse("distribution-list"), payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_allows_duplicate_debtor_civil_id(self):
        self.client.force_authenticate(user=self.officer_a)
        payload = {
            "full_name": "مدين مطابق",
            "civil_id": "111111111111",
            "department": self.dep_a.id,
        }

        response = self.client.post(reverse("debtor-list"), payload, format="json")

        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

    def test_serial_number_resequences_after_delete(self):
        self.client.force_authenticate(user=self.officer_a)
        debtor = Debtor.objects.create(full_name="مدين ثالث", civil_id="333333333333", department=self.dep_a)
        dist3 = Distribution.objects.create(
            debtor=debtor,
            department=self.dep_a,
            distribution_type="cash",
            deposit_or_sale_date=date(2026, 2, 5),
            proceed_amount=Decimal("1500.000"),
            machine_number="323456780",
            distribution_date=date(2026, 2, 6),
            list_type="temporary",
        )

        self.dist_a.delete()

        self.dist_b.refresh_from_db()
        dist3.refresh_from_db()
        self.assertEqual(self.dist_b.serial_number, 1)
        self.assertEqual(dist3.serial_number, 2)
