import asyncio
import json
import os
import re
import urllib.error
import urllib.request
from typing import AsyncIterable

import fastapi_poe as fp


COMMAND_ALIASES = {
    "selfie": "send-selfie",
    "auto": "auto-selfie-from-chat",
    "auto-selfie": "auto-selfie-from-chat",
    "outfit": "outfit-try-on",
    "couple": "couple-photo",
    "vacation": "couples-vacation",
    "date": "date-night",
    "daily": "daily-life-snap",
    "snap": "private-snap",
    "private": "private-snap",
}
VALID_COMMANDS = {
    "send-selfie",
    "auto-selfie-from-chat",
    "outfit-try-on",
    "couple-photo",
    "couples-vacation",
    "date-night",
    "daily-life-snap",
    "private-snap",
}


def _latest_user_text(request: fp.QueryRequest) -> str:
    for message in reversed(request.query):
        if message.role == "user":
            return message.content or ""
    return ""


def _parse_command(text: str) -> tuple[str, str, bool]:
    lowered = text.lower()
    confirmed = bool(re.search(r"\b(yes=true|confirm=true|generate now|spend credit)\b", lowered))
    words = re.findall(r"[a-zA-Z][a-zA-Z_-]+", lowered)
    command = "send-selfie"
    for word in words:
        normalized = word.replace("_", "-")
        candidate = COMMAND_ALIASES.get(normalized, normalized)
        if candidate in VALID_COMMANDS:
            command = candidate
            break
    prompt = re.sub(r"\b(yes=true|confirm=true|preview|generate now|spend credit)\b", "", text, flags=re.I).strip()
    return command, prompt, confirmed


def _call_bridge_sync(command: str, prompt: str, confirmed: bool) -> dict:
    bridge_url = os.environ.get("REMIX_BRIDGE_URL", "http://127.0.0.1:8787").rstrip("/")
    action = "generate" if confirmed else "dry-run"
    body = {
        "profileId": os.environ.get("REMIX_PROFILE_ID") or None,
        "characterName": os.environ.get("REMIX_CHARACTER_NAME") or "Lily",
        "visualIdentity": os.environ.get("REMIX_CHARACTER_VISUAL_IDENTITY") or None,
        "chatText": prompt,
        "mood": prompt,
        "location": prompt,
        "matureContent": True if command == "private-snap" else None,
        "yes": True if confirmed else None,
    }
    data = json.dumps({key: value for key, value in body.items() if value not in (None, "")}).encode("utf-8")
    request = urllib.request.Request(
        f"{bridge_url}/v1/tools/{command}/{action}",
        data=data,
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
        raise RuntimeError(payload.get("error") or str(payload)) from error


class RemixCameraPoeBot(fp.PoeBot):
    async def get_response(self, request: fp.QueryRequest) -> AsyncIterable[fp.PartialResponse]:
        text = _latest_user_text(request)
        command, prompt, confirmed = _parse_command(text)
        try:
            payload = await asyncio.to_thread(_call_bridge_sync, command, prompt, confirmed)
        except Exception as error:
            yield fp.PartialResponse(text=f"Remix.Camera failed: {error}")
            return

        if payload.get("dryRun"):
            template = (payload.get("promptTemplate") or {}).get("packTitle") or "Remix.Camera template"
            yield fp.PartialResponse(text=f"Preview ready: {template}\n\n{payload.get('prompt', '')}\n\nReply with yes=true when you want me to generate it.")
            return
        yield fp.PartialResponse(text=payload.get("markdown") or payload.get("prompt") or json.dumps(payload))

    async def get_settings(self, setting: fp.SettingsRequest) -> fp.SettingsResponse:
        return fp.SettingsResponse(
            introduction_message="Ask for a Remix.Camera companion image. I preview first and generate only when you say yes=true."
        )


bot = RemixCameraPoeBot()
app = fp.make_app(bot, allow_without_key=True)
