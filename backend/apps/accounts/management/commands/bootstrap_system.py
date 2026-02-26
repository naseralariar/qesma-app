from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Bootstrap departments and initial admin in one command"

    def add_arguments(self, parser):
        parser.add_argument("--username", default="admin")
        parser.add_argument("--password", default="ChangeMe@123")
        parser.add_argument("--department-code", default="EXE-01")

    def handle(self, *args, **options):
        call_command("seed_departments")
        call_command(
            "ensure_admin",
            username=options["username"],
            password=options["password"],
            department_code=options["department_code"],
        )
        self.stdout.write(self.style.SUCCESS("System bootstrap completed."))
