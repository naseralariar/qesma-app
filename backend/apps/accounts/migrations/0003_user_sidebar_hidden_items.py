from django.db import migrations, models


def seed_sidebar_hidden_defaults(apps, schema_editor):
    User = apps.get_model("accounts", "User")
    User.objects.filter(role__in=["officer", "viewer"], sidebar_hidden_items=[]).update(sidebar_hidden_items=["dashboard"])


class Migration(migrations.Migration):

    dependencies = [
        ("accounts", "0002_user_granular_permissions"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="sidebar_hidden_items",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.RunPython(seed_sidebar_hidden_defaults, migrations.RunPython.noop),
    ]
