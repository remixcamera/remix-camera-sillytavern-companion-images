# Remix.Camera Adapter Demo Verification

Generated at: 2026-06-12T16:50:16.469Z
Mode: bridge-dry-run
Bridge URL: http://127.0.0.1:8796

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
- [x] marker present: verifyDiscordSignature
- [x] marker present: sendDiscordWebhookResult
- [x] marker present: yes:true

### WhatsApp
- [x] adapter exists: adapters/whatsapp/remix-whatsapp-tool.mjs
- [x] adapter exists: adapters/whatsapp/lily-webhook-server.mjs
- [x] demo runbook exists: demos/whatsapp/demo.md
- [x] demo includes setup target
- [x] marker present: createRemixWhatsAppTool
- [x] marker present: WHATSAPP_PHONE_NUMBER_ID
- [x] marker present: uploads local bridge images

### Slack
- [x] adapter exists: adapters/slack/remix-slack-tool.mjs
- [x] adapter exists: adapters/slack/lily-slash-command-server.mjs
- [x] demo runbook exists: demos/slack/demo.md
- [x] demo includes setup target
- [x] marker present: createRemixSlackTool
- [x] marker present: SLACK_SIGNING_SECRET
- [x] marker present: uploaded files

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

### Botpress
- [x] adapter exists: adapters/botpress/remix-camera-botpress-action.js
- [x] adapter exists: adapters/botpress/README.md
- [x] demo runbook exists: demos/botpress/demo.md
- [x] demo includes setup target
- [x] marker present: remixCameraBotpressAction
- [x] marker present: Execute Code
- [x] marker present: yes=true

## Bridge Contracts

- [x] bridge health (status 200; auth design_api_session)
- [x] OpenAPI exposes all generate endpoints (status 200)
- [x] Lobe manifest exposes all tools (status 200)
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
- [x] Discord adapter real dry-run (command: send-selfie)
- [x] WhatsApp adapter real dry-run (command: send-selfie)
- [x] Slack adapter real dry-run (command: send-selfie)
