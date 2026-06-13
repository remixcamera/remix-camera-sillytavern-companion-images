# Remix.Camera for Zapier

Use this adapter when a Zapier-powered chatbot or workflow should ask Remix.Camera for companion images and pass the result into another app.

## Setup

1. Pair and start the bridge:

   ```bash
   npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=zapier
   ```

2. Start a Zapier Platform CLI integration using `adapters/zapier/remix-camera-zapier-app/index.cjs` as the app definition.
3. Configure the action `Preview or Generate Companion Image`.
4. Set `Bridge URL` to a URL Zapier can reach.

For local CLI testing, `http://127.0.0.1:8787` is fine. For Zapier cloud Zaps, use a public HTTPS bridge URL or a secure development tunnel; Zapier cloud cannot call your laptop's `127.0.0.1` directly.

## Behavior

- Defaults to `dry-run`, which returns a reviewable prompt/template preview.
- Calls `/v1/tools/:command/generate` only when `action=generate` and `yes=true`.
- Returns `text`, `imageUrl`, `imageUrls`, and raw `payload` for downstream Zap steps.
- Keep image sending in the next Zap step, such as Telegram, Discord, Slack, email, webhook, or CRM message modules.

This follows Zapier Platform CLI's create-action pattern.

