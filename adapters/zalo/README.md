# Remix.Camera for Zalo Official Account

Use this adapter when a Zalo Official Account chatbot should add Remix.Camera companion-image commands.

Official surface: Zalo Official Account OpenAPI message and webhook surfaces. Image delivery uses Zalo OA consultation messages with media attachments from public HTTPS image URLs.

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=zalo
```

Reusable module:

```js
import { createRemixZaloTool } from "./adapters/zalo/remix-zalo-tool.mjs";

const remix = createRemixZaloTool({
  accessToken: process.env.ZALO_ACCESS_TOKEN,
  bridgeUrl: process.env.REMIX_BRIDGE_URL || "http://127.0.0.1:8787",
  characterName: "Lily",
});

if (remix.shouldHandleWebhook(zaloWebhookPayload)) {
  const details = await remix.handleWebhookDetailed(zaloWebhookPayload);
  console.log(details);
}
```

Lily proof-of-concept webhook:

```bash
ZALO_ACCESS_TOKEN=... \
ZALO_APP_SECRET=... \
REMIX_CONFIG_FILE=$HOME/.remix-camera/sillytavern-bridge.json \
node adapters/zalo/lily-webhook-server.mjs
```

Expose the server over HTTPS and set your Zalo OA webhook URL to:

```text
https://your-host.example/zalo/webhook
```

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

Zalo OA image messages require public HTTPS image URLs or uploaded attachment IDs. The adapter uses Remix.Camera `productionImageUrl` and refuses to post local bridge URLs as image payloads.

If your generated URL is local-only, proxy it through a stable HTTPS image URL before sending.

## Official Docs

- https://developers.zalo.me/docs/api/official-account-api-230
- https://developers.zalo.me/docs/official-account/tin-nhan/tin-tu-van/gui-tin-tu-van-dinh-kem-anh
