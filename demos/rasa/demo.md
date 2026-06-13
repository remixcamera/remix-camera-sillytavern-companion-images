# Rasa Demo

Goal: let a Rasa assistant call Remix.Camera as a custom action while Rasa keeps its NLU, stories, flows, and memory.

## Dry-Run Demo

1. Pair the bridge:

   ```bash
   npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=rasa
   ```

2. Copy `adapters/rasa/remix_camera_rasa_actions.py` into your Rasa project's `actions/` folder.
3. Add `action_remix_camera_companion_image` to `domain.yml`.
4. Route a selfie intent or flow step to that action.
5. Set slots:
   - `remix_command`: `send-selfie`
   - `remix_action`: `dry-run`
   - `remix_yes`: `false`
   - `remix_prompt`: `cozy couch with lamp light`
   - `remix_character_name`: `Lily`
6. Run the Rasa action server and send the test message.
7. Confirm the bot response starts with `Preview ready`.

## Generation Demo

Set `remix_action=generate` and `remix_yes=true` only after explicit user intent. The action returns generated media through `dispatcher.utter_message(image=...)` when Remix.Camera returns public production image URLs.

Do not publish a public Rasa demo until the action server run and chat transcript come from a real Rasa assistant and the returned image is a real Remix.Camera result.
