# Remix.Camera Tidio Adapter

Use `adapters/tidio/remix-tidio-tool.mjs` as a Tidio webhook, OpenAPI ticket-reply, or widget sidecar.

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=tidio
```

Then route webhook text to the adapter:

```js
import {
  parseTidioCommand,
  runTidioRemixCommand,
  sendTidioTicketReply,
  tidioWidgetScriptForResult,
  verifyTidioSignature,
} from "./adapters/tidio/remix-tidio-tool.mjs";

const valid = verifyTidioSignature({
  body: rawRequestBody,
  header: request.headers["x-tidio-signature"],
  secret: process.env.TIDIO_WEBHOOK_SECRET,
});
if (!valid) throw new Error("Invalid Tidio webhook signature");

const parsed = parseTidioCommand("preview selfie cozy couch with lamp light");
const result = await runTidioRemixCommand(parsed, {
  bridgeUrl: "http://127.0.0.1:8787",
  characterName: "Lily",
});

await sendTidioTicketReply({
  clientId: process.env.TIDIO_CLIENT_ID,
  clientSecret: process.env.TIDIO_CLIENT_SECRET,
  ticketId: process.env.TIDIO_TICKET_ID,
  operatorId: process.env.TIDIO_OPERATOR_ID,
  result,
});

const widgetSnippet = tidioWidgetScriptForResult(result);
```

## Delivery

Tidio OpenAPI ticket replies support text `content`, so the adapter replies with concise text plus public Remix.Camera `productionImageUrl` links. For an embedded website widget, `tidioWidgetScriptForResult(...)` uses `tidioChatApi.messageFromOperator(...)` after the widget is ready.

Tidio webhooks should be acknowledged quickly and processed asynchronously; the documented timeout is 4 seconds. The adapter includes `verifyTidioSignature` for the `x-tidio-signature` HMAC-SHA256 header.

Preview never spends credits. `couple`, `vacation`, and `snap` require explicit `yes`.
