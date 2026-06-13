# Dialogflow ES Demo

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=dialogflow-es
```

Deploy a small HTTPS webhook that calls `runRemixCameraDialogflowEsWebhook` from `adapters/dialogflow-es/remix-camera-dialogflow-es-webhook.mjs`.

## Dry-Run Preview

Create or trigger an intent such as:

```text
remix_camera_send_selfie_preview
```

Use parameters:

```json
{
  "command": "send-selfie",
  "action": "dry-run",
  "prompt": "cozy couch with lamp light",
  "characterName": "Lily"
}
```

Expected result:

- The webhook returns `fulfillmentMessages[0].text`.
- The response includes `payload.remixCamera.dryRun = true`.
- The bridge does not spend generation credits.

## Confirmed Generation

Trigger the generate intent only after confirmation:

```json
{
  "command": "send-selfie",
  "action": "generate",
  "prompt": "cozy couch with lamp light",
  "characterName": "Lily",
  "yes": true
}
```

Expected result:

- The webhook returns a Dialogflow ES card with `imageUri`.
- The `remix_camera` output context includes `remix_image_url`.
- Removing `yes` refuses generation before credits are spent.

## Evidence To Record

For a production host demo, capture Dialogflow ES test console or the connected integration showing the preview response and the confirmed image card.
