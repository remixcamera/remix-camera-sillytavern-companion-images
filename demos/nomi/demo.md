# Nomi Demo

Goal: use Nomi as the companion text brain and Remix.Camera as the image layer for an external bot.

## Dry-Run Demo

1. Pair the bridge:

   ```bash
   npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=nomi
   ```

2. In your wrapper process, set `NOMI_API_KEY`, `NOMI_UUID`, and `REMIX_BRIDGE_URL`.
3. Call `runRemixCameraNomiTurn` with:

   ```json
   {
     "callNomi": true,
     "userMessage": "send me a cozy couch selfie",
     "action": "dry-run",
     "characterName": "Lily"
   }
   ```

4. Send each returned `messages[]` item from the host bot. Dry-run returns preview text only and does not spend Remix.Camera credits.

## Generation Demo

After explicit confirmation, call with `action=generate` and `yes=true`, then send returned `type=image` payloads from your wrapper bot.

Do not publish a public Nomi demo unless the recording shows the real wrapping bot, the official Nomi API response, and real Remix.Camera image payloads. Nomi's official API does not provide native media injection for generated companion images; the wrapping bot owns media delivery.

