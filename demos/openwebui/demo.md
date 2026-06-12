# Open WebUI Demo

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=openwebui
```

Create an Open WebUI Tool from:

```text
adapters/openwebui/remix_camera_companion_images.py
```

Set Tool valves:

```text
BRIDGE_URL=http://127.0.0.1:8787
PROFILE_ID=<your Remix.Camera profile id>
CHARACTER_NAME=Lily
```

## Demo Flow

1. Start a chat with a companion prompt.
2. Ask for a selfie, but tell the model to preview first.
3. Call `send_selfie(prompt="cozy couch with lamp light")`.
4. Call `send_selfie(prompt="cozy couch with lamp light", yes=True)`.
5. Repeat with `date_night` and `couples_vacation`.

## Proof Points

- Open WebUI calls the Python Tool directly.
- Dry-run output includes the selected Remix.Camera template.
- `yes=True` is required before generation credits are spent.

