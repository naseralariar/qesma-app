from django.http import FileResponse
from django.utils import timezone
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView

from apps.core.models import AuditLog
from apps.distributions.models import Distribution

from .pdf_service import build_attendance_notices, build_distribution_pdf, build_session_minutes_pdf
from .serializers import AttendanceNoticeSerializer, SessionMinutesSerializer


class DistributionPrintView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = "sensitive"

    def get(self, request, distribution_id):
        distribution = Distribution.objects.prefetch_related("creditors").select_related("debtor").get(pk=distribution_id)
        if request.user.role != "admin" and distribution.department_id != request.user.department_id:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        pdf = build_distribution_pdf(distribution)
        AuditLog.objects.create(
            user=request.user,
            action="PRINT",
            model_name="Distribution",
            object_id=str(distribution.id),
            details={"mode": "distribution_print"},
        )
        return FileResponse(pdf, as_attachment=False, filename=f"distribution_{distribution.id}.pdf", content_type="application/pdf")


class AttendanceNoticeView(APIView):
    permission_classes = [IsAuthenticated]
    throttle_scope = "sensitive"

    def post(self, request):
        serializer = AttendanceNoticeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        distribution = Distribution.objects.prefetch_related("creditors").select_related("debtor").get(
            pk=serializer.validated_data["distribution_id"]
        )
        if request.user.role != "admin" and distribution.department_id != request.user.department_id:
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)
        if not request.user.is_attendance_location_allowed(serializer.validated_data["location"]):
            return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        pdf = build_attendance_notices(distribution, serializer.validated_data)
        return FileResponse(pdf, as_attachment=False, filename="attendance_notices.pdf", content_type="application/pdf")


class SessionMinutesView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        metadata = {
            "machine_number": "-",
        }
        pdf = build_session_minutes_pdf(metadata=metadata)
        return FileResponse(pdf, as_attachment=False, filename="session_minutes.pdf", content_type="application/pdf")

    def post(self, request):
        serializer = SessionMinutesSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        distribution = None
        distribution_id = serializer.validated_data.get("distribution_id")
        if distribution_id:
            distribution = Distribution.objects.select_related("debtor", "department").get(pk=distribution_id)
            if request.user.role != "admin" and distribution.department_id != request.user.department_id:
                return Response({"detail": "Forbidden"}, status=status.HTTP_403_FORBIDDEN)

        officer_name = (
            f"{getattr(request.user, 'first_name', '')} {getattr(request.user, 'last_name', '')}".strip()
            or getattr(request.user, "username", "-")
        )

        metadata = {
            "machine_number": getattr(distribution, "machine_number", "-") if distribution else "-",
        }
        pdf = build_session_minutes_pdf(
            page1_body=serializer.validated_data.get("page1_body", ""),
            page2_body=serializer.validated_data.get("page2_body", ""),
            metadata=metadata,
            distribution=distribution,
            officer_name=officer_name,
            chairperson_name=serializer.validated_data.get("chairperson_name", ""),
        )
        return FileResponse(pdf, as_attachment=False, filename="session_minutes_custom.pdf", content_type="application/pdf")
