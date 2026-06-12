# Flowise Demo

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=flowise
```

## Demo Script

1. Start the Remix.Camera bridge.
2. In Flowise, add a Custom Tool based on:

   ```text
   adapters/flowise/remix-camera-flowise-tool.js
   ```

3. Add the tool to an Agent chatflow.
4. Ask: `preview a date-night photo in a quiet restaurant booth`.
5. Confirm the tool calls the bridge dry-run endpoint and returns the selected Remix.Camera template/prompt.
6. Ask: `yes, generate it`.
7. Confirm the tool calls the generate endpoint and returns the Remix.Camera image Markdown or URL.

For cloud Flowise, use a private authenticated bridge URL instead of `127.0.0.1`.
