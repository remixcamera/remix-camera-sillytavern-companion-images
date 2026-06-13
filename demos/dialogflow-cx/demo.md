# Dialogflow CX Demo

Goal: let a Dialogflow CX agent call Remix.Camera through a webhook fulfillment while Dialogflow remains the conversation router.

## Dry-Run Demo

1. Pair the bridge:

   ```bash
   npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=dialogflow-cx
   ```

2. Deploy an HTTPS webhook service that calls `runRemixCameraDialogflowCxWebhook`.
3. Create a Dialogflow CX webhook resource pointed at that service.
4. Add webhook fulfillment to a route with tag `remix_camera_send_selfie_preview`.
5. Test with session parameters:
   - `command`: `send-selfie`
   - `action`: `dry-run`
   - `yes`: `false`
   - `prompt`: `cozy couch with lamp light`
   - `characterName`: `Lily`
6. Confirm the response contains `fulfillment_response.messages[0].text.text[0]` starting with `Preview ready`.

## Generation Demo

Switch to `action=generate` and `yes=true` only after explicit user intent. Read `session_info.parameters.remix_image_url` or `messages[].payload.remixCamera.imageUrl` and send it through a channel that supports image media.

Do not publish a public Dialogflow CX demo until the webhook trace comes from Dialogflow CX itself and the returned image is a real Remix.Camera result.
