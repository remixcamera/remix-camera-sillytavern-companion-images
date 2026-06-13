# Telegram Demo

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=telegram
```

Run Lily:

```bash
TELEGRAM_BOT_TOKEN=... node adapters/telegram/lily-bot.mjs
```

Use the same tool inside an existing Telegraf bot:

```js
import { createRemixTelegramTelegrafMiddleware } from "../../adapters/telegram/framework-middleware.mjs";

bot.use(createRemixTelegramTelegrafMiddleware({
  botToken: process.env.TELEGRAM_BOT_TOKEN,
  bridgeUrl: "http://127.0.0.1:8787",
  profileId: process.env.REMIX_PROFILE_ID,
  characterName: "Lily",
}));
```

Use the same tool inside an existing grammY bot:

```js
import { InputFile } from "grammy";
import { createRemixTelegramGrammyMiddleware } from "../../adapters/telegram/framework-middleware.mjs";

bot.use(createRemixTelegramGrammyMiddleware({
  botToken: process.env.TELEGRAM_BOT_TOKEN,
  bridgeUrl: "http://127.0.0.1:8787",
  profileId: process.env.REMIX_PROFILE_ID,
  characterName: "Lily",
  inputFileFactory: (buffer, filename) => new InputFile(buffer, filename),
}));
```

## Demo Flow

1. Message Lily: `/help`.
2. Send `/preview selfie cozy couch with lamp light`.
3. Send `/selfie cozy couch with lamp light`.
4. Send `/couple yes coffee shop booth with me`.
5. Send `/vacation yes Amalfi coast weekend`.
6. Send `/snap yes warm bedroom mirror snap`.

## Proof Points

- The reusable module can be imported by any existing Telegram bot.
- Existing Telegraf and grammY bots can use the drop-in middleware with `bot.use(...)`.
- Lily is only a proof-of-concept wrapper on top of the reusable tool.
- The adapter uploads local bridge images to Telegram as files, not passed as unusable `127.0.0.1` URLs.
- Couple/private commands require `yes`.

## Executable Evidence

Run a no-spend production bridge proof without Telegram credentials:

```bash
npm run demo:verify
npm run demo:messaging -- \
  --target=telegram \
  --command="/preview selfie cozy couch with lamp light" \
  --output-dir=demos/telegram/evidence-production-2026-06-12
```

This starts the local bridge, uses the paired Remix.Camera session, calls the reusable Telegram tool in dry-run mode, and writes:

```text
demos/telegram/evidence-production-2026-06-12/result.json
demos/telegram/evidence-production-2026-06-12/transcript.md
demos/telegram/evidence-production-2026-06-12/transcript.html
```

Run a real Telegram Bot API proof after setting bot credentials. This spends exactly one Remix.Camera generation and sends the result into the configured Telegram chat:

```bash
TELEGRAM_BOT_TOKEN=... \
TELEGRAM_CHAT_ID=... \
npm run demo:messaging:deliver -- \
  --target=telegram \
  --command="/selfie cozy couch with lamp light" \
  --yes \
  --max-generations=1 \
  --output-dir=demos/telegram/live-production-$(date +%F)
```

Do not record or publish Telegram output from a local harness as if it were a real Telegram chat. The credentialed path above is the one to use for the public Telegram demo.
