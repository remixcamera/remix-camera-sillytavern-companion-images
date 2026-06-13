# Microsoft Bot Framework Demo

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=bot-framework
```

Start the local bridge, then import `adapters/bot-framework/remix-camera-bot-framework-handler.mjs` into an existing Bot Framework bot.

## Dry-Run Preview

Send this message to the bot:

```text
preview selfie cozy couch with lamp light
```

Expected result:

- The adapter calls `POST /v1/tools/send-selfie/dry-run`.
- No credits are spent.
- The bot replies with a Bot Framework message activity containing the Remix.Camera preview prompt.

## Confirmed Generation

Send this message after the user explicitly confirms:

```text
generate selfie yes cozy couch with lamp light
```

Expected result:

- The adapter calls `POST /v1/tools/send-selfie/generate`.
- The outgoing activity includes a Hero Card attachment with the generated image URL.
- Removing `yes` refuses generation before the bridge spends credits.

## Evidence To Record

For a production host demo, capture Bot Framework Emulator, Web Chat, or the deployed channel receiving the preview and then the confirmed Hero Card image.
