from django.contrib.auth.models import AbstractUser
from django.db import models

from apps.accounts.constants import SIDEBAR_ITEM_KEYS, default_hidden_sidebar_items_for_role
from apps.core.constants import ATTENDANCE_LOCATIONS


class Department(models.Model):
    code = models.CharField(max_length=10, unique=True)
    name = models.CharField(max_length=100, unique=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class User(AbstractUser):
    ROLE_CHOICES = (
        ("admin", "Admin"),
        ("manager", "Manager"),
        ("officer", "Officer"),
        ("viewer", "Viewer"),
    )

    department = models.ForeignKey(Department, on_delete=models.PROTECT, null=True, blank=True, related_name="users")
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default="viewer")
    permission_edit_distribution = models.BooleanField(null=True, default=None)
    permission_delete_distribution = models.BooleanField(null=True, default=None)
    permission_search_outside_department = models.BooleanField(default=False)
    attendance_allow_all_locations = models.BooleanField(default=True)
    attendance_allowed_locations = models.JSONField(default=list, blank=True)
    sidebar_hidden_items = models.JSONField(default=list, blank=True)

    @property
    def can_edit(self):
        return self.can_edit_distribution

    @property
    def can_delete(self):
        return self.can_delete_distribution

    @property
    def can_edit_distribution(self):
        if self.permission_edit_distribution is not None:
            return self.permission_edit_distribution
        return self.role in {"admin", "manager", "officer"}

    @property
    def can_delete_distribution(self):
        if self.permission_delete_distribution is not None:
            return self.permission_delete_distribution
        return self.role in {"admin", "manager"}

    @property
    def can_search_outside_department(self):
        return self.role == "admin" or self.permission_search_outside_department

    def get_allowed_attendance_locations(self):
        if self.role == "admin" or self.attendance_allow_all_locations:
            return ATTENDANCE_LOCATIONS
        return [location for location in self.attendance_allowed_locations if location in ATTENDANCE_LOCATIONS]

    def is_attendance_location_allowed(self, location):
        return location in self.get_allowed_attendance_locations()

    def get_effective_sidebar_hidden_items(self):
        selected_items = self.sidebar_hidden_items or default_hidden_sidebar_items_for_role(self.role)
        return [item for item in selected_items if item in SIDEBAR_ITEM_KEYS]
