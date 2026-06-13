# Remix.Camera VK Community Bot Adapter

Use `remix-vk-tool.mjs` when an existing VK community bot already owns text chat and needs Remix.Camera companion image tools.

The adapter supports VK Callback API `message_new` events and Long Poll style message objects. It parses simple commands, calls the local Remix.Camera bridge, and can deliver either:

- public Remix.Camera `productionImageUrl` links through `messages.send`
- VK photo attachments through `photos.getMessagesUploadServer`, image upload, `photos.saveMessagesPhoto`, then `messages.send`

Default delivery is link-based because it is the most stable path across community tokens. Set `attachImages: true` only after confirming your VK community token can use message photo upload for the target peer.

Official VK docs used for this adapter:

- Chatbot quick start: `https://dev.vk.com/en/api/bots/getting-started`
- `messages.send`: `https://dev.vk.com/en/method/messages.send`
- `photos.getMessagesUploadServer`: `https://dev.vk.com/en/method/photos.getMessagesUploadServer`
- `photos.saveMessagesPhoto`: `https://dev.vk.com/en/method/photos.saveMessagesPhoto`

## Install

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=vk
```

## Minimal Integration

```js
import { createRemixVkTool } from "./adapters/vk/remix-vk-tool.mjs";

const remixVk = createRemixVkTool({
  bridgeUrl: process.env.REMIX_BRIDGE_URL || "http://127.0.0.1:8787",
  accessToken: process.env.VK_ACCESS_TOKEN,
  callbackSecret: process.env.VK_CALLBACK_SECRET,
  characterName: "Lily",
  autoSend: true,
});

export async function handleVkCallback(payload) {
  if (payload.type === "confirmation") {
    return process.env.VK_CONFIRMATION_CODE;
  }

  const results = await remixVk.handleWebhookDetailed(payload);
  return results.some((item) => item.handled) ? "ok" : "ok";
}
```

## Commands

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

Preview commands call `/dry-run` and never spend credits. Generate commands call `/generate` only after the command parser sees the generation command. Couple, vacation, and private snap generation still require explicit `yes`.

## Delivery Modes

Link delivery:

```js
const remixVk = createRemixVkTool({
  accessToken: process.env.VK_ACCESS_TOKEN,
  autoSend: true,
  attachImages: false,
});
```

Photo attachment delivery:

```js
const remixVk = createRemixVkTool({
  accessToken: process.env.VK_ACCESS_TOKEN,
  autoSend: true,
  attachImages: true,
  uploadFieldName: "photo",
});
```

If VK returns a changed upload contract, keep `fallbackToLink: true` so the bot sends the public Remix.Camera image URL instead of failing the conversation.

## Production Notes

- Enable VK community bot capabilities and community messages before testing.
- Store `VK_ACCESS_TOKEN` and `VK_CALLBACK_SECRET` server-side only.
- For Callback API, compare the configured secret before processing `message_new`.
- For Long Poll, pass extracted message objects directly to `handleTextMessageDetailed`.
- VK bots cannot force-delete delivered private media; keep private snap copy conservative.
