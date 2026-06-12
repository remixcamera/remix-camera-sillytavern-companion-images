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

Calls without `yes=true` return a Remix.Camera dry-run preview. Calls with `yes=true` spend credits and return image markdown.

