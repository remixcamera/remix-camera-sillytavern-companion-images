# Remix.Camera Crisp Adapter

Use `adapters/crisp/remix-crisp-tool.mjs` inside a Crisp webhook, plugin, or existing operator-bot service.

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=crisp
```

Then call the reusable adapter:

```js
import {
  parseCrispCommand,
  runCrispRemixCommand,
  sendCrispRemixResult,
} from "./adapters/crisp/remix-crisp-tool.mjs";

const parsed = parseCrispCommand("preview selfie cozy couch with lamp light");
const result = await runCrispRemixCommand(parsed, {
  bridgeUrl: "http://127.0.0.1:8787",
  characterName: "Lily",
});

await sendCrispRemixResult({
  tokenId: process.env.CRISP_TOKEN_ID,
  tokenKey: process.env.CRISP_TOKEN_KEY,
  websiteId: process.env.CRISP_WEBSITE_ID,
  sessionId: process.env.CRISP_SESSION_ID,
  result,
});
```

## Delivery

Crisp sends conversation messages through:

```text
POST /v1/website/{website_id}/conversation/{session_id}/message
```

The adapter sends an operator `type=text` message, then `type=file` image messages with `content.url` set to public Remix.Camera `productionImageUrl` values. It authenticates with Basic auth and `X-Crisp-Tier: website` by default.

Preview never spends credits. `couple`, `vacation`, and `snap` require explicit `yes`.
