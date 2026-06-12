# Remix.Camera Host Adapters

The local bridge is the shared image engine. Each adapter only translates a host's tool/plugin/bot format into bridge calls.

## Target Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=sillytavern
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=risu
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=openwebui
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=librechat
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=lobechat
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=agnai
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=telegram
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=discord
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=whatsapp
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=dify
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=flowise
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=botpress
```

## Adapter Matrix

| Target | Adapter | Integration Surface |
| --- | --- | --- |
| SillyTavern | `extension/remix-camera-companion-images` | SillyTavern extension + local bridge |
| RisuAI | `adapters/risu/remix-camera-companion-images.risu.js` | RisuAI MCP plugin |
| Open WebUI | `adapters/openwebui/remix_camera_companion_images.py` | Native Open WebUI Tool |
| LibreChat | `http://127.0.0.1:8787/librechat/openapi.json` | OpenAPI Action |
| LobeChat | `http://127.0.0.1:8787/lobe/manifest.json` | Lobe plugin manifest |
| Agnai | `adapters/agnai/remix-camera-agnai.user.js` | Browser userscript against local bridge |
| Telegram | `adapters/telegram/remix-telegram-tool.mjs` | Reusable bot integration module |
| Telegram Lily | `adapters/telegram/lily-bot.mjs` | Proof-of-concept Telegram bot |
| Discord | `adapters/discord/remix-discord-tool.mjs` | Reusable Discord interactions module |
| Discord Lily | `adapters/discord/lily-interactions-server.mjs` | Proof-of-concept Discord interactions server |
| WhatsApp | `adapters/whatsapp/remix-whatsapp-tool.mjs` | Reusable WhatsApp Cloud API module |
| WhatsApp Lily | `adapters/whatsapp/lily-webhook-server.mjs` | Proof-of-concept WhatsApp webhook server |
| Dify | `http://127.0.0.1:8787/openapi.json` | Dify custom OpenAPI tool |
| Flowise | `adapters/flowise/remix-camera-flowise-tool.js` | Flowise Custom Tool helper |
| Botpress | `adapters/botpress/remix-camera-botpress-action.js` | Botpress Execute Code card or Action helper |

## Shared Bridge URLs

- Health: `GET http://127.0.0.1:8787/health`
- Schema: `GET http://127.0.0.1:8787/schema`
- OpenAPI: `GET http://127.0.0.1:8787/openapi.json`
- LibreChat OpenAPI: `GET http://127.0.0.1:8787/librechat/openapi.json`
- Open WebUI OpenAPI: `GET http://127.0.0.1:8787/openwebui/openapi.json`
- Lobe manifest: `GET http://127.0.0.1:8787/lobe/manifest.json`

Every command has:

```text
POST /v1/tools/:command/dry-run
POST /v1/tools/:command/generate
```

Generation endpoints require `yes=true`; dry-run endpoints never spend credits.
