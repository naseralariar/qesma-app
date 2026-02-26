from django.core.management.base import BaseCommand

from apps.accounts.models import Department


DEPARTMENTS = [
    ("EXE-01", "إدارة تنفيذ العاصمة"),
    ("EXE-02", "إدارة تنفيذ حولي"),
    ("EXE-03", "إدارة تنفيذ الفروانية"),
    ("EXE-04", "إدارة تنفيذ الجهراء"),
    ("EXE-05", "إدارة تنفيذ الأحمدي"),
    ("EXE-06", "إدارة تنفيذ مبارك الكبير"),
    ("EXE-07", "إدارة تنفيذ الأسرة حولي"),
    ("EXE-08", "إدارة تنفيذ الأسرة الأحمدي"),
    ("EXE-09", "إدارة تنفيذ الأسرة الجهراء"),
    ("EXE-10", "إدارة تنفيذ الأسرة الفروانية"),
    ("EXE-11", "إدارة تنفيذ الأحوال التجارية"),
    ("EXE-12", "إدارة تنفيذ القضايا المدنية"),
]


class Command(BaseCommand):
    help = "Seed fixed 12 departments for execution administrations"

    def handle(self, *args, **options):
        created = 0
        updated = 0
        for code, name in DEPARTMENTS:
            obj, is_created = Department.objects.update_or_create(
                code=code,
                defaults={"name": name, "is_active": True},
            )
            if is_created:
                created += 1
            else:
                updated += 1
        self.stdout.write(self.style.SUCCESS(f"Departments seeded. created={created}, updated={updated}"))
