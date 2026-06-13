# VK Community Bot Demo Runbook

Evidence level: setup runbook, static adapter preflight, and bridge-backed dry-run.

## Goal

Show a real VK community bot using Remix.Camera to:

1. Preview a Lily selfie without spending credits.
2. Generate only after explicit user confirmation.
3. Send a production Remix.Camera image URL through VK `messages.send`.
4. Optionally upload a generated image as a VK photo attachment when the community token supports message photo upload.

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=vk --no-start
```

Start the local bridge:

```bash
REMIX_CONFIG_FILE=$HOME/.remix-camera/sillytavern-bridge.json \
REMIX_BRIDGE_PORT=8787 \
node bridge/server.mjs
```

Create the VK community bot:

1. Open the VK community where the bot should live.
2. Enable community messages.
3. Enable bot capabilities.
4. Create a community access token with messages access.
5. Configure Callback API or Long Poll delivery for `message_new` events.
6. Store `VK_ACCESS_TOKEN` and `VK_CALLBACK_SECRET` on the server, not in browser code.

## Existing Bot Integration

```js
import { createRemixVkTool } from "./adapters/vk/remix-vk-tool.mjs";

const remixVk = createRemixVkTool({
  bridgeUrl: "http://127.0.0.1:8787",
  accessToken: process.env.VK_ACCESS_TOKEN,
  callbackSecret: process.env.VK_CALLBACK_SECRET,
  characterName: "Lily",
  autoSend: true,
});

await remixVk.handleWebhookDetailed(vkCallbackPayload);
```

## Demo Conversation

User:

```text
preview selfie cozy couch with lamp light
```

Expected bot behavior:

- Calls the Remix bridge `/v1/tools/send-selfie/dry-run`.
- Returns a preview prompt and selected Remix.Camera prompt template.
- Does not spend credits.

User:

```text
selfie cozy couch with lamp light
```

Expected bot behavior:

- Calls the Remix bridge `/v1/tools/send-selfie/generate`.
- Sends the returned `productionImageUrl` through VK `messages.send`.
- Does not post a local `127.0.0.1` bridge URL.

User:

```text
vacation Amalfi coast weekend
```

Expected bot behavior:

- Refuses to spend credits because couple/vacation images require explicit `yes`.

User:

```text
vacation yes Amalfi coast weekend
```

Expected bot behavior:

- Calls the Remix bridge with consent and plans a three-image couples-vacation set.
- Sends production image URLs, or VK photo attachments when `attachImages: true` is configured.

## Pass Criteria

- `createRemixVkTool` handles VK `message_new` payloads.
- Callback secrets are checked when configured.
- Dry-runs return `dryRun: true`.
- Couple, vacation, and private snap generations refuse to run without explicit `yes`.
- Delivery uses `productionImageUrl` by default.
- Optional attachment mode uploads to VK before sending `photo<owner_id>_<media_id>` attachments.
- No screenshots, transcripts, or images are mocked.
