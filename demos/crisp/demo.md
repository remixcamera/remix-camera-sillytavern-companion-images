# Crisp Demo

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=crisp
```

Use `adapters/crisp/remix-crisp-tool.mjs` in a Crisp webhook, plugin, or operator-bot service.

## Demo Flow

1. Start the local Remix.Camera bridge.
2. Send `preview selfie cozy couch with lamp light`.
3. Confirm the adapter returns a no-credit dry-run prompt.
4. Send `selfie cozy couch with lamp light` only when you intentionally want to spend one generation.
5. Deliver with `sendCrispRemixResult(...)`.

Crisp delivery uses operator `type=text` messages and `type=file` image messages with public `productionImageUrl` values.
