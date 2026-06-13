# Messenger Adapter

The Messenger adapter lets a Meta Messenger Platform bot call the local Remix.Camera bridge and send generated companion images through the Messenger Send API.

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=messenger
```

## Reusable Tool

```js
import { createRemixMessengerTool } from "./adapters/messenger/remix-messenger-tool.mjs";

const remix = createRemixMessengerTool({
  pageAccessToken: process.env.MESSENGER_PAGE_ACCESS_TOKEN,
  bridgeUrl: "http://127.0.0.1:8787",
  profileId: process.env.REMIX_PROFILE_ID,
  characterName: "Lily",
});
```

For an existing bot, keep your own routing and Send API delivery:

```js
if (remix.shouldHandleWebhook(messengerWebhookPayload)) {
  const details = await remix.handleWebhookDetailed(messengerWebhookPayload, {
    autoSend: false,
  });
  await yourBot.sendImages(details[0].recipientId, details[0].result.imageUrls);
}
```

Use `handleTextMessageDetailed(message, { autoSend: false })` when you already have a normalized Messenger message. The simple `handleTextMessage()` and `handleWebhook()` helpers still send automatically when credentials are configured.

The tool parses message text such as:

```text
selfie cozy couch with lamp light
preview date quiet restaurant booth
couple yes coffee shop booth with me
snap yes warm bedroom mirror snap
```

Couple, vacation, and private commands require explicit `yes` before any generation request is sent to the bridge.

## Lily Proof Of Concept

```bash
MESSENGER_PAGE_ACCESS_TOKEN=... \
MESSENGER_APP_SECRET=... \
MESSENGER_VERIFY_TOKEN=... \
REMIX_BRIDGE_URL=http://127.0.0.1:8787 \
node adapters/messenger/lily-webhook-server.mjs
```

Expose the server over HTTPS and set that URL in the Messenger webhook settings. The proof server handles webhook verification, verifies `x-hub-signature-256`, acknowledges message webhooks quickly, calls the bridge asynchronously, then sends replies through the Send API.

Messenger image attachments require publicly reachable HTTPS image URLs. The adapter prefers the bridge result's `productionImageUrl`; it does not post `127.0.0.1` URLs as images.
