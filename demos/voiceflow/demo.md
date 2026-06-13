# Voiceflow Demo

Goal: let a Voiceflow agent use Remix.Camera image abilities while Voiceflow remains the chat, routing, and memory layer.

## Dry-Run Demo

1. Pair the bridge:

   ```bash
   npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=voiceflow
   ```

2. Create a Voiceflow API tool from `adapters/voiceflow/remix-camera-voiceflow-api-tool.json`.
3. Add it to a Playbook or Workflow API step.
4. Run a test with:
   - `command`: `send-selfie`
   - `action`: `dry-run`
   - `yes`: `false`
   - `prompt`: `cozy couch with lamp light`
   - `characterName`: `Lily`
5. Confirm the captured `text` starts with `Preview ready`.

## Generation Demo

Switch to `action=generate` and `yes=true` only after explicit user intent. Capture `imageUrl` and show it in the next Voiceflow response step.

Do not publish a public Voiceflow demo until the trace/test run comes from Voiceflow itself and the returned image is a real Remix.Camera result.

