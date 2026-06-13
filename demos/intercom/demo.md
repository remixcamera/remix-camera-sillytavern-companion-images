# Intercom Demo

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=intercom
```

Use `adapters/intercom/remix-intercom-tool.mjs` in an Intercom webhook or bot service.

## Demo Flow

1. Start the local Remix.Camera bridge.
2. Send `preview selfie cozy couch with lamp light` through the Intercom conversation handler.
3. Confirm the adapter returns a dry-run prompt from a real Remix.Camera template.
4. Send `selfie cozy couch with lamp light` only when you intentionally want to spend one generation.
5. Deliver the result with `sendIntercomRemixResult(...)`.

Intercom delivery uses `attachment_urls` and public `productionImageUrl` values. Local bridge URLs are not posted.
