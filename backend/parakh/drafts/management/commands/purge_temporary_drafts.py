"""Purges abandoned temporary processing data (DG-55): 72 hours without activity (DG-57,
approved by Hassan Jalal on 2026-10-07). An upload still arriving or a job still running is
activity, so it is never purged. A submitted report and its sealed evidence are never touched.

Run periodically, for example hourly. A purged draft keeps a content-free row and an
audit event with counts; the device still holds its copy and can send it again.
"""
from django.core.management.base import BaseCommand

from parakh.drafts.services import purge_expired_drafts


class Command(BaseCommand):
    help = "Purge temporary draft data that has had no activity for PARAKH_TEMPORARY_DATA_TTL_HOURS"

    def handle(self, *args, **options):
        purged = purge_expired_drafts()
        self.stdout.write(f"Purged {purged} abandoned draft(s).")
