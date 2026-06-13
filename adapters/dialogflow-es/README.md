# Remix.Camera for Dialogflow ES

Use this adapter when a Dialogflow ES agent needs Remix.Camera companion image previews or confirmed image generations through fulfillment.

## Install

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=dialogflow-es
```

The setup command pairs Remix.Camera and prints the webhook handler path.

## Webhook

Deploy an HTTPS Node service that imports the handler:

```js
import { runRemixCameraDialogflowEsWebhook } from "./adapters/dialogflow-es/remix-camera-dialogflow-es-webhook.mjs";

app.post("/dialogflow-es/remix-camera", async (req, res) => {
  const body = await runRemixCameraDialogflowEsWebhook(req.body, {
    bridgeUrl: process.env.REMIX_BRIDGE_URL || "http://127.0.0.1:8787",
    characterName: "Lily",
  });
  res.json(body);
});
```

In Dialogflow ES:

1. Open Fulfillment.
2. Enable Webhook.
3. Set the URL to your deployed HTTPS endpoint.
4. Enable webhook fulfillment on the image intents.
5. Pass parameters such as `command`, `action`, `prompt`, `characterName`, `yes`, `userConsent`, and `userReferenceImageUrl`.

Intent display names can also route commands:

```text
remix_camera_send_selfie_preview
remix_camera_send_selfie_generate
remix_camera_couples_vacation_preview
remix_camera_private_snap_generate
```

## Response

The adapter returns Dialogflow ES `fulfillmentMessages` with text, optional card `imageUri`, a custom `payload.remixCamera`, and a `remix_camera` output context.

## Safety

- Dry-run is the default.
- `action=generate` is refused unless `yes=true`.
- Webhook delivery must be HTTPS and publicly reachable for Dialogflow ES.
