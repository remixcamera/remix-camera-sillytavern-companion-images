# Zapier Demo

Goal: add Remix.Camera image tools to an existing Zapier bot or workflow without inventing prompts inside Zapier.

## Dry-Run Demo

1. Pair the bridge:

   ```bash
   npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=zapier
   ```

2. Create a Zapier Platform CLI app from `adapters/zapier/remix-camera-zapier-app/index.cjs`.
3. Run the create action `Preview or Generate Companion Image` with:
   - `command`: `send-selfie`
   - `action`: `dry-run`
   - `yes`: `false`
   - `prompt`: `cozy couch with lamp light`
   - `characterName`: `Lily`
4. Confirm the action returns `Preview ready` and no generated image URL.

## Generation Demo

Set `action=generate` and `yes=true` only after explicit user intent. Then pass `imageUrl` or `imageUrls` to the next Zapier app step.

Do not publish a public Zapier demo until the Zapier task history shows the real Zapier action execution and the image is a real Remix.Camera result.

