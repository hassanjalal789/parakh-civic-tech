"""API-003, API-004, API-128, API-155 — sessions and the citizen profile."""
from parakh.audit.models import AuditEvent
from parakh.authentication.models import AuthSession

from .base import NUMBER, AuthTestCase


class SessionTests(AuthTestCase):
    def test_protected_routes_require_a_session(self):
        for method, path in [("get", "/citizen/profile"), ("post", "/auth/logout"), ("get", "/auth/sessions")]:
            response = getattr(self.api, method)(path)
            self.assertEqual(response.status_code, 401, path)
            self.assertEqual(response.json()["error"]["code"], "E_UNAUTHENTICATED")
            self.assertEqual(response["WWW-Authenticate"], "Bearer")

    def test_garbage_or_wrong_scheme_token_is_rejected(self):
        for header in ["Bearer not-a-token", "Basic abc", "Bearer"]:
            self.api.credentials(HTTP_AUTHORIZATION=header)
            self.assertEqual(self.api.get("/citizen/profile").status_code, 401, header)

    def test_profile_shows_only_the_own_masked_number(self):  # TEST-AUTH-C10
        tokens = self.sign_up(NUMBER, sms=True)
        self.bearer(tokens["access_token"])
        response = self.api.get("/citizen/profile")
        self.assertEqual(response.status_code, 200)
        body = response.json()
        self.assertEqual(body["masked_mobile_number"], "+92 300 *** 4567")
        self.assertNotIn("3001234567", response.content.decode())
        self.assertEqual(body["preferred_language"], "ur")
        self.assertTrue(body["consents"]["sms_notification"]["granted"])

    def test_access_token_expires(self):
        tokens = self.sign_up(NUMBER)
        self.bearer(tokens["access_token"])
        self.advance(901)
        self.assertEqual(self.api.get("/citizen/profile").status_code, 401)

    def test_refresh_rotates_both_tokens(self):
        tokens = self.sign_up(NUMBER)
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['refresh_token']}")
        response = self.api.post("/auth/refresh")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response["Cache-Control"], "no-store")
        rotated = response.json()
        self.assertNotEqual(rotated["refresh_token"], tokens["refresh_token"])
        self.bearer(tokens["access_token"])
        self.assertEqual(self.api.get("/citizen/profile").status_code, 401)  # old access token replaced
        self.bearer(rotated["access_token"])
        self.assertEqual(self.api.get("/citizen/profile").status_code, 200)

    def test_refresh_token_replay_revokes_the_whole_family(self):  # NFR-50
        tokens = self.sign_up(NUMBER)
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['refresh_token']}")
        rotated = self.api.post("/auth/refresh").json()
        replay = self.api.post("/auth/refresh")  # the already rotated token again
        self.assertEqual(replay.status_code, 401)
        self.assertEqual(replay.json()["error"]["code"], "E_REFRESH_INVALID")
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {rotated['refresh_token']}")
        self.assertEqual(self.api.post("/auth/refresh").status_code, 401)
        self.bearer(rotated["access_token"])
        self.assertEqual(self.api.get("/citizen/profile").status_code, 401)
        self.assertEqual(AuthSession.objects.get().revocation_reason, "refresh_replay")
        self.assertTrue(AuditEvent.objects.filter(action="refresh_replay_detected").exists())

    def test_access_token_is_not_a_refresh_token(self):
        tokens = self.sign_up(NUMBER)
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['access_token']}")
        self.assertEqual(self.api.post("/auth/refresh").status_code, 401)

    def test_logout_revokes_the_session_on_the_server(self):
        tokens = self.sign_up(NUMBER)
        self.bearer(tokens["access_token"])
        self.assertEqual(self.api.post("/auth/logout").status_code, 204)
        self.assertEqual(self.api.get("/citizen/profile").status_code, 401)
        self.api.credentials(HTTP_AUTHORIZATION=f"Bearer {tokens['refresh_token']}")
        self.assertEqual(self.api.post("/auth/refresh").status_code, 401)

    def test_list_sessions_and_sign_out_everywhere(self):
        first = self.sign_up(NUMBER)
        self.advance(61)
        second = self.sign_up(NUMBER)
        self.bearer(second["access_token"])
        sessions = self.api.get("/auth/sessions").json()["sessions"]
        self.assertEqual(len(sessions), 2)
        self.assertEqual([s["current"] for s in sessions], [True, False])
        self.assertEqual(self.api.delete("/auth/sessions").status_code, 204)
        for tokens in (first, second):
            self.bearer(tokens["access_token"])
            self.assertEqual(self.api.get("/citizen/profile").status_code, 401)

    def test_end_one_other_session(self):
        first = self.sign_up(NUMBER)
        self.advance(61)
        second = self.sign_up(NUMBER)
        self.bearer(second["access_token"])
        other = [s for s in self.api.get("/auth/sessions").json()["sessions"] if not s["current"]][0]
        self.assertEqual(self.api.delete("/auth/sessions", {"session_id": other["session_id"]}, format="json").status_code, 204)
        self.assertEqual(self.api.get("/citizen/profile").status_code, 200)
        self.bearer(first["access_token"])
        self.assertEqual(self.api.get("/citizen/profile").status_code, 401)

    def test_cannot_end_a_session_that_is_not_yours(self):
        mine = self.sign_up(NUMBER)
        self.advance(61)
        theirs = self.sign_up("03119876543")
        their_session = AuthSession.objects.order_by("-issued_at").first()
        self.bearer(mine["access_token"])
        response = self.api.delete("/auth/sessions", {"session_id": str(their_session.id)}, format="json")
        self.assertEqual(response.status_code, 404)
        self.bearer(theirs["access_token"])
        self.assertEqual(self.api.get("/citizen/profile").status_code, 200)
