# Make Demo

Goal: let an existing Make chatbot or automation scenario request Remix.Camera companion images without putting Remix.Camera credentials inside the bot prompt.

## Dry-Run Demo

1. Pair the bridge:

   ```bash
   npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=make
   ```

2. Create or open a Make Custom App action module using `adapters/make/remix-camera-make-action-module.json`.
3. Run the module with:
   - `command`: `send-selfie`
   - `action`: `dry-run`
   - `yes`: `false`
   - `prompt`: `cozy couch with lamp light`
   - `characterName`: `Lily`
4. Confirm the output says `Preview ready` and includes a Remix.Camera prompt/template payload.

## Generation Demo

Run the same module with `action=generate` and `yes=true` only after the user explicitly asks for a real generated image. The output `imageUrl` can be passed to a Telegram, Discord, Slack, email, webhook, or HTTP response module.

Do not publish a public Make demo until the scenario run history shows the real Make module execution and a real Remix.Camera result.

