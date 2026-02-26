import django.core.validators
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("distributions", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="debtor",
            name="civil_id",
            field=models.CharField(max_length=12, validators=[django.core.validators.RegexValidator(r"^\d{12}$")]),
        ),
        migrations.RemoveConstraint(
            model_name="distribution",
            name="uniq_machine_per_department",
        ),
    ]
