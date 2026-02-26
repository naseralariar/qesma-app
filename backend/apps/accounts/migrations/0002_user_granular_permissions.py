from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0001_initial"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="attendance_allow_all_locations",
            field=models.BooleanField(default=True),
        ),
        migrations.AddField(
            model_name="user",
            name="attendance_allowed_locations",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="user",
            name="permission_delete_distribution",
            field=models.BooleanField(default=None, null=True),
        ),
        migrations.AddField(
            model_name="user",
            name="permission_edit_distribution",
            field=models.BooleanField(default=None, null=True),
        ),
        migrations.AddField(
            model_name="user",
            name="permission_search_outside_department",
            field=models.BooleanField(default=False),
        ),
    ]
