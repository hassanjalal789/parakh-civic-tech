"""DG-73 (Hassan Jalal, 2026-10-11): a report keeps what the phone measured and the position the
reporter confirmed, or the reporter's written description; it always has one or the other.

Rows from before DG-73 are mapped as in drafts 0005: a `device` position is also the measured one.
"""
from django.db import migrations, models


def map_existing_rows(apps, schema_editor):
    CivicReport = apps.get_model("reports", "CivicReport")
    for report in CivicReport.objects.filter(location_source="device"):
        report.measured_latitude, report.measured_longitude = report.reported_latitude, report.reported_longitude
        report.save(update_fields=["measured_latitude", "measured_longitude"])


class Migration(migrations.Migration):

    dependencies = [
        ("reports", "0002_remove_civicreport_description_is_confirmed_rendering_or_typed_text_and_more"),
    ]

    operations = [
        migrations.RenameField("civicreport", "latitude", "reported_latitude"),
        migrations.RenameField("civicreport", "longitude", "reported_longitude"),
        migrations.RenameField("civicreport", "location_accuracy_m", "measured_accuracy_m"),
        migrations.AlterField(
            model_name="civicreport",
            name="reported_latitude",
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
        migrations.AlterField(
            model_name="civicreport",
            name="reported_longitude",
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
        migrations.AddField(
            model_name="civicreport",
            name="measured_latitude",
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
        migrations.AddField(
            model_name="civicreport",
            name="measured_longitude",
            field=models.DecimalField(blank=True, decimal_places=6, max_digits=9, null=True),
        ),
        migrations.AddField(
            model_name="civicreport",
            name="measured_fix",
            field=models.CharField(blank=True, default="", max_length=12),
        ),
        migrations.AddField(
            model_name="civicreport",
            name="measured_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="civicreport",
            name="location_description",
            field=models.TextField(blank=True, default=""),
        ),
        migrations.AlterField(
            model_name="civicreport",
            name="location_source",
            field=models.CharField(max_length=16),
        ),
        migrations.RunPython(map_existing_rows, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="civicreport",
            constraint=models.CheckConstraint(
                condition=models.Q(
                    models.Q(("reported_latitude__isnull", False), ("reported_longitude__isnull", False)),
                    models.Q(("location_description", ""), _negated=True),
                    _connector="OR",
                ),
                name="every_report_has_a_location",
            ),
        ),
    ]
