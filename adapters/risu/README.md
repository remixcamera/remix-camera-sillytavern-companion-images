# RisuAI Adapter

Use the RisuAI plugin file:

```text
adapters/risu/remix-camera-companion-images.risu.js
```

Setup:

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=risu
```

The plugin registers a RisuAI MCP module:

```text
plugin:remix-camera-companion-images
```

Installing the plugin does not enable that module automatically. In current
RisuAI, finish the setup in **Settings → Modules**:

1. Select the MCP/import icon.
2. Enter `plugin:remix-camera-companion-images`.
3. Enable **Remix.Camera Companion Images** globally with the globe control.

The Remix.Camera tools then appear in model requests and tool calls are shown
directly in the chat transcript.

Calls without `yes=true` return a Remix.Camera dry-run preview. Calls with `yes=true` spend credits and return image markdown.

This adapter targets RisuAI plugin API v3 (`//@api 3.0`). It uses the current async `Risuai.registerMCP`, `nativeFetch`, and unload APIs, and carries version/update metadata so Risu can detect future raw-GitHub updates.
