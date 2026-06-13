# Remix.Camera for Microsoft Bot Framework

Use this adapter when you already have an Azure Bot Service, Bot Builder SDK, Web Chat, Direct Line, or other Bot Framework activity pipeline and want companion image tools without rewriting your bot.

## Install

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=bot-framework
```

The setup command pairs Remix.Camera, writes the local bridge config, and prints the adapter path.

## Wire Into An Existing Bot

```js
import { createRemixBotFrameworkTurnHandler } from "./adapters/bot-framework/remix-camera-bot-framework-handler.mjs";

const remixImages = createRemixBotFrameworkTurnHandler({
  bridgeUrl: process.env.REMIX_BRIDGE_URL || "http://127.0.0.1:8787",
  characterName: "Lily",
});

// Inside your existing activity handler:
await remixImages(turnContext, async () => {
  // Existing bot behavior for non-Remix messages.
});
```

Supported user messages:

```text
preview selfie cozy couch with lamp light
preview date rooftop dinner
generate selfie yes cozy couch with lamp light
generate couple yes cozy cabin weekend with me
```

Direct commands such as `selfie cafe mirror` are treated as no-spend previews. Generation requires `generate` plus `yes`.

## Activity Payloads

You can also route structured activities into the adapter:

```json
{
  "type": "invoke",
  "name": "remix_camera_send_selfie_preview",
  "value": {
    "command": "send-selfie",
    "action": "dry-run",
    "prompt": "cozy couch with lamp light",
    "characterName": "Lily"
  }
}
```

Generated image responses use Bot Framework Hero Card attachments with `contentType: "application/vnd.microsoft.card.hero"`.

## Safety

- Dry-run is the default.
- `action=generate` is refused unless `yes=true` or the user includes `yes` in the generate message.
- The adapter returns Bot Framework activities; your bot stays responsible for authentication, channel registration, and delivery.
