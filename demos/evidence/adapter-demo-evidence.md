# Remix.Camera Adapter Demo Verification

Generated at: 2026-06-13T05:03:21.977Z
Mode: static-adapter-demo-preflight
Bridge URL: not provided

## Targets

### SillyTavern
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

### RisuAI
- [x] adapter exists: adapters/risu/remix-camera-companion-images.risu.js
- [x] demo runbook exists: demos/risu/demo.md
- [x] demo includes setup target
- [x] marker present: registerMCP
- [x] marker present: plugin:remix-camera-companion-images
- [x] marker present: yes=true

### Open WebUI
- [x] adapter exists: adapters/openwebui/remix_camera_companion_images.py
- [x] demo runbook exists: demos/openwebui/demo.md
- [x] demo includes setup target
- [x] marker present: class Tools
- [x] marker present: yes=True
- [x] marker present: BRIDGE_URL

### LibreChat
- [x] adapter exists: adapters/librechat/README.md
- [x] demo runbook exists: demos/librechat/demo.md
- [x] demo includes setup target
- [x] marker present: /librechat/openapi.json
- [x] marker present: yes=true
- [x] marker present: dry-run

### LobeChat
- [x] adapter exists: adapters/lobe/README.md
- [x] demo runbook exists: demos/lobechat/demo.md
- [x] demo includes setup target
- [x] marker present: /lobe/manifest.json
- [x] marker present: Preview
- [x] marker present: yes=true

### Agnai
- [x] adapter exists: adapters/agnai/remix-camera-agnai.user.js
- [x] demo runbook exists: demos/agnai/demo.md
- [x] demo includes setup target
- [x] marker present: @match        https://agnai.chat/*
- [x] marker present: Selfie preview
- [x] marker present: yes

### Telegram
- [x] adapter exists: adapters/telegram/remix-telegram-tool.mjs
- [x] adapter exists: adapters/telegram/lily-bot.mjs
- [x] demo artifact exists: demos/telegram/evidence-production-2026-06-12/result.json
- [x] demo artifact exists: demos/telegram/evidence-production-2026-06-12/transcript.md
- [x] demo artifact exists: demos/telegram/evidence-production-2026-06-12/transcript.html
- [x] demo runbook exists: demos/telegram/demo.md
- [x] demo includes setup target
- [x] marker present: createRemixTelegramTool
- [x] marker present: LILY_PROFILE_ID
- [x] marker present: uploads local bridge images

### Discord
- [x] adapter exists: adapters/discord/remix-discord-tool.mjs
- [x] adapter exists: adapters/discord/lily-interactions-server.mjs
- [x] demo runbook exists: demos/discord/demo.md
- [x] demo includes setup target
- [x] marker present: createRemixDiscordTool
- [x] marker present: verifyDiscordSignature
- [x] marker present: sendDiscordWebhookResult
- [x] marker present: yes:true

### WhatsApp
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
- [x] adapter exists: adapters/messenger/remix-messenger-tool.mjs
- [x] adapter exists: adapters/messenger/lily-webhook-server.mjs
- [x] demo runbook exists: demos/messenger/demo.md
- [x] demo includes setup target
- [x] marker present: createRemixMessengerTool
- [x] marker present: handleWebhookDetailed
- [x] marker present: autoSend === false
- [x] marker present: MESSENGER_APP_SECRET
- [x] marker present: productionImageUrl

### Matrix
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
- [x] adapter exists: adapters/dify/README.md
- [x] demo runbook exists: demos/dify/demo.md
- [x] demo includes setup target
- [x] marker present: custom OpenAPI tool
- [x] marker present: /openapi.json
- [x] marker present: /dry-run

### Flowise
- [x] adapter exists: adapters/flowise/remix-camera-flowise-tool.js
- [x] adapter exists: adapters/flowise/README.md
- [x] demo runbook exists: demos/flowise/demo.md
- [x] demo includes setup target
- [x] marker present: remixCameraFlowiseTool
- [x] marker present: Custom Tool
- [x] marker present: preview=true
- [x] marker present: confirm=true

### Botpress
- [x] adapter exists: adapters/botpress/remix-camera-botpress-action.js
- [x] adapter exists: adapters/botpress/README.md
- [x] demo runbook exists: demos/botpress/demo.md
- [x] demo includes setup target
- [x] marker present: remixCameraBotpressAction
- [x] marker present: Execute Code
- [x] marker present: yes=true
- [x] marker present: confirm=true

### AnythingLLM
- [x] adapter exists: adapters/anythingllm/README.md
- [x] adapter exists: adapters/anythingllm/remix-camera-companion-images/plugin.json
- [x] adapter exists: adapters/anythingllm/remix-camera-companion-images/handler.js
- [x] demo runbook exists: demos/anythingllm/demo.md
- [x] demo includes setup target
- [x] marker present: module.exports.runtime
- [x] marker present: REMIX_BRIDGE_URL
- [x] marker present: yes=true

### TypingMind
- [x] adapter exists: adapters/typingmind/README.md
- [x] adapter exists: adapters/typingmind/function-spec.json
- [x] adapter exists: adapters/typingmind/remix-camera-plugin.js
- [x] demo runbook exists: demos/typingmind/demo.md
- [x] demo includes setup target
- [x] marker present: remix_camera_companion_image
- [x] marker present: OpenAI Function Spec
- [x] marker present: yes=true

### Poe
- [x] adapter exists: adapters/poe/README.md
- [x] adapter exists: adapters/poe/remix_camera_poe_bot.py
- [x] demo runbook exists: demos/poe/demo.md
- [x] demo includes setup target
- [x] marker present: fastapi_poe
- [x] marker present: PartialResponse
- [x] marker present: yes=true

### Langflow
- [x] adapter exists: adapters/langflow/README.md
- [x] adapter exists: adapters/langflow/remix_camera_component.py
- [x] demo runbook exists: demos/langflow/demo.md
- [x] demo includes setup target
- [x] marker present: RemixCameraCompanionImages
- [x] marker present: Output
- [x] marker present: yes=true

## Bridge Contracts

- [ ] bridge dry-run previews - Set REMIX_BRIDGE_URL or pass --bridge-url=http://127.0.0.1:8787 to run real dry-run previews.

## Host Adapter Dry-Runs

- [ ] Telegram adapter real dry-run - No bridge URL provided.
- [ ] Discord adapter real dry-run - No bridge URL provided.
- [ ] WhatsApp adapter real dry-run - No bridge URL provided.
- [ ] Slack adapter real dry-run - No bridge URL provided.
- [ ] LINE adapter real dry-run - No bridge URL provided.
- [ ] Messenger adapter real dry-run - No bridge URL provided.
- [ ] Matrix adapter real dry-run - No bridge URL provided.
