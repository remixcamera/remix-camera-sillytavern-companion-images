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

