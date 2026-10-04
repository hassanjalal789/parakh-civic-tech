from django.test import TestCase

from .models import AuditEvent, record, verify_chain


class AuditChainTests(TestCase):
    def test_events_form_a_verifiable_chain(self):
        first = record("a", step=1)
        second = record("b", step=2)
        self.assertEqual(first.prev_hash, AuditEvent.GENESIS)
        self.assertEqual(second.prev_hash, first.hash)
        self.assertEqual(verify_chain(), (True, None))

    def test_tampering_behind_the_model_is_detected(self):
        record("a", step=1)
        middle = record("b", step=2)
        record("c", step=3)
        AuditEvent.objects.filter(sequence=middle.sequence).update(details={"step": 99})
        self.assertEqual(verify_chain(), (False, middle.sequence))

    def test_events_cannot_be_edited_or_deleted(self):
        event = record("a")
        event.action = "changed"
        with self.assertRaises(RuntimeError):
            event.save()
        with self.assertRaises(RuntimeError):
            event.delete()
