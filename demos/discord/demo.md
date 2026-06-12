# Discord Demo

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=discord
```

Register commands:

```bash
DISCORD_BOT_TOKEN=... DISCORD_APPLICATION_ID=... node adapters/discord/register-commands.mjs
```

Run Lily interactions server:

```bash
DISCORD_PUBLIC_KEY=... DISCORD_APPLICATION_ID=... node adapters/discord/lily-interactions-server.mjs
```

## Demo Flow

1. In Discord, run `/preview tool:send-selfie prompt:cozy couch with lamp light`.
2. Run `/selfie prompt:cozy couch with lamp light`.
3. Run `/date prompt:quiet restaurant booth`.
4. Run `/couple yes:true prompt:coffee shop booth`.
5. Run `/vacation yes:true prompt:Amalfi coast weekend`.

## Proof Points

- Discord signatures are verified before any work runs.
- The response is deferred, then Remix.Camera results are sent as webhook follow-ups.
- Local bridge image URLs are uploaded as files.
- Couple/private commands require explicit `yes`.

