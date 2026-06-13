# Remix.Camera Host Adapters

The local bridge is the shared image engine. Each adapter only translates a host's tool/plugin/bot format into bridge calls.

## Target Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=sillytavern
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=mcp
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=risu
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=openwebui
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=librechat
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=lobechat
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=agnai
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=telegram
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=discord
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=whatsapp
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=slack
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=line
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=messenger
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=instagram
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=teams
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=twilio
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=matrix
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=dify
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=flowise
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=botpress
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=anythingllm
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=typingmind
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=poe
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=langflow
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=langchain
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=vercel-ai-sdk
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=n8n
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=pipedream
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=make
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=zapier
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=voiceflow
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=manychat
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=dialogflow-cx
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=rasa
```

## Adapter Matrix

| Target | Adapter | Integration Surface |
| --- | --- | --- |
| SillyTavern | `extension/remix-camera-companion-images` | SillyTavern extension + local bridge |
| MCP clients | `adapters/mcp/remix-camera-mcp-server.mjs` | Local stdio MCP server for Claude Desktop, Cursor, Cline, and MCP-compatible hosts |
| RisuAI | `adapters/risu/remix-camera-companion-images.risu.js` | RisuAI MCP plugin |
| Open WebUI | `adapters/openwebui/remix_camera_companion_images.py` | Native Open WebUI Tool |
| LibreChat | `http://127.0.0.1:8787/librechat/openapi.json` | OpenAPI Action |
| LobeChat | `http://127.0.0.1:8787/lobe/manifest.json` | Lobe plugin manifest with preview and guarded generate tools |
| Agnai | `adapters/agnai/remix-camera-agnai.user.js` | Browser userscript against local bridge |
| Telegram | `adapters/telegram/remix-telegram-tool.mjs` + `adapters/telegram/framework-middleware.mjs` | Reusable bot integration module plus Telegraf/grammY middleware |
| Telegram Lily | `adapters/telegram/lily-bot.mjs` | Proof-of-concept Telegram bot |
| Discord | `adapters/discord/remix-discord-tool.mjs` | Reusable Discord interactions module |
| Discord Lily | `adapters/discord/lily-interactions-server.mjs` | Proof-of-concept Discord interactions server |
| WhatsApp | `adapters/whatsapp/remix-whatsapp-tool.mjs` | Reusable WhatsApp Cloud API module |
| WhatsApp Lily | `adapters/whatsapp/lily-webhook-server.mjs` | Proof-of-concept WhatsApp webhook server |
| Slack | `adapters/slack/remix-slack-tool.mjs` | Reusable Slack slash-command module |
| Slack Lily | `adapters/slack/lily-slash-command-server.mjs` | Proof-of-concept Slack slash-command server |
| LINE | `adapters/line/remix-line-tool.mjs` | Reusable LINE Messaging API module |
| LINE Lily | `adapters/line/lily-webhook-server.mjs` | Proof-of-concept LINE webhook server |
| Messenger | `adapters/messenger/remix-messenger-tool.mjs` | Reusable Messenger Platform module |
| Messenger Lily | `adapters/messenger/lily-webhook-server.mjs` | Proof-of-concept Messenger webhook server |
| Instagram DMs | `adapters/instagram/remix-instagram-tool.mjs` | Reusable Instagram Messaging API module |
| Microsoft Teams | `adapters/teams/remix-teams-tool.mjs` | Reusable Teams/Bot Framework message handler |
| Twilio SMS/MMS | `adapters/twilio/remix-twilio-mms-tool.mjs` | Reusable Twilio inbound webhook and Messages API module |
| Matrix | `adapters/matrix/remix-matrix-tool.mjs` | Reusable Matrix bot module |
| Matrix Lily | `adapters/matrix/lily-sync-bot.mjs` | Proof-of-concept Matrix sync bot |
| Dify | `http://127.0.0.1:8787/openapi.json` | Dify custom OpenAPI tool |
| Flowise | `adapters/flowise/remix-camera-flowise-tool.js` | Flowise Custom Tool helper |
| Botpress | `adapters/botpress/remix-camera-botpress-action.js` | Botpress Execute Code card or Action helper |
| AnythingLLM | `adapters/anythingllm/remix-camera-companion-images` | AnythingLLM custom agent skill |
| TypingMind | `adapters/typingmind/function-spec.json` + `adapters/typingmind/remix-camera-plugin.js` | TypingMind plugin function |
| Poe | `adapters/poe/remix_camera_poe_bot.py` | Poe server bot wrapper |
| Langflow | `adapters/langflow/remix_camera_component.py` | Langflow custom component tool |
| LangChain JS | `adapters/langchain/remix-camera-langchain-tools.mjs` | LangChain `tool` helper wrappers for existing agents |
| Vercel AI SDK | `adapters/vercel-ai-sdk/remix-camera-ai-sdk-tools.mjs` | AI SDK tool map for `generateText`, `streamText`, or agent loops |
| n8n | `adapters/n8n/remix-camera-n8n-workflow.json` + `adapters/n8n/remix-camera-n8n-tool.mjs` | Importable workflow and Code node helper for chatbot automations |
| Pipedream | `adapters/pipedream/remix-camera-pipedream-action.mjs` | Pipedream Node.js action component for workflow bots |
| Make | `adapters/make/remix-camera-make-action-module.json` + `adapters/make/remix-camera-make-tool.mjs` | Make Custom Apps action module for bot and automation scenarios |
| Zapier | `adapters/zapier/remix-camera-zapier-app/index.cjs` | Zapier Platform CLI create action for bot and workflow Zaps |
| Voiceflow | `adapters/voiceflow/remix-camera-voiceflow-api-tool.json` + `adapters/voiceflow/remix-camera-voiceflow-tool.mjs` | Voiceflow API tool or Workflow API step for assistant builders |
| Manychat | `adapters/manychat/remix-camera-manychat-external-request.json` + `adapters/manychat/remix-camera-manychat-tool.mjs` | Manychat External Request action for Messenger, Instagram, WhatsApp, Telegram, SMS, and automation flows |
| Dialogflow CX | `adapters/dialogflow-cx/remix-camera-dialogflow-cx-webhook.mjs` | Dialogflow CX webhook fulfillment for bot routes and pages |
| Rasa | `adapters/rasa/remix_camera_rasa_actions.py` | Rasa custom action for assistants using Rasa flows, stories, and action server |

## Popular Host Feasibility

Supported means the package has a concrete integration surface and a runbook. Watchlist means the host is popular with companion or roleplay users, but direct support should wait for an official or user-controlled surface that can be tested without scraping or pretending local output is host output.

| Host | Status | Reason |
| --- | --- | --- |
| SillyTavern | Supported | Extension and local bridge. |
| MCP clients | Supported | Local stdio MCP server with `tools/list` and `tools/call` support. |
| RisuAI | Supported | MCP plugin. |
| Open WebUI | Supported | Native Tool. |
| LibreChat | Supported | OpenAPI Action. |
| LobeChat | Supported | Plugin manifest. |
| Agnai | Supported | Userscript against the local bridge. |
| Telegram, Discord, WhatsApp, Slack, LINE, Messenger, Instagram DMs, Microsoft Teams, Twilio SMS/MMS, Matrix | Supported | Reusable bot/webhook modules plus Lily proof wrappers where a direct Lily wrapper is useful. |
| Dify, Flowise, Botpress | Supported | OpenAPI/custom tool/action surfaces. |
| AnythingLLM, TypingMind, Poe, Langflow, LangChain JS, Vercel AI SDK, n8n, Pipedream, Make, Zapier, Voiceflow, Manychat, Dialogflow CX, Rasa | Supported | Official custom skill, plugin, server-bot, custom component, framework tool, workflow, custom app, API tool, External Request, webhook, and custom action surfaces. |
| Character.AI | Watchlist | Popular consumer host, but no production adapter without an official API, plugin, or partner surface. |
| JanitorAI | Watchlist | Popular roleplay host with external model-provider setup; direct image insertion needs a reliable host callback/tool surface. |
| Chub/Venus | Watchlist | Strong character-card and API-provider ecosystem; direct chat insertion needs a supported host surface. |
| SpicyChat, CrushOn, Kindroid, Nomi, Candy | Watchlist | Hosted companion apps; support only through official import/export, bot, webhook, tool, or extension surfaces. Nomi and Kindroid API bridges are useful follow-ups, but they are not direct in-chat host adapters yet. |
| Backyard AI | Watchlist | Character import/export is useful, but direct companion-image support needs a stable local/plugin/API surface. |

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
