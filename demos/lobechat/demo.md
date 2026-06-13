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
2. Ask for a prompt preview and confirm Lobe calls `sendSelfiePreview`.
3. Ask the agent to send a selfie after approving the spend and confirm it calls `sendSelfie` with `yes=true`.
4. Ask for a date-night preview, then approve the matching generation tool.

## Proof Points

- LobeChat reads the bridge-hosted plugin manifest.
- Each companion command has a preview plugin API and a guarded generate plugin API.
- Preview APIs call `/dry-run` and never spend credits.
- Generate APIs require `yes=true`.
