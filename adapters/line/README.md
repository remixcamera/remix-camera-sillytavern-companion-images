# LINE Adapter

The LINE adapter lets a LINE Messaging API bot call the local Remix.Camera bridge and reply with companion images.

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=line
```

## Reusable Tool

```js
import { createRemixLineTool } from "./adapters/line/remix-line-tool.mjs";

const remix = createRemixLineTool({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  bridgeUrl: "http://127.0.0.1:8787",
  profileId: process.env.REMIX_PROFILE_ID,
  characterName: "Lily",
});
```

For an existing bot, keep your own routing and delivery:

```js
if (remix.shouldHandleWebhook(lineWebhookPayload)) {
  const details = await remix.handleWebhookDetailed(lineWebhookPayload, {
    autoSend: false,
  });
  await yourBot.replyWithImages(details[0].replyToken, details[0].result.imageUrls);
}
```

Use `handleTextEventDetailed(event, { autoSend: false })` when you already have the LINE event object. The simple `handleTextEvent()` and `handleWebhook()` helpers still reply automatically when credentials are configured.

The tool parses text messages such as:

```text
selfie cozy couch with lamp light
preview date quiet restaurant booth
couple yes coffee shop booth with me
snap yes warm bedroom mirror snap
```

Couple, vacation, and private commands require explicit `yes` before any generation request is sent to the bridge.

## Lily Proof Of Concept

```bash
LINE_CHANNEL_ACCESS_TOKEN=... \
LINE_CHANNEL_SECRET=... \
REMIX_BRIDGE_URL=http://127.0.0.1:8787 \
node adapters/line/lily-webhook-server.mjs
```

Expose the webhook over HTTPS and set it as the LINE Messaging API webhook URL. The proof server verifies `x-line-signature`, acknowledges webhooks quickly, calls the bridge asynchronously, then replies through `POST /v2/bot/message/reply`.

LINE image messages require publicly reachable HTTPS image URLs. The adapter prefers the bridge result's `productionImageUrl`; it does not post `127.0.0.1` URLs as images.
