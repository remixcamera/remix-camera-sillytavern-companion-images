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
await remix.handleUpdate(update);
```

The adapter uploads local bridge images to Telegram as files. It does not pass `127.0.0.1` URLs to Telegram's servers.
