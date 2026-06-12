# LINE Demo

## Setup

1. Run the Remix.Camera setup flow:

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=line
```

2. Create a LINE Messaging API channel and enable webhooks.
3. Start the local bridge and Lily webhook server:

```bash
LINE_CHANNEL_ACCESS_TOKEN=... \
LINE_CHANNEL_SECRET=... \
REMIX_BRIDGE_URL=http://127.0.0.1:8787 \
node adapters/line/lily-webhook-server.mjs
```

4. Expose the server over HTTPS and set the webhook URL in the LINE Developers Console.

## Demo Flow

1. Send `preview selfie cozy couch with lamp light`. Confirm LINE replies with the selected Remix.Camera template without spending credits.
2. Send `selfie cozy couch with lamp light`. Confirm LINE replies with a real production Remix.Camera image URL rendered as an image message.
3. Send `couple coffee shop booth`. Confirm LINE asks for explicit `yes` and does not call generation.
4. Send `couple yes coffee shop booth with me`. Confirm the bridge accepts the consented couple-photo flow.
5. Send `snap yes warm bedroom mirror snap`. Confirm LINE replies with the image plus the private-media retention warning.

Record the LINE chat, the webhook signature verification log, the local bridge dry-run/generate calls, and the resulting LINE image message. Do not record a local harness as if it were a real LINE chat.

## Executable Evidence

Create no-spend bridge evidence for the LINE adapter:

```bash
node scripts/record-messaging-demo.mjs --target=line --output-dir=tmp/messaging-demo-evidence/line
```

Create a real LINE delivery proof:

```bash
LINE_CHANNEL_ACCESS_TOKEN=... \
LINE_TO=... \
node scripts/record-messaging-demo.mjs \
  --target=line \
  --deliver \
  --output-dir=demos/line/live-production-$(date +%F)
```

For a generated-image demo, add `--command="selfie cozy couch with lamp light" --yes --max-generations=1` after reviewing the command.
