import json
import urllib.error
import urllib.request

from langflow.custom import Component
from langflow.io import BoolInput, DropdownInput, MessageTextInput, Output, StrInput
from langflow.schema import Data


COMMANDS = [
    "send-selfie",
    "auto-selfie-from-chat",
    "outfit-try-on",
    "couple-photo",
    "couples-vacation",
    "date-night",
    "daily-life-snap",
    "private-snap",
]


class RemixCameraCompanionImages(Component):
    display_name = "Remix.Camera Companion Images"
    description = "Preview or generate companion images through a local Remix.Camera bridge."
    documentation = "https://github.com/remixcamera/remix-camera-sillytavern-companion-images"
    icon = "image"
    name = "RemixCameraCompanionImages"

    inputs = [
        DropdownInput(name="command", display_name="Command", options=COMMANDS, value="send-selfie"),
        MessageTextInput(name="prompt", display_name="Prompt", value=""),
        StrInput(name="bridge_url", display_name="Bridge URL", value="http://127.0.0.1:8787"),
        StrInput(name="profile_id", display_name="Profile ID", value=""),
        StrInput(name="character_name", display_name="Character Name", value="Lily"),
        StrInput(name="source_image_url", display_name="Source Image URL", value=""),
        StrInput(name="user_reference_image_url", display_name="User Reference Image URL", value=""),
        StrInput(name="user_consent", display_name="User Consent", value=""),
        BoolInput(name="yes", display_name="Generate confirmed", value=False),
        BoolInput(name="preview", display_name="Force preview", value=True),
    ]

    outputs = [
        Output(display_name="Result", name="result", method="run"),
    ]

    def _call_bridge(self) -> dict:
        action = "generate" if self.yes and not self.preview else "dry-run"
        body = {
            "profileId": self.profile_id or None,
            "characterName": self.character_name or "Lily",
            "chatText": self.prompt,
            "mood": self.prompt,
            "location": self.prompt,
            "sourceImageUrl": self.source_image_url or None,
            "userReferenceImageUrl": self.user_reference_image_url or None,
            "userConsent": self.user_consent or None,
            "matureContent": True if self.command == "private-snap" else None,
            "yes": True if action == "generate" else None,
        }
        request = urllib.request.Request(
            f"{self.bridge_url.rstrip('/')}/v1/tools/{self.command}/{action}",
            data=json.dumps({key: value for key, value in body.items() if value not in (None, "")}).encode("utf-8"),
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=240) as response:
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            try:
                payload = json.loads(error.read().decode("utf-8"))
            except Exception:
                payload = {"error": str(error)}
            raise ValueError(payload.get("error") or str(payload)) from error

    def run(self) -> Data:
        payload = self._call_bridge()
        if payload.get("dryRun"):
            template = (payload.get("promptTemplate") or {}).get("packTitle") or "Remix.Camera template"
            text = f"Preview ready: {template}\n\n{payload.get('prompt', '')}\n\nSet yes=true and preview=false to generate."
        else:
            text = payload.get("markdown") or payload.get("prompt") or json.dumps(payload)
        return Data(data={"text": text, "payload": payload})
