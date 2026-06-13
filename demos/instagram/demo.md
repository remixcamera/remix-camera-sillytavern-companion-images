# Instagram DMs Demo

## Setup

1. Run the Remix.Camera setup flow:

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=instagram
```

2. Create or open a Meta app with Instagram Messaging enabled for an Instagram professional account.
3. Connect your webhook endpoint and verify `x-hub-signature-256` before processing messages.
4. Start the local Remix.Camera bridge, then run your Instagram webhook server with:

```bash
INSTAGRAM_ACCESS_TOKEN=... \
INSTAGRAM_IG_ID=... \
REMIX_BRIDGE_URL=http://127.0.0.1:8787 \
node your-instagram-bot.mjs
```

## Demo Flow

1. Send `preview selfie cozy couch with lamp light`. Confirm Instagram replies with the selected Remix.Camera template without spending credits.
2. Send `selfie cozy couch with lamp light`. Confirm Instagram replies with a real production Remix.Camera image attachment.
3. Send `couple coffee shop booth`. Confirm the bot asks for explicit `yes` and does not call generation.
4. Send `couple yes coffee shop booth with me`. Confirm the bridge accepts the consented couple-photo flow.
5. Send `snap yes warm bedroom mirror snap`. Confirm Instagram replies with the image plus the private-media retention warning.

Record the real Instagram DM conversation, Meta webhook signature verification, bridge logs, and image attachment response. Do not record a local harness as if it were a real Instagram chat.

## Executable Evidence

Create no-spend bridge evidence for the Instagram adapter:

```bash
npm run demo:verify -- --bridge-url=http://127.0.0.1:8787 --output-dir=demos/evidence
```

For a generated-image demo, use one command, add explicit `yes` where required, and cap the run at one generation unless intentionally recording a multi-image set.
