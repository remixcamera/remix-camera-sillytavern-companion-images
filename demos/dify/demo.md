# Dify Demo

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=dify
```

## Demo Script

1. Start the Remix.Camera bridge.
2. In Dify, add a custom OpenAPI tool from:

   ```text
   http://127.0.0.1:8787/openapi.json
   ```

3. Add the imported Remix.Camera tool to an Agent or Workflow Tool node.
4. Ask for a preview: `show me a cozy couch selfie prompt first`.
5. Confirm Dify calls a `/dry-run` endpoint and returns the selected Remix.Camera template/prompt.
6. Ask for generation with explicit confirmation: `yes, send the selfie`.
7. Confirm Dify calls a `/generate` endpoint and returns image Markdown or URLs from Remix.Camera.

For cloud Dify, use a private authenticated bridge URL instead of `127.0.0.1`.
