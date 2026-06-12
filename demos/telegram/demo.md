# Telegram Demo

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=telegram
```

Run Lily:

```bash
TELEGRAM_BOT_TOKEN=... node adapters/telegram/lily-bot.mjs
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
- Lily is only a proof-of-concept wrapper on top of the reusable tool.
- Local bridge image URLs are uploaded to Telegram as files, not passed as unusable `127.0.0.1` URLs.
- Couple/private commands require `yes`.

