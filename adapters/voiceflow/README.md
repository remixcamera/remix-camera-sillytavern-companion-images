# Remix.Camera for Voiceflow

Use this adapter when a Voiceflow agent already owns the conversation and needs to call Remix.Camera as an image tool.

## Setup

1. Pair and start the bridge:

   ```bash
   npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=voiceflow
   ```

2. In Voiceflow, create an API tool named `Remix.Camera Companion Image`.
3. Copy the request shape from `adapters/voiceflow/remix-camera-voiceflow-api-tool.json`.
4. Add it to a Playbook or a Workflow API step.
5. Capture `text`, `dryRun`, and `imageUrl` into Voiceflow variables, then use a message/card step to show the result.

Voiceflow Cloud cannot call your laptop's `127.0.0.1`. Use a public HTTPS bridge URL or a secure development tunnel for real cloud testing.

## Behavior

- Use `action=dry-run` first to preview the selected Remix.Camera template and adapted prompt.
- Use `action=generate` and `yes=true` only after explicit user confirmation.
- For couple or vacation images, pass `userConsent=yes` and a user-owned `userReferenceImageUrl` when available.
- For private snaps, keep the copy conservative: Voiceflow cannot guarantee deletion from every downstream channel once media is delivered.

The adapter follows Voiceflow's documented API tool and API step pattern.

