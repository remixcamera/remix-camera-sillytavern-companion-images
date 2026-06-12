# Flowise Adapter

Flowise can use Remix.Camera through a Custom Tool that calls the local bridge.

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=flowise
```

Use this helper as the implementation reference:

```text
adapters/flowise/remix-camera-flowise-tool.js
```

In Flowise:

1. Create or open an Agent chatflow.
2. Add a Custom Tool.
3. Set `REMIX_BRIDGE_URL` to `http://127.0.0.1:8787` if Flowise runs on the same machine.
4. Paste the `flowiseCustomToolSnippet` body or adapt `remixCameraFlowiseTool`.
5. Give the tool inputs for `command`, `prompt`, `preview`, and `yes`.

Recommended commands:

```text
send-selfie
auto-selfie-from-chat
outfit-try-on
couple-photo
couples-vacation
date-night
daily-life-snap
private-snap
```

For generation, set `yes=true`. For preview, set `preview=true`; previews never spend credits.

Cloud-hosted Flowise cannot call a user's local `127.0.0.1` bridge directly. Use self-hosted Flowise on the same machine/network, or expose the bridge through a private authenticated tunnel that only Flowise can reach.
