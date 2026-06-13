# Viber Demo

This demo shows a real Viber bot adding Remix.Camera companion-image commands through the Viber Bot REST API.

## One-Step Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=viber
```

The setup command pairs the local Remix.Camera bridge and prints the Viber adapter path.

## Run Lily Proof Bot

```bash
VIBER_AUTH_TOKEN=... \
REMIX_CONFIG_FILE=$HOME/.remix-camera/sillytavern-bridge.json \
node adapters/viber/lily-webhook-server.mjs
```

Expose the server over HTTPS and set your Viber bot webhook URL to:

```text
https://your-host.example/viber/webhook
```

## Demo Script

1. Open the Viber bot chat.
2. Send `help`.
3. Send `preview selfie cozy couch with lamp light`.
4. Confirm the dry-run preview contains a Remix.Camera prompt/template and does not spend credits.
5. Send `selfie cozy couch with lamp light`.
6. Confirm the bot sends a real Viber picture message from a public Remix.Camera `productionImageUrl`.
7. Send `vacation Amalfi coast weekend` and confirm it asks for explicit `yes`.
8. Send `vacation yes Amalfi coast weekend` and confirm up to three cohesive images are sent.

## Expected Evidence

- Viber webhook request received and verified with `x-viber-content-signature`.
- `createRemixViberTool` handles the inbound text.
- `handleWebhookDetailed` returns `handled: true`.
- Viber `send_message` calls include `type: "picture"` for generated outputs.
- Local bridge URLs are not posted as broken Viber images.

## Recording Status

This runbook is demo-ready once a Viber bot token and public webhook URL are configured. Until then, bridge-backed verifier output is engineering evidence only, not a public Viber host recording.
