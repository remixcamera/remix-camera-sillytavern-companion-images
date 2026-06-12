# WhatsApp Demo

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=whatsapp
```

## Demo Script

1. Start the Remix.Camera bridge from setup.
2. Start Lily's WhatsApp webhook server:

   ```bash
   WHATSAPP_ACCESS_TOKEN=... \
   WHATSAPP_PHONE_NUMBER_ID=... \
   WHATSAPP_VERIFY_TOKEN=choose-a-secret \
   REMIX_BRIDGE_URL=http://127.0.0.1:8787 \
   node adapters/whatsapp/lily-webhook-server.mjs
   ```

3. Expose the webhook over HTTPS and connect it in the Meta app webhook settings.
4. Send `preview selfie cozy couch with lamp light` in WhatsApp. Confirm the bot replies with a dry-run prompt and does not spend credits.
5. Send `selfie cozy couch with lamp light`. Confirm the bot sends a real image message.
6. Send `couple coffee shop booth with me`. Confirm the bot refuses because `yes` is missing.
7. Send `couple yes coffee shop booth with me`. Confirm the bot sends the couple image after consent.
8. Send `snap yes warm bedroom mirror snap`. Confirm the bot sends the image and a note that WhatsApp disappearing messages control expiry.

## Demo Worthy Evidence

Record the Meta webhook request, the local bridge logs, and the resulting WhatsApp conversation. The adapter uploads local bridge images to WhatsApp media before sending, so the demo should show images as native WhatsApp media rather than localhost URLs.
