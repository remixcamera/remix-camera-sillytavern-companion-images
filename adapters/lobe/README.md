# LobeChat Adapter

Setup:

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=lobechat
```

## Recommended: MCP

Current LobeHub clients can add the shared stdio MCP server:

```json
{
  "mcpServers": {
    "remix-camera-companion-images": {
      "command": "node",
      "args": [
        "/absolute/path/to/adapters/mcp/remix-camera-mcp-server.mjs"
      ],
      "env": {
        "REMIX_BRIDGE_URL": "http://127.0.0.1:8787",
        "REMIX_CHARACTER_NAME": "Lily"
      }
    }
  }
}
```

The shared server exposes preview and guarded generate tools and is the maintained integration path.

## Legacy Lobe Custom Plugin

Older Lobe clients can install a custom plugin from:

```text
http://127.0.0.1:8787/lobe/manifest.json
```

The manifest exposes every companion image command as a plugin API. Generation tools require `yes=true`.

The bridge serves both the manifest and its declared `POST /lobe/gateway` execution route. Browser-hosted LobeHub also needs its exact origin in the bridge allowlist; the `--target=lobechat` setup does this automatically.

Each command has two Lobe plugin APIs:

- `<toolName>Preview` calls the bridge `/dry-run` endpoint and never spends credits.
- `<toolName>` calls the bridge `/generate` endpoint and requires `yes=true`.

For example, ask the agent to call `sendSelfiePreview` before `sendSelfie`.
