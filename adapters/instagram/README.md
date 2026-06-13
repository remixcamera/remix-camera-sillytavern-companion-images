# Instagram DMs Adapter

The Instagram adapter lets an Instagram Messaging API integration call the local Remix.Camera bridge and send generated companion images through Instagram DMs.

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=instagram
```

## Reusable Tool

```js
import { createRemixInstagramTool } from "./adapters/instagram/remix-instagram-tool.mjs";

const remix = createRemixInstagramTool({
  accessToken: process.env.INSTAGRAM_ACCESS_TOKEN,
  igId: process.env.INSTAGRAM_IG_ID || "me",
  bridgeUrl: "http://127.0.0.1:8787",
  profileId: process.env.REMIX_PROFILE_ID,
  characterName: "Lily",
});
```

For an existing Instagram DM bot, keep your own routing and delivery:

```js
if (remix.shouldHandleWebhook(instagramWebhookPayload)) {
  const details = await remix.handleWebhookDetailed(instagramWebhookPayload, {
    autoSend: false,
  });
  await yourBot.sendImage(details[0].recipientId, details[0].result.payload.results[0].productionImageUrl);
}
```

Use `handleTextMessageDetailed(message, { autoSend: false })` when you already have a normalized Instagram message. The simple `handleTextMessage()` and `handleWebhook()` helpers still send automatically when credentials are configured.

The tool parses DM text such as:

```text
selfie cozy couch with lamp light
preview date quiet restaurant booth
couple yes coffee shop booth with me
snap yes warm bedroom mirror snap
```

Couple, vacation, and private commands require explicit `yes` before any generation request is sent to the bridge.

## Delivery Notes

Instagram image attachments require publicly reachable HTTPS image URLs. The adapter prefers the bridge result's `productionImageUrl`; it does not post `127.0.0.1` URLs as images.

Use `verifyInstagramSignature({ appSecret, signature, body })` to verify `x-hub-signature-256` before processing webhook bodies.
