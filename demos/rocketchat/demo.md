# Rocket.Chat Demo

## Goal

Show Lily sending real Remix.Camera companion images inside Rocket.Chat through an outgoing integration, Apps-Engine slash command, or existing bot server.

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=rocketchat
```

This pairs the local Remix.Camera bridge and prints the adapter path.

## Rocket.Chat Configuration

1. Create a bot user or integration user with permission to post in the target room.
2. Configure an outgoing integration with trigger words such as `selfie`, `preview`, `daily`, `date`, `couple`, `vacation`, and `snap`.
3. Set the integration target URL to your hosted adapter endpoint, for example `https://your-bot.example.com/rocketchat/remix`.
4. Copy the outgoing integration token into `ROCKETCHAT_WEBHOOK_TOKEN`.
5. For REST delivery, set `ROCKETCHAT_URL`, `ROCKETCHAT_AUTH_TOKEN`, `ROCKETCHAT_USER_ID`, and `ROCKETCHAT_ROOM_ID`.

## Demo Script

Use a no-spend preview first:

```text
preview selfie cozy couch with lamp light
```

Expected response:

- Rocket.Chat receives a structured message body.
- The preview says it is ready.
- The preview references a real Remix.Camera prompt-template choice.
- No generation credits are spent.

Then generate with explicit intent:

```text
selfie cozy couch with lamp light
```

Expected response:

- Rocket.Chat posts a message with image attachments.
- The image URL is a public `productionImageUrl`, not `127.0.0.1`.
- The result matches Lily's Remix.Camera profile.

Consent-gated private snap:

```text
snap bedroom mirror
snap yes bedroom mirror
```

Expected response:

- First message refuses to spend credits without `yes`.
- Second message routes as a mature private snap with conservative copy.

## Pass Criteria

- Real Rocket.Chat UI or API receives the response.
- Generated media comes from production Remix.Camera.
- No mocked images or placeholder URLs appear.
- Couple, vacation, and private-snap generation stay consent-gated.
