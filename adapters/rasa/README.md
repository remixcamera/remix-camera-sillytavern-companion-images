# Remix.Camera for Rasa

Use this adapter when a Rasa assistant should call Remix.Camera from a custom action.

## Setup

1. Pair and start the bridge:

   ```bash
   npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=rasa
   ```

2. Copy `adapters/rasa/remix_camera_rasa_actions.py` into your Rasa project's `actions/` folder.
3. Add the action server to `endpoints.yml`.
4. Add `action_remix_camera_companion_image` to `domain.yml`.
5. Route image-related intents or flows to that custom action.

The action reads these optional slots:

```text
remix_command
remix_action
remix_yes
remix_prompt
remix_character_name
remix_profile_id
remix_source_image_url
remix_user_reference_image_url
remix_user_consent
remix_user_description
remix_mature_content
```

## Behavior

- Defaults to `remix_action=dry-run`; dry-runs never set `yes` and never spend credits.
- Refuses `remix_action=generate` unless `remix_yes` is true.
- Sends preview text through `dispatcher.utter_message(text=...)`.
- Sends generated image URLs through `dispatcher.utter_message(image=...)` when production URLs are returned.
- Writes `remix_dry_run`, `remix_image_url`, and `remix_text` back as Rasa slot events.

This follows Rasa's documented custom action pattern: define an `Action`, implement `name`, and implement `run(dispatcher, tracker, domain)`.
