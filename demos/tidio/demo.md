# Tidio Demo

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=tidio
```

Use `adapters/tidio/remix-tidio-tool.mjs` as a webhook, OpenAPI ticket-reply, or widget sidecar.

## Demo Flow

1. Verify webhook requests with `verifyTidioSignature(...)`.
2. Acknowledge Tidio webhooks quickly and process Remix.Camera generation asynchronously.
3. Send `preview selfie cozy couch with lamp light` to confirm a no-credit dry-run prompt.
4. Send `selfie cozy couch with lamp light` only when you intentionally want to spend one generation.
5. Deliver as a Tidio ticket reply with public image links, or inject widget operator messages with `tidioWidgetScriptForResult(...)`.

Tidio OpenAPI ticket replies are text-only, so image delivery is text plus public Remix.Camera links. The widget helper uses `tidioChatApi.messageFromOperator(...)`; it does not fake a native image upload API.
