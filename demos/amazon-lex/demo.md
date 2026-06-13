# Amazon Lex V2 Demo

Goal: let an Amazon Lex V2 bot call Remix.Camera from a Lambda code hook while Lex keeps intent routing and session state.

## Dry-Run Demo

1. Pair the bridge:

   ```bash
   npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=amazon-lex
   ```

2. Deploy `adapters/amazon-lex/remix-camera-lex-v2-lambda.mjs` as the Lambda code hook.
3. Enable the code hook on the Lex V2 image intent.
4. Test with slots or session attributes:
   - `remix_command`: `send-selfie`
   - `remix_action`: `dry-run`
   - `remix_yes`: `false`
   - `remix_prompt`: `cozy couch with lamp light`
   - `remix_character_name`: `Lily`
5. Confirm the Lex response contains a `PlainText` message starting with `Preview ready`.

## Generation Demo

Set `remix_action=generate` and `remix_yes=true` only after explicit user intent. When Remix.Camera returns a public image URL, the Lambda response includes an `ImageResponseCard`.

Do not publish a public Lex demo until the Lambda invocation comes from Amazon Lex V2 itself and the returned image is a real Remix.Camera result.
