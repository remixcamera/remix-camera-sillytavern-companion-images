import asyncio
import importlib.util
import json
import sys
import types
import unittest
from pathlib import Path
from unittest.mock import patch


PACKAGE_ROOT = Path(__file__).resolve().parents[1]
ADAPTER_PATH = PACKAGE_ROOT / "adapters" / "openwebui" / "remix_camera_companion_images.py"


class FakeBaseModel:
    def __init__(self, **kwargs):
        for cls in reversed(self.__class__.mro()):
            for key, value in cls.__dict__.items():
                if key.startswith("_") or callable(value):
                    continue
                setattr(self, key, value)
        for key, value in kwargs.items():
            setattr(self, key, value)


def fake_field(default=None, **_kwargs):
    return default


def load_adapter_module():
    fake_pydantic = types.SimpleNamespace(BaseModel=FakeBaseModel, Field=fake_field)
    with patch.dict(sys.modules, {"pydantic": fake_pydantic}):
        spec = importlib.util.spec_from_file_location("remix_camera_openwebui_tool", ADAPTER_PATH)
        module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(module)
        return module


class FakeResponse:
    def __init__(self, payload):
        self.payload = payload

    def __enter__(self):
        return self

    def __exit__(self, *_args):
        return False

    def read(self):
        return json.dumps(self.payload).encode("utf-8")


class OpenWebUIToolTest(unittest.TestCase):
    def setUp(self):
        module = load_adapter_module()
        self.tool = module.Tools()
        self.tool.valves.BRIDGE_URL = "http://bridge.test"
        self.tool.valves.PROFILE_ID = "profile_lily"
        self.requests = []

    def fake_urlopen(self, request, timeout=0):
        self.requests.append(
            {
                "url": request.full_url,
                "timeout": timeout,
                "body": json.loads(request.data.decode("utf-8")),
            }
        )
        if request.full_url.endswith("/dry-run"):
            return FakeResponse(
                {
                    "ok": True,
                    "dryRun": True,
                    "promptTemplate": {"packTitle": "Excellent Lily Selfie"},
                    "prompt": "Realistic phone-camera selfie prompt",
                }
            )
        return FakeResponse(
            {
                "ok": True,
                "markdown": "![Lily](http://127.0.0.1:8787/v1/images/photo_1)",
            }
        )

    def test_send_selfie_defaults_to_preview_without_spend_guard(self):
        with patch("urllib.request.urlopen", self.fake_urlopen):
            result = asyncio.run(self.tool.send_selfie(prompt="cozy lamp light"))

        self.assertIn("Preview ready: Excellent Lily Selfie", result)
        self.assertEqual(self.requests[0]["url"], "http://bridge.test/v1/tools/send-selfie/dry-run")
        self.assertEqual(self.requests[0]["body"]["profileId"], "profile_lily")
        self.assertNotIn("yes", self.requests[0]["body"])

    def test_send_selfie_generates_only_when_yes_true(self):
        with patch("urllib.request.urlopen", self.fake_urlopen):
            result = asyncio.run(self.tool.send_selfie(prompt="cozy lamp light", yes=True))

        self.assertEqual(result, "![Lily](http://127.0.0.1:8787/v1/images/photo_1)")
        self.assertEqual(self.requests[0]["url"], "http://bridge.test/v1/tools/send-selfie/generate")
        self.assertEqual(self.requests[0]["body"]["yes"], True)

    def test_couple_photo_forwards_reference_photo_and_consent(self):
        with patch("urllib.request.urlopen", self.fake_urlopen):
            result = asyncio.run(
                self.tool.couple_photo(
                    user_consent="yes",
                    prompt="coffee shop booth",
                    user_reference_image_url="https://example.test/user.jpg",
                )
            )

        self.assertIn("Preview ready", result)
        body = self.requests[0]["body"]
        self.assertEqual(self.requests[0]["url"], "http://bridge.test/v1/tools/couple-photo/dry-run")
        self.assertEqual(body["userConsent"], "yes")
        self.assertEqual(body["userReferenceImageUrl"], "https://example.test/user.jpg")
        self.assertNotIn("yes", body)


if __name__ == "__main__":
    unittest.main()
