# MCP Adapter

The MCP adapter exposes Remix.Camera companion image tools to MCP clients such as Claude Desktop, Cursor, Cline, Windsurf-style IDE agents, and any bot host that can launch a local stdio MCP server.

It does not store a Remix.Camera token in the MCP client. The MCP server talks only to the local Remix.Camera bridge, and the bridge keeps the scoped `dapi_...` session token in the local config file created by setup.

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=mcp
```

This pairs the local bridge and prints the absolute path to:

```text
adapters/mcp/remix-camera-mcp-server.mjs
```

## MCP Client Config

Add a local server entry to your MCP client config. Replace the path with the one printed by setup.

```json
{
  "mcpServers": {
    "remix-camera-companion-images": {
      "command": "node",
      "args": [
        "/absolute/path/to/remix-camera-sillytavern-companion-images/adapters/mcp/remix-camera-mcp-server.mjs"
      ],
      "env": {
        "REMIX_BRIDGE_URL": "http://127.0.0.1:8787",
        "REMIX_CHARACTER_NAME": "Lily"
      }
    }
  }
}
```

Start the local bridge before opening the MCP client:

```bash
REMIX_CONFIG_FILE=~/.remix-camera/sillytavern-bridge.json npm start
```

## Tools

The server exposes one preview tool and one guarded generate tool for every companion image command:

```text
remix_camera_send_selfie_preview
remix_camera_send_selfie_generate
remix_camera_auto_selfie_from_chat_preview
remix_camera_auto_selfie_from_chat_generate
remix_camera_outfit_try_on_preview
remix_camera_outfit_try_on_generate
remix_camera_couple_photo_preview
remix_camera_couple_photo_generate
remix_camera_couples_vacation_preview
remix_camera_couples_vacation_generate
remix_camera_date_night_preview
remix_camera_date_night_generate
remix_camera_daily_life_snap_preview
remix_camera_daily_life_snap_generate
remix_camera_private_snap_preview
remix_camera_private_snap_generate
```

Preview tools call the bridge dry-run endpoints and never spend credits.

Generate tools call the bridge generate endpoints only when the MCP client passes `yes=true`. Couple, vacation, and private image flows still keep their bridge-side consent checks.

## Demo Prompt

In your MCP client, ask:

```text
Use Remix.Camera to preview a cozy couch selfie for Lily. Do not generate yet.
```

Then, after the preview looks right:

```text
Generate that Lily selfie now with yes=true.
```

The result returns text plus image resource links when Remix.Camera returns production image URLs.
