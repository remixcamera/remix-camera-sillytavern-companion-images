# Remix.Camera Pipedream Action

Use this adapter when a Pipedream workflow is routing chatbot events from Telegram, Discord, Slack, webhooks, CRMs, or custom apps.

## Install

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=pipedream
```

## Add Action

Use this component file in a Pipedream Node.js action:

```text
adapters/pipedream/remix-camera-pipedream-action.mjs
```

Set `Bridge URL` to your local or hosted bridge. The action returns:

```json
{
  "text": "Preview ready: ...",
  "imageUrls": [],
  "dryRun": true,
  "payload": {}
}
```

## Spend Guard

`action: "dry-run"` is the default and never spends credits.

`action: "generate"` requires `yes: true` (`yes=true` in setup/evidence shorthand); otherwise the adapter refuses before it calls the bridge.

## References

- Pipedream component docs: https://pipedream.com/docs/components/
- Pipedream Node.js actions docs: https://pipedream.com/docs/code/nodejs/
