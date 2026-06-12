# LobeChat Demo

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=lobechat
```

Install a custom plugin from:

```text
http://127.0.0.1:8787/lobe/manifest.json
```

## Demo Flow

1. Add the Remix.Camera Companion Images plugin to a LobeChat agent.
2. Ask for a prompt preview.
3. Ask the agent to send a selfie after approving the spend.
4. Ask for a date-night image.

## Proof Points

- LobeChat reads the bridge-hosted plugin manifest.
- Each plugin API maps to a Remix.Camera tool endpoint.
- The manifest requires `yes=true` for generation tools.

