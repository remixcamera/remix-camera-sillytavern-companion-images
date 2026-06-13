# Botpress Demo

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=botpress
```

## Demo Script

1. Start the Remix.Camera bridge.
2. In Botpress, add an Execute Code card or Action based on:

   ```text
   adapters/botpress/remix-camera-botpress-action.js
   ```

3. Add a preview step. The helper calls `dry-run` by default unless `yes=true` or `confirm=true`.
4. Ask the Botpress bot: `preview a cozy couch selfie`.
5. Confirm the bot returns the Remix.Camera template/prompt without spending credits.
6. Set `yes=true` or `confirm=true` after confirmation.
7. Ask: `send the selfie`.
8. Confirm Botpress returns the Remix.Camera image text or image URLs.

For cloud Botpress, use a private authenticated bridge URL instead of `127.0.0.1`.
