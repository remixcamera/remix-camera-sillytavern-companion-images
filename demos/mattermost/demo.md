# Mattermost Demo

## Goal

Show Lily sending real Remix.Camera companion images inside Mattermost through a slash command, outgoing webhook, or incoming-webhook backed bot server.

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=mattermost
```

This pairs the local Remix.Camera bridge and prints the adapter path.

## Mattermost Configuration

1. In Mattermost, create a custom slash command such as `/lily`.
2. Set the request URL to your hosted adapter endpoint, for example `https://your-bot.example.com/mattermost/remix`.
3. Copy the generated token into `MATTERMOST_TOKEN`.
4. Optionally create an incoming webhook for async demo delivery and set `MATTERMOST_WEBHOOK_URL`.
5. Keep the local bridge running with the paired Remix.Camera session.

## Demo Script

Use a no-spend preview first:

```text
/lily preview selfie cozy couch with lamp light
```

Expected response:

- Mattermost receives a JSON slash-command response.
- The response says the preview is ready.
- The preview references a real Remix.Camera prompt-template choice.
- No generation credits are spent.

Then generate with explicit consent:

```text
/lily selfie cozy couch with lamp light
```

Expected response:

- Mattermost displays a Remix.Camera image attachment.
- The image URL is a public `productionImageUrl`, not `127.0.0.1`.
- The image matches Lily's Remix.Camera character profile.

Consent-gated couple photo:

```text
/lily vacation Amalfi coast weekend
/lily vacation yes Amalfi coast weekend
```

Expected response:

- First message refuses to spend credits without `yes`.
- Second message creates a three-image cohesive couple vacation set.

## Pass Criteria

- Real Mattermost UI or API receives the response.
- Generated media comes from production Remix.Camera.
- No mocked images or placeholder URLs appear.
- Private/mature commands stay consent-gated.
