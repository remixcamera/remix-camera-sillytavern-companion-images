# Remix.Camera n8n Tool

Use this adapter when an n8n workflow is the glue between a chatbot, memory store, and delivery channel.

## Install

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=n8n
```

## Import Workflow

Import this workflow into n8n:

```text
adapters/n8n/remix-camera-n8n-workflow.json
```

Set `REMIX_BRIDGE_URL` in the n8n environment if the bridge is not at `http://127.0.0.1:8787`.

The workflow exposes a webhook tool. Send JSON like:

```json
{
  "command": "send-selfie",
  "prompt": "cozy couch selfie after our chat",
  "characterName": "Lily"
}
```

That defaults to a dry-run preview and spends no credits. To generate, send:

```json
{
  "command": "send-selfie",
  "prompt": "cozy couch selfie after our chat",
  "characterName": "Lily",
  "action": "generate",
  "yes": true
}
```

## Code Node Helper

For an existing workflow, paste `n8nCodeNodeSnippet` from:

```text
adapters/n8n/remix-camera-n8n-tool.mjs
```

It uses n8n's HTTP helper and returns `{ text, imageUrls, payload, dryRun }` for downstream Telegram, Discord, Slack, email, or app-response nodes.

## References

- n8n workflow import/export docs: https://docs.n8n.io/workflows/export-import/
- n8n HTTP Request node docs: https://docs.n8n.io/integrations/builtin/core-nodes/n8n-nodes-base.httprequest/
