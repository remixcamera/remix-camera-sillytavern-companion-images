# RisuAI Demo

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=risu
```

Install:

```text
adapters/risu/remix-camera-companion-images.risu.js
```

Set `bridge_url` to `http://127.0.0.1:8787`.

## Demo Flow

1. Open a RisuAI companion character.
2. Confirm the Remix.Camera MCP tools are available.
3. Ask the character: `Preview a selfie from the cafe booth before sending it.`
4. Then ask: `Yes, send it.`
5. Ask for a date-night image and a daily-life snap.

## Proof Points

- RisuAI sees the tools through `registerMCP`.
- Calls without `yes=true` return a dry-run template preview.
- Calls with `yes=true` return Remix.Camera chat markdown.

