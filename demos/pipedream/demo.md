# Pipedream Demo Runbook

This demo routes a chatbot or webhook event through a Pipedream action into the Remix.Camera companion-image bridge.

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=pipedream
```

Approve the Remix.Camera pairing code and keep the bridge running.

## Action

Add this component as a Node.js action:

```text
adapters/pipedream/remix-camera-pipedream-action.mjs
```

Use action inputs:

```json
{
  "command": "send-selfie",
  "prompt": "cozy couch selfie after our chat",
  "characterName": "Lily",
  "action": "dry-run"
}
```

To generate a real image, use `"action":"generate"` and `"yes":true` after explicit user confirmation.

## Evidence Standard

This runbook is not a public demo recording by itself. Public demo evidence requires a real Pipedream workflow execution or screen recording showing the production Remix.Camera bridge result with no mocked output.
