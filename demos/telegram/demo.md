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
- The adapter uploads local bridge images to Telegram as files, not passed as unusable `127.0.0.1` URLs.
- Couple/private commands require `yes`.

## Executable Evidence

Run a no-spend production bridge proof without Telegram credentials:

```bash
npm run demo:verify
node scripts/verify-telegram-live-demo.mjs \
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
node scripts/verify-telegram-live-demo.mjs \
  --command="/selfie cozy couch with lamp light" \
  --yes \
  --max-generations=1 \
  --send-telegram \
  --require-telegram \
  --output-dir=demos/telegram/live-production-$(date +%F)
```

Do not record or publish Telegram output from a local harness as if it were a real Telegram chat. The credentialed path above is the one to use for the public Telegram demo.
