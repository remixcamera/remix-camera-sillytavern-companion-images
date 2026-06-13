# Discord Adapter

Discord has two deliverables:

- `remix-discord-tool.mjs`: reusable Discord Interactions helpers.
- `lily-interactions-server.mjs`: Lily proof-of-concept interactions server.

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=discord
```

## Register Commands

```bash
DISCORD_BOT_TOKEN=... \
DISCORD_APPLICATION_ID=... \
node adapters/discord/register-commands.mjs
```

Use `DISCORD_GUILD_ID=...` for fast guild-scoped testing.

## Lily Proof Of Concept

```bash
DISCORD_PUBLIC_KEY=... \
DISCORD_APPLICATION_ID=... \
node adapters/discord/lily-interactions-server.mjs
```

Expose this server over HTTPS and set the Discord application's Interactions Endpoint URL.

The server verifies Discord Ed25519 signatures, defers slash-command responses, calls the local Remix.Camera bridge, then sends follow-up messages with uploaded image files when the bridge returns local image URLs.

## Existing Bot Integration

```js
import { createRemixDiscordTool } from "./adapters/discord/remix-discord-tool.mjs";

const remix = createRemixDiscordTool({
  applicationId: process.env.DISCORD_APPLICATION_ID,
  bridgeUrl: "http://127.0.0.1:8787",
  profileId: process.env.REMIX_PROFILE_ID,
  characterName: "Lily",
});

if (remix.shouldHandleInteraction(interaction)) {
  await remix.handleInteractionDetailed(interaction);
}
```

Use `handleInteractionDetailed(interaction, { autoSend: false })` when your bot framework already handles deferred replies or file uploads. The detailed result includes the parsed Remix.Camera command, generated image URLs, and any Discord webhook message records returned by auto-send.
