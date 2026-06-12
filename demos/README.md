# Remix.Camera Companion Image Demos

Each folder is a host-specific demo runbook. The demos all use the same bridge contract:

1. Run `npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=<target>`.
2. Approve the Remix.Camera pairing code.
3. Run the host adapter.
4. Preview first, then generate only after explicit user intent.

Targets:

- `sillytavern/`: existing polished SillyTavern extension demo.
- `sillytavern/live-production-2026-06-12/`: real production SillyTavern screen recording, one live Lily selfie generation, no mocked output.
- `risu/`: RisuAI MCP plugin demo.
- `openwebui/`: Open WebUI native Tool demo.
- `librechat/`: LibreChat OpenAPI Action demo.
- `lobechat/`: LobeChat plugin manifest demo.
- `agnai/`: Agnai userscript demo.
- `telegram/`: reusable Telegram bot tool plus Lily proof-of-concept demo.
- `telegram/evidence-production-2026-06-12/`: production bridge dry-run evidence for the reusable Telegram tool; real Telegram send path is documented but awaits Bot API credentials.
- `discord/`: Discord slash-command tool plus Lily proof-of-concept demo.
- `whatsapp/`: WhatsApp Cloud API tool plus Lily proof-of-concept webhook demo.
- `slack/`: Slack slash-command tool plus Lily proof-of-concept demo.
- `line/`: LINE Messaging API tool plus Lily proof-of-concept webhook demo.
- `messenger/`: Messenger Platform tool plus Lily proof-of-concept webhook demo.
- `matrix/`: Matrix bot tool plus Lily proof-of-concept sync demo.
- `dify/`: Dify OpenAPI custom tool demo.
- `flowise/`: Flowise Custom Tool demo.
- `botpress/`: Botpress Execute Code card or Action demo.

Do not publish generated demo recordings until the runbook has been executed against production Remix.Camera and the inserted images are real Remix.Camera outputs.

## Executable Verification

Run a static adapter/demo preflight:

```bash
npm run demo:verify
```

This writes:

```text
tmp/adapter-demo-verification/adapter-demo-evidence.json
tmp/adapter-demo-verification/adapter-demo-evidence.md
tmp/adapter-demo-verification/adapter-demo-evidence.html
```

Run against a paired local bridge to verify real Remix.Camera dry-run previews without spending credits:

```bash
REMIX_BRIDGE_URL=http://127.0.0.1:8787 npm run demo:verify
```

The verifier does not fabricate generated image outputs. Real video demos should be recorded from the target host after the dry-run evidence is clean, then generation should be triggered only with explicit user intent.

## Messaging Host Demo Recorder

Use the messaging recorder to create per-host, non-mocked demo evidence for Telegram, Discord, WhatsApp, Slack, LINE, Messenger, and Matrix.

No-spend bridge evidence for every messaging adapter:

```bash
node scripts/record-messaging-demo.mjs --target=all --output-dir=tmp/messaging-demo-evidence
```

Credentialed real host delivery for one platform:

```bash
TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... \
node scripts/record-messaging-demo.mjs \
  --target=telegram \
  --deliver \
  --output-dir=demos/telegram/live-production-$(date +%F)
```

Credentialed real generation and host delivery, capped to one Remix.Camera generation:

```bash
TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... \
node scripts/record-messaging-demo.mjs \
  --target=telegram \
  --command="/selfie cozy couch with lamp light" \
  --yes \
  --max-generations=1 \
  --deliver \
  --output-dir=demos/telegram/live-production-$(date +%F)
```

The recorder writes `result.json`, `transcript.md`, and `transcript.html`. It refuses to spend credits unless `--yes` is present and the planned generation count is at or below `--max-generations`.

Delivery environment variables:

| Target | Required for real host delivery |
| --- | --- |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` |
| Discord | `DISCORD_WEBHOOK_URL` |
| WhatsApp | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TO` |
| Slack | `SLACK_BOT_TOKEN`, `SLACK_CHANNEL_ID` |
| LINE | `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_TO` |
| Messenger | `MESSENGER_PAGE_ACCESS_TOKEN`, `MESSENGER_RECIPIENT_ID` |
| Matrix | `MATRIX_HOMESERVER_URL`, `MATRIX_ACCESS_TOKEN`, `MATRIX_ROOM_ID` |

Do not use `--deliver` for public demo evidence unless the message lands in the real host. If delivery credentials are absent, the recorder labels the output as bridge-only evidence rather than host delivery.

## Current Production Dry-Run Evidence

The committed production dry-run snapshot lives here:

```text
demos/evidence/adapter-demo-evidence.md
demos/evidence/adapter-demo-evidence.json
demos/evidence/adapter-demo-evidence.html
```

Refresh it from a paired bridge without spending credits:

```bash
REMIX_BRIDGE_URL=http://127.0.0.1:8787 npm run demo:verify -- --output-dir=demos/evidence
```
