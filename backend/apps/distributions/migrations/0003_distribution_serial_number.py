from django.db import migrations, models


def populate_serial_numbers(apps, schema_editor):
    Distribution = apps.get_model("distributions", "Distribution")
    rows = Distribution.objects.order_by("created_at", "id")
    for index, row in enumerate(rows, start=1):
        row.serial_number = index
        row.save(update_fields=["serial_number"])


class Migration(migrations.Migration):

    dependencies = [
        ("distributions", "0002_remove_uniqueness_constraints"),
    ]

    operations = [
        migrations.AddField(
            model_name="distribution",
            name="serial_number",
            field=models.PositiveIntegerField(db_index=True, null=True),
        ),
        migrations.RunPython(populate_serial_numbers, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="distribution",
            name="serial_number",
            field=models.PositiveIntegerField(db_index=True, unique=True),
        ),
    ]
