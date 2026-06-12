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
