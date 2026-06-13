import json
import os
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional

try:
    from rasa_sdk import Action
except Exception:  # pragma: no cover - allows py_compile without rasa_sdk installed.
    class Action:  # type: ignore
        pass


DEFAULT_BRIDGE_URL = "http://127.0.0.1:8787"


def _truthy(value: Any) -> bool:
    return value is True or str(value).strip().lower() in {"true", "yes", "y", "1", "confirm"}


def _slot(tracker: Any, name: str, default: Any = "") -> Any:
    getter = getattr(tracker, "get_slot", None)
    if callable(getter):
        value = getter(name)
        return default if value is None else value
    return default


def _latest_text(tracker: Any) -> str:
    message = getattr(tracker, "latest_message", {}) or {}
    if isinstance(message, dict):
        return str(message.get("text") or "")
    return ""


def rasa_bridge_action(input_data: Dict[str, Any]) -> str:
    requested = str(input_data.get("action") or input_data.get("mode") or "").lower()
    if requested in {"dry-run", "dryrun", "preview"}:
        return "dry-run"
    if requested == "generate" and not _truthy(input_data.get("yes")):
        raise ValueError("Refusing to spend Remix.Camera credits without yes=true.")
    if requested == "generate":
        return "generate"
    if _truthy(input_data.get("yes")):
        return "generate"
    return "dry-run"


def build_rasa_bridge_input(input_data: Dict[str, Any], action: str) -> Dict[str, Any]:
    prompt = str(input_data.get("prompt") or input_data.get("chatText") or "")
    command = str(input_data.get("command") or "send-selfie")
    return {
        "profileId": input_data.get("profileId") or os.environ.get("REMIX_PROFILE_ID") or "",
        "characterName": input_data.get("characterName") or os.environ.get("REMIX_CHARACTER_NAME") or "Remix Companion",
        "visualIdentity": input_data.get("visualIdentity") or os.environ.get("REMIX_CHARACTER_VISUAL_IDENTITY") or "",
        "mood": input_data.get("mood") or prompt,
        "location": input_data.get("location") or prompt,
        "chatText": input_data.get("chatText") or prompt,
        "outfit": input_data.get("outfit") or "",
        "theme": input_data.get("theme") or "",
        "sourceImageUrl": input_data.get("sourceImageUrl") or "",
        "userReferenceImageUrl": input_data.get("userReferenceImageUrl") or "",
        "userConsent": input_data.get("userConsent") or "",
        "userDescription": input_data.get("userDescription") or "",
        "matureContent": bool(input_data.get("matureContent")) or command == "private-snap",
        "yes": True if action == "generate" else None,
    }


def call_bridge(
    bridge_url: str,
    command: str,
    action: str,
    payload: Dict[str, Any],
    opener: Optional[Any] = None,
) -> Dict[str, Any]:
    url = f"{bridge_url.rstrip('/')}/v1/tools/{command}/{action}"
    body = json.dumps({key: value for key, value in payload.items() if value not in ("", None)}).encode("utf-8")
    request = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    open_request = opener or urllib.request.urlopen
    try:
        with open_request(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8") or "{}")
    except urllib.error.HTTPError as error:
        text = error.read().decode("utf-8")
        raise RuntimeError(text or f"Bridge request failed with {error.code}") from error


def image_urls_from_payload(payload: Dict[str, Any]) -> List[str]:
    results = payload.get("results") if isinstance(payload.get("results"), list) else []
    urls = [item.get("productionImageUrl") for item in results if isinstance(item, dict) and item.get("productionImageUrl")]
    if payload.get("imageUrl"):
        urls.append(payload["imageUrl"])
    return list(dict.fromkeys(urls))


def summarize_bridge_payload(payload: Dict[str, Any]) -> str:
    if payload.get("dryRun") is True:
        title = ((payload.get("promptTemplate") or {}).get("packTitle") or "Remix.Camera image")
        prompt = payload.get("prompt") or ""
        return f"Preview ready: {title}\n{prompt}".strip()
    if payload.get("markdown"):
        return str(payload["markdown"])
    urls = image_urls_from_payload(payload)
    if urls:
        return "\n".join(urls)
    return "Remix.Camera image request completed."


def run_remix_camera_rasa_tool(
    input_data: Dict[str, Any],
    bridge_url: Optional[str] = None,
    opener: Optional[Any] = None,
) -> Dict[str, Any]:
    command = str(input_data.get("command") or "send-selfie")
    action = rasa_bridge_action(input_data)
    payload = call_bridge(
        bridge_url or str(input_data.get("bridgeUrl") or os.environ.get("REMIX_BRIDGE_URL") or DEFAULT_BRIDGE_URL),
        command,
        action,
        build_rasa_bridge_input(input_data, action),
        opener=opener,
    )
    return {
        "command": command,
        "action": action,
        "dryRun": payload.get("dryRun") is True,
        "text": summarize_bridge_payload(payload),
        "imageUrls": image_urls_from_payload(payload),
        "payload": payload,
    }


class ActionRemixCameraCompanionImage(Action):
    def name(self) -> str:
        return "action_remix_camera_companion_image"

    def run(self, dispatcher: Any, tracker: Any, domain: Dict[str, Any]) -> List[Dict[str, Any]]:
        input_data = {
            "command": _slot(tracker, "remix_command", "send-selfie"),
            "action": _slot(tracker, "remix_action", "dry-run"),
            "yes": _slot(tracker, "remix_yes", False),
            "prompt": _slot(tracker, "remix_prompt", _latest_text(tracker)),
            "characterName": _slot(tracker, "remix_character_name", os.environ.get("REMIX_CHARACTER_NAME") or "Remix Companion"),
            "profileId": _slot(tracker, "remix_profile_id", os.environ.get("REMIX_PROFILE_ID") or ""),
            "sourceImageUrl": _slot(tracker, "remix_source_image_url", ""),
            "userReferenceImageUrl": _slot(tracker, "remix_user_reference_image_url", ""),
            "userConsent": _slot(tracker, "remix_user_consent", ""),
            "userDescription": _slot(tracker, "remix_user_description", ""),
            "matureContent": _truthy(_slot(tracker, "remix_mature_content", False)),
        }
        try:
            result = run_remix_camera_rasa_tool(input_data)
        except Exception as error:
            dispatcher.utter_message(text=str(error))
            return []

        dispatcher.utter_message(text=result["text"])
        for image_url in result["imageUrls"]:
            dispatcher.utter_message(image=image_url)

        return [
            {"event": "slot", "name": "remix_dry_run", "value": result["dryRun"]},
            {"event": "slot", "name": "remix_image_url", "value": result["imageUrls"][0] if result["imageUrls"] else ""},
            {"event": "slot", "name": "remix_text", "value": result["text"]},
        ]
