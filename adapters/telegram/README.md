# Telegram Adapter

Telegram has two deliverables:

- `remix-telegram-tool.mjs`: reusable integration module for existing Telegram bots.
- `framework-middleware.mjs`: drop-in Telegraf and grammY middleware for existing bots.
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

### Raw Telegram Update Loop

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

### Telegraf

```js
import { Telegraf } from "telegraf";
import { createRemixTelegramTelegrafMiddleware } from "./adapters/telegram/framework-middleware.mjs";

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

bot.use(
  createRemixTelegramTelegrafMiddleware({
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    bridgeUrl: "http://127.0.0.1:8787",
    profileId: process.env.REMIX_PROFILE_ID,
    characterName: "Lily",
  }),
);
```

The middleware only handles Remix.Camera commands. Other messages continue to the next Telegraf middleware. When `botToken` is present, it uses the built-in Bot API sender so local bridge images are uploaded as files instead of being sent as unusable local URLs.

### grammY

```js
import { Bot, InputFile } from "grammy";
import { createRemixTelegramGrammyMiddleware } from "./adapters/telegram/framework-middleware.mjs";

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);

bot.use(
  createRemixTelegramGrammyMiddleware({
    botToken: process.env.TELEGRAM_BOT_TOKEN,
    bridgeUrl: "http://127.0.0.1:8787",
    profileId: process.env.REMIX_PROFILE_ID,
    characterName: "Lily",
    inputFileFactory: (buffer, filename) => new InputFile(buffer, filename),
  }),
);
```

`inputFileFactory` is only needed when you want the middleware to send local bridge images through grammY directly. If `botToken` is set, the middleware can use the built-in Bot API sender without a grammY-specific upload helper.
