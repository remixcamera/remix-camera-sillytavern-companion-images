# Remix.Camera for Amazon Lex V2

Use this adapter when an Amazon Lex V2 bot should call Remix.Camera through a Lambda code hook.

## Setup

1. Pair and start the bridge:

   ```bash
   npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=amazon-lex
   ```

2. Bundle `adapters/amazon-lex/remix-camera-lex-v2-lambda.mjs` into the Lambda function used by your Lex V2 bot alias.
3. Set `REMIX_BRIDGE_URL` in the Lambda environment if the bridge URL differs from your deployed bridge or secure tunnel.
4. Configure a DialogCodeHook or FulfillmentCodeHook on the Lex V2 intent that should request companion images.
5. Pass slots or session attributes such as `remix_command`, `remix_action`, `remix_prompt`, `remix_character_name`, and `remix_yes`.

## Behavior

- Defaults to `remix_action=dry-run`; dry-runs never set `yes` and never spend credits.
- Refuses `remix_action=generate` unless `remix_yes` or `yes` is true.
- Returns a Lex V2 `sessionState.dialogAction.type=Close` response with the intent marked `Fulfilled`.
- Sends preview/generated text as a `PlainText` message.
- Sends generated public image URLs as `ImageResponseCard` messages when available.
- Writes `remix_*` values into Lex session attributes for follow-up turns.

This follows Amazon Lex V2's documented Lambda input event and Lambda response format.
