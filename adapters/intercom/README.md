# Remix.Camera Intercom Adapter

Use `adapters/intercom/remix-intercom-tool.mjs` inside an existing Intercom webhook or bot service to turn companion image commands into Remix.Camera bridge calls.

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=intercom
```

Then route incoming conversation text to:

```js
import {
  parseIntercomCommand,
  runIntercomRemixCommand,
  sendIntercomRemixResult,
} from "./adapters/intercom/remix-intercom-tool.mjs";

const parsed = parseIntercomCommand("preview selfie cozy couch with lamp light");
const result = await runIntercomRemixCommand(parsed, {
  bridgeUrl: "http://127.0.0.1:8787",
  characterName: "Lily",
});

await sendIntercomRemixResult({
  accessToken: process.env.INTERCOM_ACCESS_TOKEN,
  conversationId: process.env.INTERCOM_CONVERSATION_ID,
  adminId: process.env.INTERCOM_ADMIN_ID,
  result,
});
```

## Delivery

Intercom uses `POST /conversations/{id}/reply`. The adapter sends admin comments with `attachment_urls`, so images must be public Remix.Camera `productionImageUrl` values. Local bridge image URLs such as `127.0.0.1` are never posted as broken Intercom attachments.

Commands:

- `selfie cafe mirror selfie`
- `date quiet restaurant booth`
- `daily morning coffee on the couch`
- `outfit https://example.com/outfit.jpg red sundress`
- `couple yes coffee shop booth with me`
- `vacation yes Amalfi coast weekend`
- `snap yes warm bedroom mirror snap`
- `preview selfie cozy couch with lamp light`

Preview never spends credits. `couple`, `vacation`, and `snap` require explicit `yes`.
