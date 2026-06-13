# Twilio SMS/MMS Demo

## Setup

1. Run the Remix.Camera setup flow:

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=twilio
```

2. Configure a Twilio phone number or Messaging Service with an inbound webhook URL.
3. Start the local Remix.Camera bridge, then run your Twilio webhook server with:

```bash
TWILIO_ACCOUNT_SID=... \
TWILIO_AUTH_TOKEN=... \
TWILIO_FROM=... \
TWILIO_MESSAGING_SERVICE_SID=... \
REMIX_BRIDGE_URL=http://127.0.0.1:8787 \
node your-twilio-webhook.mjs
```

## Demo Flow

1. Text `preview selfie cozy couch with lamp light`. Confirm SMS replies with the selected Remix.Camera template without spending credits.
2. Text `selfie cozy couch with lamp light`. Confirm MMS replies with a real production Remix.Camera image through `MediaUrl`.
3. Text `couple coffee shop booth`. Confirm the bot asks for explicit `yes` and does not call generation.
4. Text `couple yes coffee shop booth with me`. Confirm the bridge accepts the consented couple-photo flow.
5. Text `snap yes warm bedroom mirror snap`. Confirm MMS replies with the image plus conservative retention copy.

Record the real SMS/MMS conversation, Twilio request logs, bridge logs, and Messages API response. Do not record a local harness as if it were a real phone conversation.

## Executable Evidence

Create no-spend bridge evidence for the Twilio adapter:

```bash
npm run demo:verify -- --bridge-url=http://127.0.0.1:8787 --output-dir=demos/evidence
```

For a generated-image demo, use one command, add explicit `yes` where required, and cap the run at one generation unless intentionally recording a multi-image set.
