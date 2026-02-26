import os

from django.contrib.auth import get_user_model
from django.core.management.base import BaseCommand

from apps.accounts.models import Department


User = get_user_model()


class Command(BaseCommand):
    help = "Create or update initial system admin"

    def add_arguments(self, parser):
        parser.add_argument("--username", default=os.getenv("INITIAL_ADMIN_USERNAME", "admin"))
        parser.add_argument("--password", default=os.getenv("INITIAL_ADMIN_PASSWORD", "ChangeMe@123"))
        parser.add_argument("--department-code", default=os.getenv("INITIAL_ADMIN_DEPARTMENT", "EXE-01"))

    def handle(self, *args, **options):
        username = options["username"]
        password = options["password"]
        dep_code = options["department_code"]

        department, _ = Department.objects.get_or_create(
            code=dep_code,
            defaults={"name": "إدارة تنفيذ العاصمة", "is_active": True},
        )

        user, created = User.objects.get_or_create(
            username=username,
            defaults={
                "is_staff": True,
                "is_superuser": True,
                "is_active": True,
                "role": "admin",
                "department": department,
            },
        )

        if not created:
            user.is_staff = True
            user.is_superuser = True
            user.is_active = True
            user.role = "admin"
            user.department = department

        user.set_password(password)
        user.save()
        state = "created" if created else "updated"
        self.stdout.write(self.style.SUCCESS(f"Admin {state}: username={username}, department={department.code}"))
