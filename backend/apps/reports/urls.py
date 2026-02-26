from django.urls import path

from .views import AttendanceNoticeView, DistributionPrintView, SessionMinutesView

urlpatterns = [
    path("reports/distributions/<int:distribution_id>/print/", DistributionPrintView.as_view(), name="distribution-print"),
    path("reports/attendance-notices/", AttendanceNoticeView.as_view(), name="attendance-notices"),
    path("reports/session-minutes/", SessionMinutesView.as_view(), name="session-minutes"),
]
