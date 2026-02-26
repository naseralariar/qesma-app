from decimal import Decimal

from rest_framework import serializers

from apps.accounts.serializers import DepartmentSerializer

from .models import Creditor, Debtor, Distribution
from .services import distribute_proceeds


class DebtorSerializer(serializers.ModelSerializer):
    class Meta:
        model = Debtor
        fields = ["id", "full_name", "civil_id", "department"]

    def validate_full_name(self, value):
        if any(ch.isdigit() for ch in value):
            raise serializers.ValidationError("اسم المدين لا يقبل أرقام")
        return value


class CreditorSerializer(serializers.ModelSerializer):
    debt_rank_label = serializers.CharField(source="get_debt_rank_display", read_only=True)

    class Meta:
        model = Creditor
        fields = [
            "id",
            "machine_number",
            "creditor_name",
            "attachment_date",
            "attachment_type",
            "debt_amount",
            "debt_rank",
            "debt_rank_label",
            "distribution_amount",
        ]


class DistributionSerializer(serializers.ModelSerializer):
    creditors = CreditorSerializer(many=True)
    debtor_data = DebtorSerializer(source="debtor", read_only=True)
    department_data = DepartmentSerializer(source="department", read_only=True)

    class Meta:
        model = Distribution
        fields = [
            "id",
            "serial_number",
            "debtor",
            "debtor_data",
            "department",
            "department_data",
            "distribution_type",
            "deposit_or_sale_date",
            "proceed_amount",
            "machine_number",
            "distribution_date",
            "list_type",
            "notes",
            "creditors",
            "created_at",
            "updated_at",
        ]
        extra_kwargs = {
            "serial_number": {"read_only": True},
        }

    def validate(self, attrs):
        debtor = attrs.get("debtor") or getattr(self.instance, "debtor", None)
        proceed_amount = attrs.get("proceed_amount")
        deposit_or_sale_date = attrs.get("deposit_or_sale_date")

        if self.instance is not None:
            if proceed_amount is None:
                proceed_amount = self.instance.proceed_amount
            if deposit_or_sale_date is None:
                deposit_or_sale_date = self.instance.deposit_or_sale_date

        if debtor is None or proceed_amount is None or deposit_or_sale_date is None:
            return attrs

        existing = Distribution.objects.filter(
            debtor__civil_id=debtor.civil_id,
            proceed_amount=proceed_amount,
            deposit_or_sale_date=deposit_or_sale_date,
        )
        if self.instance is not None:
            existing = existing.exclude(pk=self.instance.pk)

        if existing.exists():
            raise serializers.ValidationError("هذه القسمة مدخلة مسبقا")

        return attrs

    def create(self, validated_data):
        creditors_data = validated_data.pop("creditors", [])
        distribution = Distribution.objects.create(**validated_data)
        creditor_rows = []
        algo_input = []
        for row in creditors_data:
            row["distribution"] = distribution
            creditor_rows.append(Creditor(**row))
            algo_input.append({"debt_amount": Decimal(row["debt_amount"]), "debt_rank": row["debt_rank"]})

        Creditor.objects.bulk_create(creditor_rows)
        self._recalculate(distribution)
        return distribution

    def update(self, instance, validated_data):
        creditors_data = validated_data.pop("creditors", None)
        for key, value in validated_data.items():
            setattr(instance, key, value)
        instance.save()

        if creditors_data is not None:
            instance.creditors.all().delete()
            Creditor.objects.bulk_create([Creditor(distribution=instance, **row) for row in creditors_data])
        self._recalculate(instance)
        return instance

    @staticmethod
    def _recalculate(distribution):
        creditors = list(distribution.creditors.all())
        mapped = [{"id": c.id, "debt_amount": c.debt_amount, "debt_rank": c.debt_rank} for c in creditors]
        result = distribute_proceeds(distribution.proceed_amount, mapped)
        dist_map = {row["id"]: row["distribution_amount"] for row in result}
        for creditor in creditors:
            creditor.distribution_amount = dist_map.get(creditor.id, Decimal("0.000"))
        Creditor.objects.bulk_update(creditors, ["distribution_amount"])
