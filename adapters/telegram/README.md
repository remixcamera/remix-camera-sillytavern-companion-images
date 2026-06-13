# Telegram Adapter

Telegram has two deliverables:

- `remix-telegram-tool.mjs`: reusable integration module for existing Telegram bots.
- `lily-bot.mjs`: Lily proof-of-concept bot using long polling.

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=telegram
```

## Lily Proof Of Concept

```bash
TELEGRAM_BOT_TOKEN=... node adapters/telegram/lily-bot.mjs
```

Lily defaults to profile `GLUCbfOgIzOLe37Ft4G7S97B0fu2_lily`. Override with `REMIX_PROFILE_ID`.

## Existing Bot Integration

```js
import { createRemixTelegramTool } from "./adapters/telegram/remix-telegram-tool.mjs";

const remix = createRemixTelegramTool({
  botToken: process.env.TELEGRAM_BOT_TOKEN,
  bridgeUrl: "http://127.0.0.1:8787",
  profileId: process.env.REMIX_PROFILE_ID,
  characterName: "Lily",
});

// In your existing update handler:
if (remix.shouldHandleUpdate(update)) {
  await remix.handleUpdate(update);
}
```

`handleUpdate()` keeps the simple path: it parses the Telegram update, calls the local Remix.Camera bridge, sends the result through the Bot API when `botToken` is configured, and returns the generated result.

Use `handleUpdateDetailed()` when your bot needs routing details, message IDs, or its own send pipeline:

```js
if (!remix.shouldHandleUpdate(update)) {
  return next();
}

const details = await remix.handleUpdateDetailed(update, { autoSend: false });

// Optional: send with your existing bot framework instead of the built-in Bot API sender.
for (const imageUrl of details.result.imageUrls || []) {
  await existingBot.sendPhoto(details.chatId, imageUrl);
}
if (!details.result.imageUrls?.length) {
  await existingBot.sendMessage(details.chatId, details.result.text);
}
```

The adapter uploads local bridge images to Telegram as files. It does not pass `127.0.0.1` URLs to Telegram's servers.

Detailed handler return shape:

```js
{
  handled: true,
  chatId: 123,
  messageId: 456,
  parsed: { command: "send-selfie", action: "generate" },
  result: { text: "Generated 1 image...", imageUrls: ["..."] },
  sentMessages: [{ message_id: 789 }]
}
```
