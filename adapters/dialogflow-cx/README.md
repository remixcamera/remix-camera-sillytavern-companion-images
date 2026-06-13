# Remix.Camera for Dialogflow CX

Use this adapter when a Dialogflow CX agent should call Remix.Camera from a webhook fulfillment.

## Setup

1. Pair and start the bridge:

   ```bash
   npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=dialogflow-cx
   ```

2. Deploy a small HTTPS webhook service that imports `runRemixCameraDialogflowCxWebhook` from `adapters/dialogflow-cx/remix-camera-dialogflow-cx-webhook.mjs`.
3. In Dialogflow CX, create a webhook resource that points to that HTTPS service.
4. Add webhook fulfillment to the route or page where the user asks for a companion image.
5. Pass parameters such as `command`, `action`, `prompt`, `characterName`, `userConsent`, and `userReferenceImageUrl`.

Dialogflow CX webhooks must answer quickly and return a `fulfillment_response`. Keep `action=dry-run` as the default so the agent can preview the Remix.Camera prompt before spending credits.

## Behavior

- Fulfillment tags such as `remix_camera_send_selfie_preview` map to `send-selfie` dry-runs.
- `action=generate` is refused unless `yes=true` is present.
- The webhook response writes `remix_text`, `remix_prompt_preview`, `remix_image_url`, and `remix_dry_run` into `session_info.parameters`.
- Generated images are returned in a custom payload under `messages[].payload.remixCamera`.

This follows Dialogflow CX's documented HTTPS webhook request and webhook response pattern.
