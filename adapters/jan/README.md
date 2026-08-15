# Jan Adapter

Jan uses the shared Remix.Camera stdio MCP server; no Jan-specific code fork is required.

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=jan
```

In Jan:

1. Open **Settings -> MCP Servers**.
2. Add a new **STDIO** server.
3. Set `command` to `node`.
4. Add the absolute path to `adapters/mcp/remix-camera-mcp-server.mjs` as the first argument.
5. Add these environment variables:

   ```text
   REMIX_BRIDGE_URL=http://127.0.0.1:8787
   REMIX_CHARACTER_NAME=Lily
   ```

6. Keep Jan's per-tool permission prompt enabled and turn on the Remix.Camera preview/generate tools for the chat.

Ask the companion:

```text
Show me the cozy couch selfie you were teasing me about. Preview it first and do not generate yet.
```

After reviewing the preview, explicitly ask it to call the matching generate tool with `yes=true`. Preview tools never spend credits; generate tools retain the bridge-side confirmation and consent checks.
