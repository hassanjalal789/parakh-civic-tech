"""Purges abandoned temporary processing data (DG-55; the inactivity period is DG-57, proposed).

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
