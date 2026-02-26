from decimal import Decimal

from django.db.models import Count, DecimalField, Sum
from django.db.models.functions import Coalesce
from rest_framework import decorators, response, status, viewsets
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated

from apps.accounts.permissions import RolePermission
from apps.core.models import AuditLog

from .models import Debtor, Distribution
from .services import distribute_proceeds
from .serializers import DebtorSerializer, DistributionSerializer


class DepartmentScopedMixin:
    def filter_by_department(self, queryset):
        user = self.request.user
        if user.can_search_outside_department:
            return queryset
        return queryset.filter(department=user.department)


class DebtorViewSet(DepartmentScopedMixin, viewsets.ModelViewSet):
    queryset = Debtor.objects.select_related("department").all()
    serializer_class = DebtorSerializer
    permission_classes = [IsAuthenticated, RolePermission]
    search_fields = ["full_name", "civil_id"]

    def get_queryset(self):
        return self.filter_by_department(super().get_queryset())


class DistributionViewSet(DepartmentScopedMixin, viewsets.ModelViewSet):
    queryset = Distribution.objects.select_related("department", "debtor").prefetch_related("creditors")
    serializer_class = DistributionSerializer
    permission_classes = [IsAuthenticated, RolePermission]
    search_fields = ["debtor__full_name", "debtor__civil_id", "machine_number"]
    filterset_fields = ["department", "list_type", "distribution_type", "machine_number", "debtor__civil_id"]

    def get_queryset(self):
        return self.filter_by_department(super().get_queryset())

    def perform_create(self, serializer):
        distribution = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            action="CREATE",
            model_name="Distribution",
            object_id=str(distribution.id),
            details={"machine_number": distribution.machine_number},
        )

    def perform_update(self, serializer):
        if not self.request.user.can_edit_distribution:
            raise PermissionDenied("لا تملك صلاحية تعديل القسمة")
        distribution = serializer.save()
        AuditLog.objects.create(
            user=self.request.user,
            action="UPDATE",
            model_name="Distribution",
            object_id=str(distribution.id),
            details={"machine_number": distribution.machine_number},
        )

    def perform_destroy(self, instance):
        if not self.request.user.can_delete_distribution:
            raise PermissionDenied("لا تملك صلاحية حذف القسمة")
        AuditLog.objects.create(
            user=self.request.user,
            action="DELETE",
            model_name="Distribution",
            object_id=str(instance.id),
            details={"machine_number": instance.machine_number},
        )
        instance.delete()

    @decorators.action(detail=False, methods=["get"])
    def dashboard(self, request):
        qs = self.get_queryset()
        total_amount = qs.aggregate(
            total=Coalesce(Sum("proceed_amount"), Decimal("0.000"), output_field=DecimalField(max_digits=16, decimal_places=3))
        )["total"]
        by_department = list(
            qs.values("department__id", "department__name")
            .annotate(
                total_distributions=Count("id"),
                total_proceeds=Coalesce(
                    Sum("proceed_amount"),
                    Decimal("0.000"),
                    output_field=DecimalField(max_digits=16, decimal_places=3),
                ),
            )
            .order_by("department__name")
        )
        payload = {
            "total_distributions": qs.count(),
            "temporary_count": qs.filter(list_type="temporary").count(),
            "final_count": qs.filter(list_type="final").count(),
            "total_distributed_amount": total_amount,
            "by_department": by_department,
        }
        return response.Response(payload)

    @decorators.action(detail=True, methods=["post"])
    def recalculate(self, request, pk=None):
        distribution = self.get_object()
        DistributionSerializer._recalculate(distribution)
        return response.Response(self.get_serializer(distribution).data)

    @decorators.action(detail=False, methods=["post"])
    def calculate(self, request):
        proceed_amount = request.data.get("proceed_amount")
        creditors = request.data.get("creditors", [])

        if proceed_amount is None:
            return response.Response({"detail": "proceed_amount is required"}, status=status.HTTP_400_BAD_REQUEST)

        try:
            total = Decimal(str(proceed_amount))
        except Exception:
            return response.Response({"detail": "Invalid proceed_amount"}, status=status.HTTP_400_BAD_REQUEST)

        mapped = []
        for idx, row in enumerate(creditors):
            try:
                mapped.append(
                    {
                        "client_index": idx,
                        "debt_amount": Decimal(str(row.get("debt_amount", "0"))),
                        "debt_rank": int(row.get("debt_rank")),
                    }
                )
            except Exception:
                return response.Response({"detail": f"Invalid creditor row at index {idx}"}, status=status.HTTP_400_BAD_REQUEST)

        calculated = distribute_proceeds(total, mapped)
        return response.Response(
            {
                "proceed_amount": str(total),
                "creditors": [
                    {
                        "client_index": row["client_index"],
                        "debt_rank": row["debt_rank"],
                        "debt_amount": str(row["debt_amount"]),
                        "distribution_amount": str(row["distribution_amount"]),
                    }
                    for row in calculated
                ],
            }
        )
