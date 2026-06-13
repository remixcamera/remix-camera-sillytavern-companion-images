import io
import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "adapters" / "rasa"))

from remix_camera_rasa_actions import run_remix_camera_rasa_tool  # noqa: E402


class MockResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def read(self):
        return json.dumps(self.payload).encode("utf-8")


class RasaActionTest(unittest.TestCase):
    def test_defaults_to_no_spend_dry_run_preview(self):
        calls = []

        def opener(request, timeout=30):
            calls.append(
                {
                    "url": request.full_url,
                    "body": json.loads(request.data.decode("utf-8")),
                    "timeout": timeout,
                }
            )
            return MockResponse(
                {
                    "ok": True,
                    "dryRun": True,
                    "promptTemplate": {"packTitle": "Excellent Lily Selfie"},
                    "prompt": "preview prompt",
                }
            )

        result = run_remix_camera_rasa_tool(
            {"command": "send-selfie", "prompt": "cozy couch", "characterName": "Lily"},
            bridge_url="http://bridge.local",
            opener=opener,
        )

        self.assertEqual(calls[0]["url"], "http://bridge.local/v1/tools/send-selfie/dry-run")
        self.assertNotIn("yes", calls[0]["body"])
        self.assertEqual(calls[0]["body"]["characterName"], "Lily")
        self.assertTrue(result["dryRun"])
        self.assertIn("Preview ready: Excellent Lily Selfie", result["text"])

    def test_refuses_generation_without_yes(self):
        with self.assertRaisesRegex(ValueError, "yes=true"):
            run_remix_camera_rasa_tool(
                {"command": "send-selfie", "prompt": "cozy couch", "action": "generate"},
                bridge_url="http://bridge.local",
                opener=lambda *_args, **_kwargs: io.BytesIO(b"{}"),
            )


if __name__ == "__main__":
    unittest.main()
