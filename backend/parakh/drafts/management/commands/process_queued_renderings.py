"""Processes rendering versions that are queued and never started.

They arise when the R-007 migration re-queues renderings made before
2026-10-06, so they can be prepared again in Urdu and English. A device that
replays its manifest starts its own; this command starts the rest. A queue
worker replaces it with T-023.
"""
from django.core.management.base import BaseCommand

from parakh.drafts.models import VoiceTranscriptionArtifact
from parakh.drafts.services import submit_processing


class Command(BaseCommand):
    help = "Process rendering versions that are queued but never started."

    def handle(self, *args, **options):
        queued = VoiceTranscriptionArtifact.objects.filter(
            processing_status=VoiceTranscriptionArtifact.ProcessingStatus.QUEUED,
            processing_started_at__isnull=True,
            is_active_version=True,
            submission__resulting_report_id__isnull=True,
            submission__cancelled_at__isnull=True,
            submission__expired_at__isnull=True,
        ).values_list("id", flat=True)
        ids = list(queued)
        for artifact_id in ids:
            submit_processing(artifact_id)
        self.stdout.write(f"Processed {len(ids)} queued rendering version(s).")
