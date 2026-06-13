# Zendesk Sunshine Conversations Demo

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=zendesk
```

Use `adapters/zendesk/remix-zendesk-sunshine-tool.mjs` in a Sunshine Conversations webhook or bot service.

## Demo Flow

1. Start the local Remix.Camera bridge.
2. Send `preview selfie cozy couch with lamp light`.
3. Confirm the adapter returns a no-credit dry-run prompt.
4. Send `selfie cozy couch with lamp light` only when you intentionally want to spend one generation.
5. Deliver with `sendZendeskRemixResult(...)`.

Zendesk delivery sends a business text message followed by `content.type=image` messages whose `mediaUrl` values are public Remix.Camera `productionImageUrl` links.
