# Zalo Official Account Demo

This demo shows a Zalo Official Account adding Remix.Camera companion-image commands through OA webhooks and message sends.

## One-Step Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=zalo
```

The setup command pairs the local Remix.Camera bridge and prints the Zalo adapter path.

## Run Lily Proof Bot

```bash
ZALO_ACCESS_TOKEN=... \
ZALO_APP_SECRET=... \
REMIX_CONFIG_FILE=$HOME/.remix-camera/sillytavern-bridge.json \
node adapters/zalo/lily-webhook-server.mjs
```

Expose the server over HTTPS and set your Zalo OA webhook URL to:

```text
https://your-host.example/zalo/webhook
```

## Demo Script

1. Open the Zalo OA chat.
2. Send `help`.
3. Send `preview selfie cozy couch with lamp light`.
4. Confirm the dry-run preview contains a Remix.Camera prompt/template and does not spend credits.
5. Send `selfie cozy couch with lamp light`.
6. Confirm the OA sends an image consultation message using a public Remix.Camera `productionImageUrl`.
7. Send `vacation Amalfi coast weekend` and confirm it asks for explicit `yes`.
8. Send `vacation yes Amalfi coast weekend` and confirm up to three cohesive images are sent.

## Expected Evidence

- Zalo OA webhook payload contains a user text message.
- `createRemixZaloTool` handles the inbound text.
- `handleWebhookDetailed` returns `handled: true`.
- Zalo `/v3.0/oa/message/cs` sends text and image media payloads.
- Local bridge URLs are not posted as broken image payloads.

## Recording Status

This runbook is demo-ready once a Zalo OA access token and public webhook URL are configured. Until then, bridge-backed verifier output is engineering evidence only, not a public Zalo host recording.
