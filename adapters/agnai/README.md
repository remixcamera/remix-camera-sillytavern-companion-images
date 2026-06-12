# Agnai Adapter

Agnai does not currently expose a stable documented plugin or tool API. This adapter uses a browser userscript against the local Remix.Camera bridge.

Setup:

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=agnai
```

Install:

```text
adapters/agnai/remix-camera-agnai.user.js
```

The userscript injects a Remix.Camera panel into Agnai, previews prompts without spending credits, generates on button click, then copies or inserts the returned image markdown.

