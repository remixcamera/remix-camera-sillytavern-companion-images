# Remix.Camera for Make

Use this adapter when a Make scenario is already powering a chatbot, CRM responder, Discord/Telegram relay, or scheduled companion workflow and needs Remix.Camera image tools.

## Setup

1. Pair and start the bridge:

   ```bash
   npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=make
   ```

2. In Make Custom Apps, create an action module named `Preview or Generate Companion Image`.
3. Copy the module shape from `adapters/make/remix-camera-make-action-module.json`.
4. Set `Bridge URL` to a URL the Make scenario can reach.

For local testing, use `http://127.0.0.1:8787` only when Make is running locally or through a reachable tunnel. Make's cloud runner cannot call your laptop's `127.0.0.1` directly.

## Behavior

- Defaults to `dry-run`, so previewing does not spend Remix.Camera credits.
- Calls `/v1/tools/:command/generate` only when `action=generate` and `yes=true`.
- For couple photos and vacation sets, pass `userConsent=yes` and a user-owned `userReferenceImageUrl` when available.
- Send the returned `text` and `imageUrl` fields into the next Make bot/message module.

The Make Custom Apps action-module format follows Make's documented action-module and communication blocks.

