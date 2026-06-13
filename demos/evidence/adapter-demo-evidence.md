# Remix.Camera Adapter Demo Verification

Generated at: 2026-06-13T08:38:43.928Z
Mode: bridge-dry-run
Bridge URL: http://127.0.0.1:8787

## Demo Evidence Status

| Target | Evidence level | Public demo ready | Next step |
| --- | --- | --- | --- |
| SillyTavern | real host recording | yes | Keep recording current when behavior or UI changes. |
| MCP Clients | setup runbook and static adapter preflight | no | Run this target in the real host and add production demo evidence. |
| RisuAI | setup runbook and static adapter preflight | no | Run this target in the real host and add production demo evidence. |
| Open WebUI | setup runbook and static adapter preflight | no | Run this target in the real host and add production demo evidence. |
| LibreChat | setup runbook and static adapter preflight | no | Run this target in the real host and add production demo evidence. |
| LobeChat | setup runbook and static adapter preflight | no | Run this target in the real host and add production demo evidence. |
| Agnai | setup runbook and static adapter preflight | no | Run this target in the real host and add production demo evidence. |
| Telegram | production bridge evidence | no | Record a real host-delivery demo after platform credentials are present. |
| Discord | setup runbook and static adapter preflight | no | Run this target in the real host and add production demo evidence. |
| WhatsApp | setup runbook and static adapter preflight | no | Run this target in the real host and add production demo evidence. |
| Slack | setup runbook and static adapter preflight | no | Run this target in the real host and add production demo evidence. |
| LINE | setup runbook and static adapter preflight | no | Run this target in the real host and add production demo evidence. |
| Messenger | setup runbook and static adapter preflight | no | Run this target in the real host and add production demo evidence. |
| Instagram DMs | setup runbook and static adapter preflight | no | Run this target in the real host and add production demo evidence. |
| Microsoft Teams | setup runbook and static adapter preflight | no | Run this target in the real host and add production demo evidence. |
| Twilio SMS/MMS | setup runbook and static adapter preflight | no | Run this target in the real host and add production demo evidence. |
| Matrix | setup runbook and static adapter preflight | no | Run this target in the real host and add production demo evidence. |
| Dify | setup runbook and static adapter preflight | no | Run this target in the real host and add production demo evidence. |
| Flowise | setup runbook and static adapter preflight | no | Run this target in the real host and add production demo evidence. |
| Botpress | setup runbook and static adapter preflight | no | Run this target in the real host and add production demo evidence. |
| AnythingLLM | setup runbook and static adapter preflight | no | Run this target in the real host and add production demo evidence. |
| TypingMind | setup runbook and static adapter preflight | no | Run this target in the real host and add production demo evidence. |
| Poe | setup runbook and static adapter preflight | no | Run this target in the real host and add production demo evidence. |
| Langflow | setup runbook and static adapter preflight | no | Run this target in the real host and add production demo evidence. |
| LangChain JS | setup runbook and static adapter preflight | no | Run this target in the real host and add production demo evidence. |
| Vercel AI SDK | setup runbook and static adapter preflight | no | Run this target in the real host and add production demo evidence. |
| n8n | setup runbook and static adapter preflight | no | Run this target in the real host and add production demo evidence. |
| Pipedream | setup runbook and static adapter preflight | no | Run this target in the real host and add production demo evidence. |
| Make | setup runbook and static adapter preflight | no | Run this target in the real host and add production demo evidence. |
| Zapier | setup runbook and static adapter preflight | no | Run this target in the real host and add production demo evidence. |
| Voiceflow | setup runbook and static adapter preflight | no | Run this target in the real host and add production demo evidence. |
| Manychat | setup runbook and static adapter preflight | no | Run this target in the real host and add production demo evidence. |
| Dialogflow CX | setup runbook and static adapter preflight | no | Run this target in the real host and add production demo evidence. |
| Rasa | setup runbook and static adapter preflight | no | Run this target in the real host and add production demo evidence. |

Public demo ready targets: 1/34

## Targets

### SillyTavern
Evidence: real host recording. Public demo ready: yes.
- [x] adapter exists: extension/remix-camera-companion-images/index.js
- [x] adapter exists: extension/remix-camera-companion-images/manifest.json
- [x] demo artifact exists: demos/sillytavern/live-production-2026-06-12/sillytavern-remix-live-selfie-demo.webm
- [x] demo artifact exists: demos/sillytavern/live-production-2026-06-12/sillytavern-remix-live-selfie-demo-poster.png
- [x] demo artifact exists: demos/sillytavern/live-production-2026-06-12/result.json
- [x] demo runbook exists: demos/sillytavern/demo.md
- [x] demo includes setup target
- [x] marker present: Health Check
- [x] marker present: Preview Prompt
- [x] marker present: real image messages

### MCP Clients
Evidence: setup runbook and static adapter preflight. Public demo ready: no.
- [x] adapter exists: adapters/mcp/remix-camera-mcp-server.mjs
- [x] adapter exists: adapters/mcp/README.md
- [x] demo runbook exists: demos/mcp/demo.md
- [x] demo includes setup target
- [x] marker present: tools/list
- [x] marker present: tools/call
- [x] marker present: remix_camera_send_selfie_preview
- [x] marker present: yes=true

### RisuAI
Evidence: setup runbook and static adapter preflight. Public demo ready: no.
- [x] adapter exists: adapters/risu/remix-camera-companion-images.risu.js
- [x] demo runbook exists: demos/risu/demo.md
- [x] demo includes setup target
- [x] marker present: registerMCP
- [x] marker present: plugin:remix-camera-companion-images
- [x] marker present: yes=true

### Open WebUI
Evidence: setup runbook and static adapter preflight. Public demo ready: no.
- [x] adapter exists: adapters/openwebui/remix_camera_companion_images.py
- [x] demo runbook exists: demos/openwebui/demo.md
- [x] demo includes setup target
- [x] marker present: class Tools
- [x] marker present: yes=True
- [x] marker present: BRIDGE_URL

### LibreChat
Evidence: setup runbook and static adapter preflight. Public demo ready: no.
- [x] adapter exists: adapters/librechat/README.md
- [x] demo runbook exists: demos/librechat/demo.md
- [x] demo includes setup target
- [x] marker present: /librechat/openapi.json
- [x] marker present: yes=true
- [x] marker present: dry-run

### LobeChat
Evidence: setup runbook and static adapter preflight. Public demo ready: no.
- [x] adapter exists: adapters/lobe/README.md
- [x] demo runbook exists: demos/lobechat/demo.md
- [x] demo includes setup target
- [x] marker present: /lobe/manifest.json
- [x] marker present: Preview
- [x] marker present: yes=true

### Agnai
Evidence: setup runbook and static adapter preflight. Public demo ready: no.
- [x] adapter exists: adapters/agnai/remix-camera-agnai.user.js
- [x] demo runbook exists: demos/agnai/demo.md
- [x] demo includes setup target
- [x] marker present: @match        https://agnai.chat/*
- [x] marker present: Selfie preview
- [x] marker present: yes

### Telegram
Evidence: production bridge evidence. Public demo ready: no.
- [x] adapter exists: adapters/telegram/remix-telegram-tool.mjs
- [x] adapter exists: adapters/telegram/framework-middleware.mjs
- [x] adapter exists: adapters/telegram/lily-bot.mjs
- [x] demo artifact exists: demos/telegram/evidence-production-2026-06-12/result.json
- [x] demo artifact exists: demos/telegram/evidence-production-2026-06-12/transcript.md
- [x] demo artifact exists: demos/telegram/evidence-production-2026-06-12/transcript.html
- [x] demo runbook exists: demos/telegram/demo.md
- [x] demo includes setup target
- [x] marker present: createRemixTelegramTool
- [x] marker present: createRemixTelegramTelegrafMiddleware
- [x] marker present: LILY_PROFILE_ID
- [x] marker present: uploads local bridge images

### Discord
Evidence: setup runbook and static adapter preflight. Public demo ready: no.
- [x] adapter exists: adapters/discord/remix-discord-tool.mjs
- [x] adapter exists: adapters/discord/lily-interactions-server.mjs
- [x] demo runbook exists: demos/discord/demo.md
- [x] demo includes setup target
- [x] marker present: createRemixDiscordTool
- [x] marker present: verifyDiscordSignature
- [x] marker present: sendDiscordWebhookResult
- [x] marker present: yes:true

### WhatsApp
Evidence: setup runbook and static adapter preflight. Public demo ready: no.
- [x] adapter exists: adapters/whatsapp/remix-whatsapp-tool.mjs
- [x] adapter exists: adapters/whatsapp/lily-webhook-server.mjs
- [x] demo runbook exists: demos/whatsapp/demo.md
- [x] demo includes setup target
- [x] marker present: createRemixWhatsAppTool
- [x] marker present: handleWebhookDetailed
- [x] marker present: autoSend === false
- [x] marker present: WHATSAPP_PHONE_NUMBER_ID
- [x] marker present: uploads local bridge images

### Slack
Evidence: setup runbook and static adapter preflight. Public demo ready: no.
- [x] adapter exists: adapters/slack/remix-slack-tool.mjs
- [x] adapter exists: adapters/slack/lily-slash-command-server.mjs
- [x] demo runbook exists: demos/slack/demo.md
- [x] demo includes setup target
- [x] marker present: createRemixSlackTool
- [x] marker present: handleSlashCommandDetailed
- [x] marker present: autoSend === false
- [x] marker present: SLACK_SIGNING_SECRET
- [x] marker present: uploaded files

### LINE
Evidence: setup runbook and static adapter preflight. Public demo ready: no.
- [x] adapter exists: adapters/line/remix-line-tool.mjs
- [x] adapter exists: adapters/line/lily-webhook-server.mjs
- [x] demo runbook exists: demos/line/demo.md
- [x] demo includes setup target
- [x] marker present: createRemixLineTool
- [x] marker present: handleWebhookDetailed
- [x] marker present: autoSend === false
- [x] marker present: LINE_CHANNEL_SECRET
- [x] marker present: productionImageUrl

### Messenger
Evidence: setup runbook and static adapter preflight. Public demo ready: no.
- [x] adapter exists: adapters/messenger/remix-messenger-tool.mjs
- [x] adapter exists: adapters/messenger/lily-webhook-server.mjs
- [x] demo runbook exists: demos/messenger/demo.md
- [x] demo includes setup target
- [x] marker present: createRemixMessengerTool
- [x] marker present: handleWebhookDetailed
- [x] marker present: autoSend === false
- [x] marker present: MESSENGER_APP_SECRET
- [x] marker present: productionImageUrl

### Instagram DMs
Evidence: setup runbook and static adapter preflight. Public demo ready: no.
- [x] adapter exists: adapters/instagram/remix-instagram-tool.mjs
- [x] adapter exists: adapters/instagram/README.md
- [x] demo runbook exists: demos/instagram/demo.md
- [x] demo includes setup target
- [x] marker present: createRemixInstagramTool
- [x] marker present: verifyInstagramSignature
- [x] marker present: autoSend === false
- [x] marker present: productionImageUrl

### Microsoft Teams
Evidence: setup runbook and static adapter preflight. Public demo ready: no.
- [x] adapter exists: adapters/teams/remix-teams-tool.mjs
- [x] adapter exists: adapters/teams/README.md
- [x] demo runbook exists: demos/teams/demo.md
- [x] demo includes setup target
- [x] marker present: createRemixTeamsMessageHandler
- [x] marker present: context.sendActivity
- [x] marker present: contentUrl
- [x] marker present: autoSend === false

### Twilio SMS/MMS
Evidence: setup runbook and static adapter preflight. Public demo ready: no.
- [x] adapter exists: adapters/twilio/remix-twilio-mms-tool.mjs
- [x] adapter exists: adapters/twilio/README.md
- [x] demo runbook exists: demos/twilio/demo.md
- [x] demo includes setup target
- [x] marker present: createRemixTwilioMmsTool
- [x] marker present: MediaUrl
- [x] marker present: autoSend === false
- [x] marker present: MessagingServiceSid

### Matrix
Evidence: setup runbook and static adapter preflight. Public demo ready: no.
- [x] adapter exists: adapters/matrix/remix-matrix-tool.mjs
- [x] adapter exists: adapters/matrix/lily-sync-bot.mjs
- [x] demo runbook exists: demos/matrix/demo.md
- [x] demo includes setup target
- [x] marker present: createRemixMatrixTool
- [x] marker present: handleSyncDetailed
- [x] marker present: autoSend === false
- [x] marker present: MATRIX_ACCESS_TOKEN
- [x] marker present: m.image

### Dify
Evidence: setup runbook and static adapter preflight. Public demo ready: no.
- [x] adapter exists: adapters/dify/README.md
- [x] demo runbook exists: demos/dify/demo.md
- [x] demo includes setup target
- [x] marker present: custom OpenAPI tool
- [x] marker present: /openapi.json
- [x] marker present: /dry-run

### Flowise
Evidence: setup runbook and static adapter preflight. Public demo ready: no.
- [x] adapter exists: adapters/flowise/remix-camera-flowise-tool.js
- [x] adapter exists: adapters/flowise/README.md
- [x] demo runbook exists: demos/flowise/demo.md
- [x] demo includes setup target
- [x] marker present: remixCameraFlowiseTool
- [x] marker present: Custom Tool
- [x] marker present: preview=true
- [x] marker present: confirm=true

### Botpress
Evidence: setup runbook and static adapter preflight. Public demo ready: no.
- [x] adapter exists: adapters/botpress/remix-camera-botpress-action.js
- [x] adapter exists: adapters/botpress/README.md
- [x] demo runbook exists: demos/botpress/demo.md
- [x] demo includes setup target
- [x] marker present: remixCameraBotpressAction
- [x] marker present: Execute Code
- [x] marker present: yes=true
- [x] marker present: confirm=true

### AnythingLLM
Evidence: setup runbook and static adapter preflight. Public demo ready: no.
- [x] adapter exists: adapters/anythingllm/README.md
- [x] adapter exists: adapters/anythingllm/remix-camera-companion-images/plugin.json
- [x] adapter exists: adapters/anythingllm/remix-camera-companion-images/handler.js
- [x] demo runbook exists: demos/anythingllm/demo.md
- [x] demo includes setup target
- [x] marker present: module.exports.runtime
- [x] marker present: REMIX_BRIDGE_URL
- [x] marker present: yes=true

### TypingMind
Evidence: setup runbook and static adapter preflight. Public demo ready: no.
- [x] adapter exists: adapters/typingmind/README.md
- [x] adapter exists: adapters/typingmind/function-spec.json
- [x] adapter exists: adapters/typingmind/remix-camera-plugin.js
- [x] demo runbook exists: demos/typingmind/demo.md
- [x] demo includes setup target
- [x] marker present: remix_camera_companion_image
- [x] marker present: OpenAI Function Spec
- [x] marker present: yes=true

### Poe
Evidence: setup runbook and static adapter preflight. Public demo ready: no.
- [x] adapter exists: adapters/poe/README.md
- [x] adapter exists: adapters/poe/remix_camera_poe_bot.py
- [x] demo runbook exists: demos/poe/demo.md
- [x] demo includes setup target
- [x] marker present: fastapi_poe
- [x] marker present: PartialResponse
- [x] marker present: yes=true

### Langflow
Evidence: setup runbook and static adapter preflight. Public demo ready: no.
- [x] adapter exists: adapters/langflow/README.md
- [x] adapter exists: adapters/langflow/remix_camera_component.py
- [x] demo runbook exists: demos/langflow/demo.md
- [x] demo includes setup target
- [x] marker present: RemixCameraCompanionImages
- [x] marker present: Output
- [x] marker present: yes=true

### LangChain JS
Evidence: setup runbook and static adapter preflight. Public demo ready: no.
- [x] adapter exists: adapters/langchain/README.md
- [x] adapter exists: adapters/langchain/remix-camera-langchain-tools.mjs
- [x] demo runbook exists: demos/langchain/demo.md
- [x] demo includes setup target
- [x] marker present: createRemixCameraLangChainTools
- [x] marker present: returnDirect
- [x] marker present: yes=true

### Vercel AI SDK
Evidence: setup runbook and static adapter preflight. Public demo ready: no.
- [x] adapter exists: adapters/vercel-ai-sdk/README.md
- [x] adapter exists: adapters/vercel-ai-sdk/remix-camera-ai-sdk-tools.mjs
- [x] demo runbook exists: demos/vercel-ai-sdk/demo.md
- [x] demo includes setup target
- [x] marker present: createRemixCameraAiSdkTools
- [x] marker present: inputSchema
- [x] marker present: yes=true

### n8n
Evidence: setup runbook and static adapter preflight. Public demo ready: no.
- [x] adapter exists: adapters/n8n/README.md
- [x] adapter exists: adapters/n8n/remix-camera-n8n-workflow.json
- [x] adapter exists: adapters/n8n/remix-camera-n8n-tool.mjs
- [x] demo runbook exists: demos/n8n/demo.md
- [x] demo includes setup target
- [x] marker present: Companion Tool Webhook
- [x] marker present: REMIX_BRIDGE_URL
- [x] marker present: yes=true

### Pipedream
Evidence: setup runbook and static adapter preflight. Public demo ready: no.
- [x] adapter exists: adapters/pipedream/README.md
- [x] adapter exists: adapters/pipedream/remix-camera-pipedream-action.mjs
- [x] demo runbook exists: demos/pipedream/demo.md
- [x] demo includes setup target
- [x] marker present: remix_camera_companion_image
- [x] marker present: Pipedream
- [x] marker present: yes=true

### Make
Evidence: setup runbook and static adapter preflight. Public demo ready: no.
- [x] adapter exists: adapters/make/README.md
- [x] adapter exists: adapters/make/remix-camera-make-action-module.json
- [x] adapter exists: adapters/make/remix-camera-make-tool.mjs
- [x] demo runbook exists: demos/make/demo.md
- [x] demo includes setup target
- [x] marker present: Preview or Generate Companion Image
- [x] marker present: Make Custom Apps
- [x] marker present: yes=true

### Zapier
Evidence: setup runbook and static adapter preflight. Public demo ready: no.
- [x] adapter exists: adapters/zapier/README.md
- [x] adapter exists: adapters/zapier/remix-camera-zapier-app/index.cjs
- [x] demo runbook exists: demos/zapier/demo.md
- [x] demo includes setup target
- [x] marker present: Preview or Generate Companion Image
- [x] marker present: Zapier Platform CLI
- [x] marker present: yes=true

### Voiceflow
Evidence: setup runbook and static adapter preflight. Public demo ready: no.
- [x] adapter exists: adapters/voiceflow/README.md
- [x] adapter exists: adapters/voiceflow/remix-camera-voiceflow-api-tool.json
- [x] adapter exists: adapters/voiceflow/remix-camera-voiceflow-tool.mjs
- [x] demo runbook exists: demos/voiceflow/demo.md
- [x] demo includes setup target
- [x] marker present: Remix.Camera Companion Image
- [x] marker present: Voiceflow API tool
- [x] marker present: yes=true

### Manychat
Evidence: setup runbook and static adapter preflight. Public demo ready: no.
- [x] adapter exists: adapters/manychat/README.md
- [x] adapter exists: adapters/manychat/remix-camera-manychat-external-request.json
- [x] adapter exists: adapters/manychat/remix-camera-manychat-tool.mjs
- [x] demo runbook exists: demos/manychat/demo.md
- [x] demo includes setup target
- [x] marker present: Manychat External Request
- [x] marker present: External Request
- [x] marker present: yes=true

### Dialogflow CX
Evidence: setup runbook and static adapter preflight. Public demo ready: no.
- [x] adapter exists: adapters/dialogflow-cx/README.md
- [x] adapter exists: adapters/dialogflow-cx/remix-camera-dialogflow-cx-webhook.mjs
- [x] demo runbook exists: demos/dialogflow-cx/demo.md
- [x] demo includes setup target
- [x] marker present: Dialogflow CX webhook
- [x] marker present: fulfillment_response
- [x] marker present: yes=true

### Rasa
Evidence: setup runbook and static adapter preflight. Public demo ready: no.
- [x] adapter exists: adapters/rasa/README.md
- [x] adapter exists: adapters/rasa/remix_camera_rasa_actions.py
- [x] demo runbook exists: demos/rasa/demo.md
- [x] demo includes setup target
- [x] marker present: action_remix_camera_companion_image
- [x] marker present: dispatcher.utter_message
- [x] marker present: yes=true

## Bridge Contracts

- [x] bridge health (status 200; auth design_api_session)
- [x] OpenAPI exposes all generate endpoints (status 200)
- [x] Lobe manifest exposes preview and generate tools (status 200; apis 16)
- [x] bridge dry-run: send-selfie (status 200; template: Realistic Bedroom Selfie Girl Phone Mirror)
- [x] bridge dry-run: auto-selfie-from-chat (status 200; template: Candid Mirror Selfie Squating)
- [x] bridge dry-run: outfit-try-on (status 200; template: Bedroom Mirror Selfie White Tank Yellow Skirt Braid)
- [x] bridge dry-run: couple-photo (status 200; template: Realistic Couple Mirror Selfie Black Outfit)
- [x] bridge dry-run: couples-vacation (status 200; template: Romantic Tropical Beach Couple Golden Hour Kiss)
- [x] bridge dry-run: date-night (status 200; template: Realistic Couple Restaurant Terrace Evening Warm Light)
- [x] bridge dry-run: daily-life-snap (status 200; template: Knit Sweater Iced Coffee Cafe Candid)
- [x] bridge dry-run: private-snap (status 200; template: Adult Woman Cozy Bedroom Mirror Selfie)

## Host Adapter Dry-Runs

- [x] Telegram adapter real dry-run (command: send-selfie)
- [x] MCP adapter real dry-run (command: send-selfie)
- [x] Discord adapter real dry-run (command: send-selfie)
- [x] WhatsApp adapter real dry-run (command: send-selfie)
- [x] Slack adapter real dry-run (command: send-selfie)
- [x] LINE adapter real dry-run (command: send-selfie)
- [x] Messenger adapter real dry-run (command: send-selfie)
- [x] Instagram adapter real dry-run (command: send-selfie)
- [x] Teams adapter real dry-run (command: send-selfie)
- [x] Twilio adapter real dry-run (command: send-selfie)
- [x] Matrix adapter real dry-run (command: send-selfie)
- [x] LangChain adapter real dry-run (command: send-selfie)
- [x] Vercel AI SDK adapter real dry-run (command: send-selfie)
- [x] n8n adapter real dry-run (command: send-selfie)
- [x] Pipedream adapter real dry-run (command: send-selfie)
- [x] Make adapter real dry-run (command: send-selfie)
- [x] Zapier adapter real dry-run (command: send-selfie)
- [x] Voiceflow adapter real dry-run (command: send-selfie)
- [x] Manychat adapter real dry-run (command: send-selfie)
- [x] Dialogflow CX adapter real dry-run (command: send-selfie)
- [x] Rasa adapter real dry-run (command: send-selfie)
