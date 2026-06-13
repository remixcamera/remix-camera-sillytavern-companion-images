# Remix.Camera for IBM watsonx Assistant

Use this adapter when a watsonx Assistant action should call Remix.Camera as a custom extension.

## Setup

1. Pair and start the bridge:

   ```bash
   npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=watsonx-assistant
   ```

2. Expose the bridge through a public HTTPS URL or secure tunnel that watsonx Assistant can reach.
3. Edit `adapters/watsonx-assistant/remix-camera-watsonx-extension.openapi.json` and replace `https://YOUR-BRIDGE-HOST.example.com` with that bridge URL.
4. In watsonx Assistant, go to Integrations -> Extensions -> Build custom extension.
5. Import the OpenAPI JSON file.
6. Add the extension to the assistant, then call `previewOrGenerateCompanionImage` from an action step.

## Behavior

- Use `action=dry-run` first to preview the selected Remix.Camera template and prompt.
- Use `action=generate` and `yes=true` only after explicit user confirmation.
- Map the response `prompt`, `markdown`, and `results[0].productionImageUrl` into action variables.
- For couple or vacation images, collect consent and a user-owned reference photo URL before generation.
- watsonx Assistant custom extensions need a public HTTPS bridge URL; they cannot call your laptop's `127.0.0.1` directly.

This follows IBM's documented custom-extension flow: import an OpenAPI 3 JSON document, connect the extension, and call it from assistant actions.
