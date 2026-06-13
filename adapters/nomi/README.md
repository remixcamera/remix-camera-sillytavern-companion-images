# Remix.Camera for Nomi

Use this adapter when an external bot or app already talks to Nomi through the official Nomi API and should add Remix.Camera companion images to the same conversation.

Nomi's public API exposes text/JSON chat endpoints. This adapter does not pretend to inject native Nomi media. It calls Nomi for companion text when requested, calls Remix.Camera for the image, then returns text plus image payloads for your wrapping bot to send in Telegram, Discord, web chat, or another host.

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=nomi
```

Set these environment variables in the process that hosts your wrapper:

```bash
NOMI_API_KEY=...
NOMI_UUID=...
REMIX_BRIDGE_URL=http://127.0.0.1:8787
```

Room mode can use:

```bash
NOMI_ROOM_UUID=...
NOMI_REQUEST_NOMI_UUID=...
```

## Usage

```js
import { runRemixCameraNomiTurn } from "./adapters/nomi/remix-camera-nomi-tool.mjs";

const result = await runRemixCameraNomiTurn({
  callNomi: true,
  userMessage: "send me a cozy couch selfie",
  action: "dry-run",
  characterName: "Lily"
});

for (const message of result.messages) {
  // Send text messages and image payloads from your own bot.
}
```

Generation is guarded:

- `action: "dry-run"` previews only.
- `action: "generate"` requires `yes: true`.
- Couple and vacation images should include user consent plus a user-owned reference photo URL when needed.

Official Nomi endpoints used by this adapter:

- `POST /v1/nomis/:id/chat`
- `POST /v1/rooms/:id/chat`
- `POST /v1/rooms/:id/chat/request`

