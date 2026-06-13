# Kindroid Demo

Goal: use Kindroid as the companion text brain and Remix.Camera as the image layer for an external bot or the official Kindroid Discord bot integration.

## Dry-Run Demo

1. Pair the bridge:

   ```bash
   npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=kindroid
   ```

2. In your wrapper process, set `KINDROID_API_KEY`, `KINDROID_AI_ID`, and `REMIX_BRIDGE_URL`.
3. Call `runRemixCameraKindroidTurn` with:

   ```json
   {
     "callKindroid": true,
     "userMessage": "send me a couch selfie",
     "action": "dry-run",
     "characterName": "Lily"
   }
   ```

4. Send each returned `messages[]` item from the host bot. Dry-run returns preview text only and does not spend Remix.Camera credits.

## Discord Bot Endpoint Demo

For a Discord bot that already uses Kindroid's official endpoint, pass the Discord-style conversation and `shareCode`:

```json
{
  "kindroidMode": "discord-bot",
  "callKindroid": true,
  "shareCode": "abcde",
  "conversation": [
    { "username": "user-123", "text": "send a cafe selfie", "timestamp": "2026-06-13T12:00:00.000Z" }
  ],
  "action": "dry-run",
  "characterName": "Lily"
}
```

The adapter sends Kindroid's documented `X-Kindroid-Requester` header and appends Remix.Camera messages for the Discord bot to deliver.

## Generation Demo

After explicit confirmation, call with `action=generate` and `yes=true`, then send returned `type=image` payloads from your wrapper bot.

Do not publish a public Kindroid demo unless the recording shows the real wrapping bot, the official Kindroid API response, and real Remix.Camera image payloads. Kindroid's official API returns text responses; the wrapping bot owns media delivery.

