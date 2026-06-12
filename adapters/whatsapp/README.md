# WhatsApp Adapter

The WhatsApp adapter lets a Meta WhatsApp Cloud API bot call the local Remix.Camera bridge and send generated images back into WhatsApp.

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=whatsapp
```

The reusable module is:

```text
adapters/whatsapp/remix-whatsapp-tool.mjs
```

Lily proof-of-concept webhook:

```bash
WHATSAPP_ACCESS_TOKEN=... \
WHATSAPP_PHONE_NUMBER_ID=... \
WHATSAPP_VERIFY_TOKEN=choose-a-secret \
REMIX_BRIDGE_URL=http://127.0.0.1:8787 \
node adapters/whatsapp/lily-webhook-server.mjs
```

Expose that server over HTTPS and set the Meta app webhook callback URL to the exposed URL. Use the same `WHATSAPP_VERIFY_TOKEN` for webhook verification.

## Commands

Users can send:

```text
selfie cafe mirror selfie
date quiet restaurant booth
daily morning coffee on the couch
outfit https://example.com/outfit.jpg red sundress
couple yes coffee shop booth with me
vacation yes Amalfi coast weekend
snap yes warm bedroom mirror snap
preview selfie cozy couch with lamp light
```

Couple and private commands require `yes` before spending credits.

## Media Behavior

WhatsApp cannot fetch `127.0.0.1` bridge image URLs, so the adapter uploads local bridge images to the WhatsApp Cloud API media endpoint before sending them.

WhatsApp bots cannot force-delete media already delivered to a user's chat. For private snaps, use WhatsApp disappearing messages in the chat. The adapter sends a clear note instead of pretending deletion is guaranteed.
