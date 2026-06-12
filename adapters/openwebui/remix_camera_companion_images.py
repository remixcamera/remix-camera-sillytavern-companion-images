"""
title: Remix.Camera Companion Images
author: Remix.Camera
version: 0.4.0
description: Companion image tools backed by a local Remix.Camera bridge.
requirements: pydantic
"""

import json
import urllib.error
import urllib.request
from typing import Optional

from pydantic import BaseModel, Field


class Tools:
    class Valves(BaseModel):
        BRIDGE_URL: str = Field(default="http://127.0.0.1:8787", description="Local Remix.Camera bridge URL.")
        PROFILE_ID: str = Field(default="", description="Optional Remix.Camera profile ID override.")
        CHARACTER_NAME: str = Field(default="", description="Optional companion name override.")
        VISUAL_IDENTITY: str = Field(default="", description="Optional stable visual identity.")

    def __init__(self):
        self.valves = self.Valves()

    def _call(self, command: str, payload: dict, generate: bool) -> str:
        action = "generate" if generate else "dry-run"
        body = {
            key: value
            for key, value in {
                **payload,
                "profileId": payload.get("profileId") or self.valves.PROFILE_ID or None,
                "characterName": payload.get("characterName") or self.valves.CHARACTER_NAME or None,
                "visualIdentity": payload.get("visualIdentity") or self.valves.VISUAL_IDENTITY or None,
                "yes": True if generate else None,
            }.items()
            if value not in (None, "")
        }
        request = urllib.request.Request(
            f"{self.valves.BRIDGE_URL.rstrip('/')}/v1/tools/{command}/{action}",
            data=json.dumps(body).encode("utf-8"),
            headers={"Content-Type": "application/json", "Accept": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(request, timeout=240) as response:
                data = json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            try:
                data = json.loads(error.read().decode("utf-8"))
            except Exception:
                data = {"error": str(error)}
            return f"Remix.Camera failed: {data.get('error') or data}"

        if data.get("dryRun"):
            template = (data.get("promptTemplate") or {}).get("packTitle") or "Remix.Camera template"
            return f"Preview ready: {template}\n\n{data.get('prompt', '')}\n\nCall again with yes=True to spend one generation."
        if data.get("markdown"):
            return data["markdown"]
        return json.dumps(data, indent=2)

    async def send_selfie(self, prompt: str = "", yes: bool = False) -> str:
        """Preview or generate an in-character Remix.Camera selfie. Set yes=True only after the user asks for the image."""
        return self._call("send-selfie", {"mood": prompt, "location": prompt, "chatText": prompt}, yes)

    async def auto_selfie_from_chat(self, chat_text: str, yes: bool = False) -> str:
        """Preview or generate a selfie from recent chat context."""
        return self._call("auto-selfie-from-chat", {"chatText": chat_text}, yes)

    async def outfit_try_on(self, source_image_url: str, outfit: str = "", yes: bool = False) -> str:
        """Preview or generate an outfit image from a source image URL."""
        return self._call("outfit-try-on", {"sourceImageUrl": source_image_url, "outfit": outfit}, yes)

    async def couple_photo(
        self,
        user_consent: str,
        prompt: str = "",
        user_reference_image_url: Optional[str] = None,
        yes: bool = False,
    ) -> str:
        """Preview or generate a couple photo. user_consent must be yes when the user explicitly asks to appear in the image."""
        return self._call(
            "couple-photo",
            {
                "userConsent": user_consent,
                "location": prompt,
                "chatText": prompt,
                "userReferenceImageUrl": user_reference_image_url,
            },
            yes,
        )

    async def couples_vacation(self, user_consent: str, theme: str = "", yes: bool = False) -> str:
        """Preview or generate a cohesive 3-photo couples vacation set."""
        return self._call("couples-vacation", {"userConsent": user_consent, "theme": theme, "maxGenerations": 3}, yes)

    async def date_night(self, prompt: str = "", yes: bool = False) -> str:
        """Preview or generate a date-night companion image."""
        return self._call("date-night", {"location": prompt, "chatText": prompt}, yes)

    async def daily_life_snap(self, prompt: str = "", yes: bool = False) -> str:
        """Preview or generate a casual daily-life snap."""
        return self._call("daily-life-snap", {"location": prompt, "chatText": prompt}, yes)

    async def private_snap(self, prompt: str = "", yes: bool = False, ttl_seconds: int = 120) -> str:
        """Preview or generate an opted-in mature private snap. Set yes=True only in opted-in adult chats."""
        return self._call(
            "private-snap",
            {
                "matureContent": True,
                "location": prompt,
                "chatText": prompt,
                "snapTtlSeconds": ttl_seconds,
            },
            yes,
        )

