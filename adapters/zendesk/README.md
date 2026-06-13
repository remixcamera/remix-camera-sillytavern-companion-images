# Remix.Camera Zendesk Sunshine Conversations Adapter

Use `adapters/zendesk/remix-zendesk-sunshine-tool.mjs` inside a Zendesk Sunshine Conversations webhook or bot service.

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=zendesk
```

Then call the reusable adapter:

```js
import {
  parseZendeskCommand,
  runZendeskRemixCommand,
  sendZendeskRemixResult,
} from "./adapters/zendesk/remix-zendesk-sunshine-tool.mjs";

const parsed = parseZendeskCommand("preview selfie cozy couch with lamp light");
const result = await runZendeskRemixCommand(parsed, {
  bridgeUrl: "http://127.0.0.1:8787",
  characterName: "Lily",
});

await sendZendeskRemixResult({
  subdomain: process.env.ZENDESK_SUBDOMAIN,
  appId: process.env.ZENDESK_APP_ID,
  conversationId: process.env.ZENDESK_CONVERSATION_ID,
  keyId: process.env.ZENDESK_KEY_ID,
  secret: process.env.ZENDESK_SECRET,
  result,
});
```

## Delivery

Zendesk Sunshine Conversations sends messages through:

```text
POST /sc/v2/apps/{app_id}/conversations/{conversation_id}/messages
```

The adapter sends a business text message, then one `content.type=image` message per public Remix.Camera `productionImageUrl`. It does not post local bridge URLs.

Preview never spends credits. `couple`, `vacation`, and `snap` require explicit `yes`.
