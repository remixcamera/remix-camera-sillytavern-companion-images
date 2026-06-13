# Matrix Adapter

The Matrix adapter lets a Matrix bot call the local Remix.Camera bridge and send generated images as Matrix `m.image` messages.

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=matrix
```

## Reusable Tool

```js
import { createRemixMatrixTool } from "./adapters/matrix/remix-matrix-tool.mjs";

const remix = createRemixMatrixTool({
  homeserverUrl: process.env.MATRIX_HOMESERVER_URL,
  accessToken: process.env.MATRIX_ACCESS_TOKEN,
  bridgeUrl: "http://127.0.0.1:8787",
  profileId: process.env.REMIX_PROFILE_ID,
  characterName: "Lily",
});
```

For an existing Matrix bot, keep your own sync loop and delivery:

```js
if (remix.shouldHandleTextEvent(matrixEvent, { requirePrefix: true })) {
  const details = await remix.handleTextEventDetailed(matrixEvent, {
    autoSend: false,
  });
  await yourBot.sendImages(details.roomId, details.result.imageUrls);
}
```

Use `handleSyncDetailed(syncPayload, { autoSend: false })` when you want the adapter to extract matching events but your bot still owns sending, auditing, or rate limits. The simple `handleTextEvent()` and `handleSync()` helpers still send automatically when credentials are configured.

The tool parses direct-room messages such as:

```text
selfie cozy couch with lamp light
preview date quiet restaurant booth
couple yes coffee shop booth with me
snap yes warm bedroom mirror snap
```

In shared rooms, prefix commands with `!lily` by default:

```text
!lily selfie cozy couch with lamp light
```

Couple, vacation, and private commands require explicit `yes` before any generation request is sent to the bridge.

## Lily Proof Of Concept

```bash
MATRIX_HOMESERVER_URL=https://matrix.example \
MATRIX_ACCESS_TOKEN=... \
MATRIX_ROOM_ID='!room:id' \
REMIX_BRIDGE_URL=http://127.0.0.1:8787 \
node adapters/matrix/lily-sync-bot.mjs
```

The proof bot uses the Matrix Client-Server `/sync` API, ignores its own messages, calls the bridge, uploads returned image bytes to the homeserver media repository, and sends `m.image` events into the room.

Matrix does not render arbitrary HTTP URLs as native image events. The adapter uploads both local bridge URLs and public production URLs to Matrix media and sends the resulting `mxc://` URI.
