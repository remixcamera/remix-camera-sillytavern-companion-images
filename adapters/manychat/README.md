# Remix.Camera for Manychat

Use this adapter when a Manychat automation should request a Remix.Camera companion image and then continue the same Messenger, Instagram, WhatsApp, Telegram, SMS, or other supported flow.

## Setup

1. Pair and start the bridge:

   ```bash
   npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=manychat
   ```

2. In Manychat, add an Action block and choose External Request.
3. Copy the request shape from `adapters/manychat/remix-camera-manychat-external-request.json`.
4. Use an HTTPS bridge URL. Manychat does not allow non-HTTPS request URLs.
5. Map returned JSON values into custom fields such as `remix_prompt_preview`, `remix_markdown`, and `remix_image_url`.
6. Add a Send Message step after the External Request to show the preview text or generated image URL.

## Behavior

- Default to `action=dry-run` and `yes=false`.
- Set `action=generate` and `yes=true` only after the user explicitly asks for the generated image.
- For couple and vacation images, collect consent and a user-owned reference photo URL before calling generate.
- Manychat is channel-dependent: make sure the channel supports image URLs or media attachments before sending `remix_image_url`.

This follows Manychat's documented External Request flow.

