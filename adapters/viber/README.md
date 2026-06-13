# Remix.Camera for Viber

Use this adapter when an existing Viber bot should add Remix.Camera companion-image commands.

Official surface: Viber Bot REST API `send_message` with `text` and `picture` message types.

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=viber
```

Reusable module:

```js
import { createRemixViberTool } from "./adapters/viber/remix-viber-tool.mjs";

const remix = createRemixViberTool({
  authToken: process.env.VIBER_AUTH_TOKEN,
  bridgeUrl: process.env.REMIX_BRIDGE_URL || "http://127.0.0.1:8787",
  characterName: "Lily",
  sender: { name: "Lily" },
});

if (remix.shouldHandleWebhook(viberWebhookPayload)) {
  const details = await remix.handleWebhookDetailed(viberWebhookPayload);
  console.log(details);
}
```

Lily proof-of-concept webhook:

```bash
VIBER_AUTH_TOKEN=... \
REMIX_CONFIG_FILE=$HOME/.remix-camera/sillytavern-bridge.json \
node adapters/viber/lily-webhook-server.mjs
```

Expose the server over HTTPS and set your Viber bot webhook to:

```text
https://your-host.example/viber/webhook
```

Verify incoming webhooks with `verifyViberSignature(...)` and the `x-viber-content-signature` header before processing messages.

## Commands

Users can send:

```text
selfie cafe mirror selfie
preview selfie cozy couch with lamp light
date quiet restaurant booth
daily morning coffee on the couch
outfit https://example.com/outfit.jpg red sundress
couple yes coffee shop booth with me
vacation yes Amalfi coast weekend
snap yes warm bedroom mirror snap
```

`preview` is a dry-run and never spends credits. `couple`, `vacation`, and `snap` require the word `yes` before generation.

## Image Delivery

Viber picture messages require a public HTTPS image URL ending in `.jpg`, `.jpeg`, `.png`, or `.gif`. The adapter uses Remix.Camera `productionImageUrl` when available and refuses to post local `127.0.0.1` bridge URLs as broken images.

If your generated URL does not satisfy Viber's URL requirements, proxy it through a stable HTTPS image URL before sending.

## Official Docs

- https://developers.viber.com/docs/api/rest-bot-api/
