# Manychat Demo

Goal: let a Manychat flow ask Remix.Camera for relevant companion images and then send the result through the active Manychat channel.

## Dry-Run Demo

1. Pair the bridge:

   ```bash
   npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=manychat
   ```

2. Add a Manychat Action block -> External Request.
3. Configure it from `adapters/manychat/remix-camera-manychat-external-request.json`.
4. Test with:
   - `command`: `send-selfie`
   - `action`: `dry-run`
   - `yes`: `false`
   - `last_text_input`: `cozy couch with lamp light`
   - `character_name`: `Lily`
5. Map `$.prompt` or `$.markdown` into a custom field and display it in the next Send Message step.

## Generation Demo

After explicit user confirmation, set `action=generate` and `yes=true`, then map `$.results[0].productionImageUrl` into `remix_image_url` and send that image URL through the channel.

Do not publish a public Manychat demo until the Manychat automation history shows the real External Request and the sent media is a real Remix.Camera output.

