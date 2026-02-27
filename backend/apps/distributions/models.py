from decimal import Decimal

from django.core.validators import MinValueValidator, RegexValidator
from django.db import models
from django.db.models import Max

from apps.accounts.models import Department


class Debtor(models.Model):
    full_name = models.CharField(max_length=40)
    civil_id = models.CharField(max_length=12, validators=[RegexValidator(r"^\d{12}$")])
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="debtors")

    class Meta:
        indexes = [models.Index(fields=["civil_id"]), models.Index(fields=["full_name"])]

    def __str__(self):
        return f"{self.full_name} - {self.civil_id}"


class Distribution(models.Model):
    DISTRIBUTION_TYPES = (
        ("cars", "سيارات"),
        ("banks", "بنوك"),
        ("real_estate", "عقار"),
        ("cash", "مبلغ مالي"),
    )
    LIST_TYPES = (("temporary", "مؤقتة"), ("final", "نهائية"))

    debtor = models.ForeignKey(Debtor, on_delete=models.PROTECT, related_name="distributions")
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="distributions")
    distribution_type = models.CharField(max_length=20, choices=DISTRIBUTION_TYPES)
    deposit_or_sale_date = models.DateField()
    proceed_amount = models.DecimalField(max_digits=16, decimal_places=3, validators=[MinValueValidator(Decimal("0.001"))])
    machine_number = models.CharField(max_length=9, validators=[RegexValidator(r"^\d{8}0$")])
    distribution_date = models.DateField()
    list_type = models.CharField(max_length=10, choices=LIST_TYPES)
    notes = models.TextField(blank=True)
    serial_number = models.PositiveIntegerField(unique=True, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        indexes = [
            models.Index(fields=["machine_number"]),
            models.Index(fields=["distribution_date"]),
            models.Index(fields=["department", "list_type"]),
        ]

    def save(self, *args, **kwargs):
        if self._state.adding and not self.serial_number:
            max_serial = Distribution.objects.aggregate(max_serial=Max("serial_number"))["max_serial"] or 0
            self.serial_number = max_serial + 1
        super().save(*args, **kwargs)

    def delete(self, *args, **kwargs):
        result = super().delete(*args, **kwargs)
        Distribution.resequence_serial_numbers()
        return result

    @classmethod
    def resequence_serial_numbers(cls):
        rows = list(cls.objects.order_by("created_at", "id"))
        changed = []
        for index, row in enumerate(rows, start=1):
            if row.serial_number != index:
                row.serial_number = index
                changed.append(row)
        if changed:
            cls.objects.bulk_update(changed, ["serial_number"])


class Creditor(models.Model):
    RANK_CHOICES = (
        (1, "ممتاز"),
        (2, "رهن"),
        (3, "نفقة"),
        (4, "عمالي"),
        (5, "حجز قبل البيع"),
        (6, "حجز بعد البيع"),
        (7, "عادي"),
    )

    distribution = models.ForeignKey(Distribution, on_delete=models.CASCADE, related_name="creditors")
    machine_number = models.CharField(max_length=9, validators=[RegexValidator(r"^\d{8}0$")])
    creditor_name = models.CharField(max_length=100)
    attachment_date = models.DateField()
    attachment_type = models.CharField(max_length=80)
    debt_amount = models.DecimalField(max_digits=16, decimal_places=3, validators=[MinValueValidator(Decimal("0.001"))])
    debt_rank = models.PositiveSmallIntegerField(choices=RANK_CHOICES)
    distribution_amount = models.DecimalField(max_digits=16, decimal_places=3, default=Decimal("0.000"))

    class Meta:
        ordering = ["id"]
        indexes = [models.Index(fields=["machine_number"]), models.Index(fields=["creditor_name"])]
