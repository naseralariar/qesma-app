from django.db import models

from apps.accounts.models import Department
from apps.distributions.models import Distribution


class Notification(models.Model):
    distribution = models.ForeignKey(Distribution, on_delete=models.CASCADE, related_name="notifications")
    department = models.ForeignKey(Department, on_delete=models.PROTECT, related_name="notifications")
    attendance_date = models.DateField()
    attendance_time = models.TimeField()
    location = models.CharField(max_length=120)
    floor = models.CharField(max_length=20)
    room_number = models.CharField(max_length=20)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        indexes = [models.Index(fields=["attendance_date"]), models.Index(fields=["department"])]
