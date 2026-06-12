# Matrix Demo

## Setup

1. Run the Remix.Camera setup flow:

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=matrix
```

2. Create a Matrix bot account and invite it to the target room.
3. Start the local bridge and Lily sync bot:

```bash
MATRIX_HOMESERVER_URL=https://matrix.example \
MATRIX_ACCESS_TOKEN=... \
MATRIX_ROOM_ID='!room:id' \
REMIX_BRIDGE_URL=http://127.0.0.1:8787 \
node adapters/matrix/lily-sync-bot.mjs
```

## Demo Flow

1. Send `!lily preview selfie cozy couch with lamp light`. Confirm Matrix receives the selected Remix.Camera template without spending credits.
2. Send `!lily selfie cozy couch with lamp light`. Confirm Matrix receives a real `m.image` event uploaded to the homeserver.
3. Send `!lily couple coffee shop booth`. Confirm Matrix receives the explicit-yes guard and the bridge is not called.
4. Send `!lily couple yes coffee shop booth with me`. Confirm the bridge accepts the consented couple-photo flow.
5. Send `!lily snap yes warm bedroom mirror snap`. Confirm Matrix receives the image plus the private-media retention warning.

Record the real Matrix room, `/sync` processing, media upload, bridge logs, and resulting `m.image` event. Do not record a local harness as if it were a real Matrix conversation.
