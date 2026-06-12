# Remix.Camera Companion Image Demos

Each folder is a host-specific demo runbook. The demos all use the same bridge contract:

1. Run `npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=<target>`.
2. Approve the Remix.Camera pairing code.
3. Run the host adapter.
4. Preview first, then generate only after explicit user intent.

Targets:

- `sillytavern/`: existing polished SillyTavern extension demo.
- `risu/`: RisuAI MCP plugin demo.
- `openwebui/`: Open WebUI native Tool demo.
- `librechat/`: LibreChat OpenAPI Action demo.
- `lobechat/`: LobeChat plugin manifest demo.
- `agnai/`: Agnai userscript demo.
- `telegram/`: reusable Telegram bot tool plus Lily proof-of-concept demo.
- `discord/`: Discord slash-command tool plus Lily proof-of-concept demo.

Do not publish generated demo recordings until the runbook has been executed against production Remix.Camera and the inserted images are real Remix.Camera outputs.

