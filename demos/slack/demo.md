# Slack Demo

## Setup

1. Run the Remix.Camera setup flow:

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=slack
```

2. Create a Slack app with a slash command such as `/lily`.
3. Set the slash-command Request URL to your hosted Lily server:

```text
https://your-host.example/slack/commands
```

4. Start the local bridge and Lily proof server:

```bash
SLACK_SIGNING_SECRET=... \
SLACK_BOT_TOKEN=xoxb-... \
REMIX_BRIDGE_URL=http://127.0.0.1:8787 \
node adapters/slack/lily-slash-command-server.mjs
```

## Demo Flow

1. Send `/lily preview selfie cozy couch with lamp light`. Confirm Slack returns the selected Remix.Camera template without spending credits.
2. Send `/lily selfie cozy couch with lamp light`. Confirm Slack replies with a real Remix.Camera image.
3. Send `/lily couple coffee shop booth`. Confirm Slack asks for explicit `yes` and does not call generation.
4. Send `/lily couple yes coffee shop booth with me`. Confirm the bridge accepts the consented couple-photo flow.
5. Send `/lily snap yes warm bedroom mirror snap`. Confirm Slack posts the result plus the private-media retention warning.

## What To Record

- Slack slash-command request accepted by the proof server.
- Bridge health check and dry-run route.
- Slack conversation showing preview, consent guard, and generated image response.
- For local bridge image URLs, show Slack receiving uploaded files rather than a `127.0.0.1` URL.

For cloud-hosted Slack servers, expose the local bridge through a private authenticated tunnel or run the bridge next to the Slack bot server. Do not expose an unauthenticated bridge to the public internet.

## Executable Evidence

Create no-spend bridge evidence for the Slack adapter:

```bash
npm run demo:messaging -- --target=slack --output-dir=tmp/messaging-demo-evidence/slack
```

Create a real Slack delivery proof:

```bash
SLACK_BOT_TOKEN=... \
SLACK_CHANNEL_ID=... \
npm run demo:messaging:deliver -- \
  --target=slack \
  --output-dir=demos/slack/live-production-$(date +%F)
```

For a generated-image demo, add `--command="selfie cozy couch with lamp light" --yes --max-generations=1` after reviewing the command.
