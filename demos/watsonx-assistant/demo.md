# watsonx Assistant Demo

Goal: let a watsonx Assistant action call Remix.Camera through a custom extension while watsonx remains the conversation and action-flow layer.

## Dry-Run Demo

1. Pair the bridge:

   ```bash
   npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=watsonx-assistant
   ```

2. Expose the bridge over public HTTPS.
3. Replace the server URL in `adapters/watsonx-assistant/remix-camera-watsonx-extension.openapi.json`.
4. Import that OpenAPI JSON as a watsonx Assistant custom extension.
5. Add an action step that calls `previewOrGenerateCompanionImage` with:
   - `command`: `send-selfie`
   - `action`: `dry-run`
   - `yes`: `false`
   - `prompt`: `cozy couch with lamp light`
   - `characterName`: `Lily`
6. Confirm the extension response contains `dryRun=true` and a preview prompt.

## Generation Demo

Switch to `action=generate` and `yes=true` only after explicit user intent. Map `results[0].productionImageUrl` into an action variable and send it through a channel that supports image media.

Do not publish a public watsonx Assistant demo until the extension call appears in a real watsonx Assistant action run and the returned image is a real Remix.Camera result.
