# LobeChat Adapter

Setup:

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=lobechat
```

Install a custom LobeChat plugin from:

```text
http://127.0.0.1:8787/lobe/manifest.json
```

The manifest exposes every companion image command as a plugin API. Generation tools require `yes=true`.

Each command has two Lobe plugin APIs:

- `<toolName>Preview` calls the bridge `/dry-run` endpoint and never spends credits.
- `<toolName>` calls the bridge `/generate` endpoint and requires `yes=true`.

For example, ask the agent to call `sendSelfiePreview` before `sendSelfie`.
