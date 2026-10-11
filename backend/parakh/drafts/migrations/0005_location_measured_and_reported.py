"""DG-73 (Hassan Jalal, 2026-10-11): the location keeps what the phone measured and what the reporter
confirms, or the reporter's written description when there are no coordinates.

`latitude`/`longitude` become the reported position and `location_accuracy_m` the measured accuracy.
Rows from before DG-73 are mapped without adding anything they did not record: a `device` position
was the phone's own, so it is also the measured one (its fix kind and time unknown); a `manual` one
is reported only; a purged row keeps no source.
"""
from django.db import migrations, models


def map_existing_rows(apps, schema_editor):
    ClientSubmission = apps.get_model("drafts", "ClientSubmission")
    for draft in ClientSubmission.objects.all():
        if draft.reported_latitude is None:
            draft.location_source = ""
        elif draft.location_source == "device":
            draft.measured_latitude, draft.measured_longitude = draft.reported_latitude, draft.reported_longitude
        draft.save(update_fields=["location_source", "measured_latitude", "measured_longitude"])


class Migration(migrations.Migration):

    dependencies = [
        ("drafts", "0004_regenerate_legacy_renderings"),
    ]

    operations = [
        migrations.RenameField("clientsubmission", "latitude", "reported_latitude"),
        migrations.RenameField("clientsubmission", "longitude", "reported_longitude"),
        migrations.RenameField("clientsubmission", "location_accuracy_m", "measured_accuracy_m"),
        migrations.AlterField(
            model_name="clientsubmission",
            name="reported_latitude",
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
        migrations.AlterField(
            model_name="clientsubmission",
            name="reported_longitude",
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
        migrations.AddField(
            model_name="clientsubmission",
            name="measured_latitude",
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
        migrations.AddField(
            model_name="clientsubmission",
            name="measured_longitude",
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
        migrations.AddField(
            model_name="clientsubmission",
            name="measured_fix",
            field=models.CharField(
                blank=True, choices=[("current", "Current"), ("last_known", "Last Known")], default="", max_length=12
            ),
        ),
        migrations.AddField(
            model_name="clientsubmission",
            name="measured_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="clientsubmission",
            name="location_description",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AlterField(
            model_name="clientsubmission",
            name="location_source",
            field=models.CharField(
                blank=True,
                choices=[
                    ("gps_current", "Gps Current"),
                    ("gps_last_known", "Gps Last Known"),
                    ("adjusted", "Adjusted"),
                    ("description", "Description"),
                    ("device", "Device"),
                    ("manual", "Manual"),
                ],
                max_length=16,
            ),
        ),
        migrations.RunPython(map_existing_rows, migrations.RunPython.noop),
    ]
