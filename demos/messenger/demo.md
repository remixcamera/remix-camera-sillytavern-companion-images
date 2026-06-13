# Messenger Demo

## Setup

1. Run the Remix.Camera setup flow:

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=messenger
```

2. Create or open a Meta app with Messenger enabled and connect a Page.
3. Start the local bridge and Lily webhook server:

```bash
MESSENGER_PAGE_ACCESS_TOKEN=... \
MESSENGER_APP_SECRET=... \
MESSENGER_VERIFY_TOKEN=... \
REMIX_BRIDGE_URL=http://127.0.0.1:8787 \
node adapters/messenger/lily-webhook-server.mjs
```

4. Expose the server over HTTPS and set the webhook URL in the Meta app.

## Demo Flow

1. Send `preview selfie cozy couch with lamp light`. Confirm Messenger replies with the selected Remix.Camera template without spending credits.
2. Send `selfie cozy couch with lamp light`. Confirm Messenger replies with a real production Remix.Camera image attachment.
3. Send `couple coffee shop booth`. Confirm Messenger asks for explicit `yes` and does not call generation.
4. Send `couple yes coffee shop booth with me`. Confirm the bridge accepts the consented couple-photo flow.
5. Send `snap yes warm bedroom mirror snap`. Confirm Messenger replies with the image plus the private-media retention warning.

Record the real Messenger conversation, webhook signature verification, bridge logs, and image attachment response. Do not record a local harness as if it were a real Messenger chat.

## Executable Evidence

Create no-spend bridge evidence for the Messenger adapter:

```bash
npm run demo:messaging -- --target=messenger --output-dir=tmp/messaging-demo-evidence/messenger
```

Create a real Messenger delivery proof:

```bash
MESSENGER_PAGE_ACCESS_TOKEN=... \
MESSENGER_RECIPIENT_ID=... \
npm run demo:messaging:deliver -- \
  --target=messenger \
  --output-dir=demos/messenger/live-production-$(date +%F)
```

For a generated-image demo, add `--command="selfie cozy couch with lamp light" --yes --max-generations=1` after reviewing the command.
