"""Exercise provisioning without Docker, internet access or real credentials."""
import importlib.util
import json
from pathlib import Path
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from threading import Thread
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("analytics_setup", Path(__file__).with_name("setup.py"))
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)


class Provisioning(unittest.TestCase):
    def test_database_secret_is_not_a_process_argument(self):
        password = "b" * 64
        with patch.object(setup.subprocess, "run") as run:
            setup.provision_host_database({"POSTGRES_PASSWORD": password})
        arguments, options = run.call_args
        self.assertNotIn(password, str(arguments))
        self.assertIn("parus_umami", options["input"])
        self.assertNotIn("django", options["input"])
        self.assertTrue(options["check"])

    def test_private_idempotent_environment(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            first = setup.prepare(directory)
            path = directory / ".env"
            original = path.read_bytes()
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
            self.assertEqual(len(set(first.values())), len(setup.ENV_KEYS))
            path.chmod(0o644)
            self.assertEqual(setup.prepare(directory), first)
            self.assertEqual(path.read_bytes(), original)
            self.assertEqual(path.stat().st_mode & 0o777, 0o600)
            path.write_text("POSTGRES_PASSWORD=placeholder\n")
            with self.assertRaises(ValueError):
                setup.prepare(directory)

    def test_bootstrap_rotation_registration_and_rerun(self):
        state = {"password": "umami", "website": None, "rotations": 0, "registrations": 0, "null_missing": True}

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_):
                pass

            def respond(self, code, payload):
                self.send_response(code)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(payload).encode())

            def do_POST(self):
                body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
                if self.path == "/api/auth/login":
                    return self.respond(200, {"token": state["password"]}) if body["password"] == state["password"] else self.respond(401, {})
                if self.headers.get("Authorization") != "Bearer " + state["password"]:
                    return self.respond(401, {})
                if self.path == "/api/me/password":
                    if body["currentPassword"] != state["password"]:
                        return self.respond(400, {})
                    state["password"] = body["newPassword"]
                    state["rotations"] += 1
                    return self.respond(200, {"token": state["password"]})
                if self.path == "/api/websites":
                    if state["website"]:
                        return self.respond(400, {})
                    state["website"] = body
                    state["registrations"] += 1
                    return self.respond(200, body)
                self.respond(404, {})

            def do_GET(self):
                if self.headers.get("Authorization") != "Bearer " + state["password"]:
                    return self.respond(401, {})
                if self.path == "/api/websites/" + setup.WEBSITE_ID and state["website"]:
                    return self.respond(200, state["website"])
                self.respond(200, None) if state["null_missing"] else self.respond(404, {})

        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        thread = Thread(target=server.serve_forever, daemon=True)
        thread.start()
        original_api = setup.API
        setup.API = f"http://127.0.0.1:{server.server_port}"
        try:
            setup.initialize("private-test-password")
            setup.initialize("private-test-password")
            self.assertEqual(state["rotations"], 1)
            self.assertEqual(state["registrations"], 1)
            self.assertEqual(state["website"]["id"], setup.WEBSITE_ID)
            self.assertEqual(state["website"]["domain"], setup.DOMAIN)
            state["website"] = None
            state["null_missing"] = False
            setup.initialize("private-test-password")
            self.assertEqual(state["registrations"], 2, "both JSON null and HTTP 404 create a missing website")
        finally:
            setup.API = original_api
            server.shutdown()
            server.server_close()
            thread.join()


if __name__ == "__main__":
    unittest.main()
