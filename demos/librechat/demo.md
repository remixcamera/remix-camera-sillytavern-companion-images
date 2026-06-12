# LibreChat Demo

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=librechat
```

Add a LibreChat OpenAPI Action from:

```text
http://127.0.0.1:8787/librechat/openapi.json
```

## Demo Flow

1. Add the action to a companion assistant.
2. Ask: `Preview a realistic selfie from our cafe conversation.`
3. Confirm the model calls `/v1/tools/send-selfie/dry-run`.
4. Ask: `Yes, send it.`
5. Confirm the model calls `/v1/tools/send-selfie/generate` with `yes=true`.

## Proof Points

- LibreChat imports the generated OpenAPI schema.
- Every command has dry-run and guarded generate endpoints.
- Couple/private tools expose consent fields in schema.

