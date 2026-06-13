# WhatsApp Adapter

The WhatsApp adapter lets a Meta WhatsApp Cloud API bot call the local Remix.Camera bridge and send generated images back into WhatsApp.

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=whatsapp
```

The reusable module is:

```text
adapters/whatsapp/remix-whatsapp-tool.mjs
```

## Reusable Tool

```js
import { createRemixWhatsAppTool } from "./adapters/whatsapp/remix-whatsapp-tool.mjs";

const remix = createRemixWhatsAppTool({
  accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
  phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
  bridgeUrl: "http://127.0.0.1:8787",
  profileId: process.env.REMIX_PROFILE_ID,
  characterName: "Lily",
});

if (remix.shouldHandleWebhook(metaWebhookPayload)) {
  const details = await remix.handleWebhookDetailed(metaWebhookPayload, {
    autoSend: false,
  });
  // Send details[n].result from your own bot pipeline, or remove autoSend:false.
}
```

Use `handleTextDetailed(message, { autoSend: false })` when your existing bot already has routing, logging, rate limits, or custom delivery. The simple `handleText()` and `handleWebhook()` helpers still run and send in one call for small proof servers.

Lily proof-of-concept webhook:

```bash
WHATSAPP_ACCESS_TOKEN=... \
WHATSAPP_PHONE_NUMBER_ID=... \
WHATSAPP_VERIFY_TOKEN=choose-a-secret \
REMIX_BRIDGE_URL=http://127.0.0.1:8787 \
node adapters/whatsapp/lily-webhook-server.mjs
```

Expose that server over HTTPS and set the Meta app webhook callback URL to the exposed URL. Use the same `WHATSAPP_VERIFY_TOKEN` for webhook verification.

## Commands

Users can send:

```text
selfie cafe mirror selfie
date quiet restaurant booth
daily morning coffee on the couch
outfit https://example.com/outfit.jpg red sundress
couple yes coffee shop booth with me
vacation yes Amalfi coast weekend
snap yes warm bedroom mirror snap
preview selfie cozy couch with lamp light
```

Couple and private commands require `yes` before spending credits.

## Media Behavior

WhatsApp cannot fetch `127.0.0.1` bridge image URLs, so the adapter uploads local bridge images to the WhatsApp Cloud API media endpoint before sending them.

WhatsApp bots cannot force-delete media already delivered to a user's chat. For private snaps, use WhatsApp disappearing messages in the chat. The adapter sends a clear note instead of pretending deletion is guaranteed.
