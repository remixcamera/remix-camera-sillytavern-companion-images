# n8n Demo Runbook

This demo routes a chatbot or webhook event through n8n into the Remix.Camera companion-image bridge.

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=n8n
```

Approve the Remix.Camera pairing code and keep the bridge running.

## Import

Import:

```text
adapters/n8n/remix-camera-n8n-workflow.json
```

Send the webhook:

```bash
curl -X POST "$N8N_WEBHOOK_URL" \
  -H 'Content-Type: application/json' \
  -d '{"command":"send-selfie","prompt":"cozy couch selfie after our chat","characterName":"Lily"}'
```

The response should be a dry-run preview. To generate a real image, call the same webhook with `"action":"generate"` and `"yes":true` after explicit user confirmation.

## Evidence Standard

This runbook is not a public demo recording by itself. Public demo evidence requires a real n8n execution log or UI recording showing the workflow result from the production Remix.Camera bridge with no mocked output.
