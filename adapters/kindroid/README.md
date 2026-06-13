# Remix.Camera for Kindroid

Use this adapter when a bot or app already uses the official Kindroid API and should add Remix.Camera companion images to the outgoing reply.

Kindroid's public API and official Discord bot endpoint return text. This adapter keeps that boundary honest: Kindroid remains the companion text brain, Remix.Camera produces image previews or generated image URLs, and your wrapping bot sends the returned text/image payloads to Discord, Telegram, web chat, or another host.

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=kindroid
```

Set these environment variables in the process that hosts your wrapper:

```bash
KINDROID_API_KEY=...
KINDROID_AI_ID=...
REMIX_BRIDGE_URL=http://127.0.0.1:8787
```

For the official Discord bot endpoint:

```bash
KINDROID_SHARE_CODE=...
```

For group chats:

```bash
KINDROID_GROUP_ID=...
```

## Usage

```js
import { runRemixCameraKindroidTurn } from "./adapters/kindroid/remix-camera-kindroid-tool.mjs";

const result = await runRemixCameraKindroidTurn({
  callKindroid: true,
  userMessage: "send me a couch selfie",
  action: "dry-run",
  characterName: "Lily"
});

for (const message of result.messages) {
  // Send text messages and image payloads from your own bot.
}
```

Official Kindroid flows supported:

- Single AI: `POST /send-message`
- Group chat turn loop: `POST /groupchats-user-message`, `POST /groupchats-get-turn`, `POST /groupchats-ai-response`
- Discord bot endpoint: `POST /discord-bot` with `X-Kindroid-Requester`

Generation is guarded:

- `action: "dry-run"` previews only.
- `action: "generate"` requires `yes: true`.
- The Discord requester hash follows Kindroid's documented `X-Kindroid-Requester` guidance.

