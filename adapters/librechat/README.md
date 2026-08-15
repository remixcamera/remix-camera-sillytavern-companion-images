# LibreChat Adapter

Setup:

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=librechat
```

## Recommended: native MCP

Add the shared stdio server to LibreChat's MCP configuration or MCP settings UI:

```yaml
mcpServers:
  remix-camera-companion-images:
    type: stdio
    command: node
    args:
      - /absolute/path/to/adapters/mcp/remix-camera-mcp-server.mjs
    env:
      REMIX_BRIDGE_URL: http://127.0.0.1:8787
      REMIX_CHARACTER_NAME: Lily
```

Select the server/tools in the active chat or Agent. LibreChat's native MCP support is the maintained path.

## Compatibility fallback: OpenAPI Action

Older LibreChat setups can add an OpenAPI Action from:

```text
http://127.0.0.1:8787/librechat/openapi.json
```

The schema includes both preview and generation endpoints:

```text
POST /v1/tools/:command/dry-run
POST /v1/tools/:command/generate
```

Generation endpoints require `yes=true`.
