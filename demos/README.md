# Remix.Camera Companion Image Demos

Each folder is a host-specific demo runbook. The demos all use the same bridge contract:

1. Run `npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=<target>`.
2. Approve the Remix.Camera pairing code.
3. Run the host adapter.
4. Preview first, then generate only after explicit user intent.

Targets:

- `sillytavern/`: existing polished SillyTavern extension demo.
- `sillytavern/live-production-2026-06-12/`: real production SillyTavern screen recording, one live Lily selfie generation, no mocked output.
- `mcp/`: local stdio MCP server demo for Claude Desktop, Cursor, Cline, and MCP-compatible hosts.
- `risu/`: RisuAI MCP plugin demo.
- `openwebui/`: Open WebUI native Tool demo.
- `librechat/`: LibreChat OpenAPI Action demo.
- `lobechat/`: LobeChat plugin manifest demo.
- `chatgpt-actions/`: ChatGPT Custom GPT Actions demo.
- `agnai/`: Agnai userscript demo.
- `telegram/`: reusable Telegram bot tool plus Lily proof-of-concept demo.
- `telegram/evidence-production-2026-06-12/`: production bridge dry-run evidence for the reusable Telegram tool; real Telegram send path is documented but awaits Bot API credentials.
- `discord/`: Discord slash-command tool plus Lily proof-of-concept demo.
- `whatsapp/`: WhatsApp Cloud API tool plus Lily proof-of-concept webhook demo.
- `wechat/`: WeChat Official Account callback plus customer-service image demo.
- `viber/`: Viber Bot REST API tool plus Lily proof-of-concept webhook demo.
- `vk/`: VK community bot Callback API or Long Poll demo.
- `slack/`: Slack slash-command tool plus Lily proof-of-concept demo.
- `mattermost/`: Mattermost slash-command, outgoing-webhook, and incoming-webhook demo.
- `rocketchat/`: Rocket.Chat outgoing-integration, Apps-Engine command, and REST delivery demo.
- `line/`: LINE Messaging API tool plus Lily proof-of-concept webhook demo.
- `zalo/`: Zalo Official Account webhook and consultation-message demo.
- `kakao/`: KakaoTalk Kakao i/Open Builder Skill demo.
- `messenger/`: Messenger Platform tool plus Lily proof-of-concept webhook demo.
- `instagram/`: Instagram Messaging API tool demo.
- `teams/`: Microsoft Teams/Bot Framework message handler demo.
- `twilio/`: Twilio SMS/MMS webhook and Messages API demo.
- `matrix/`: Matrix bot tool plus Lily proof-of-concept sync demo.
- `dify/`: Dify OpenAPI custom tool demo.
- `flowise/`: Flowise Custom Tool demo.
- `botpress/`: Botpress Execute Code card or Action demo.
- `anythingllm/`: AnythingLLM custom agent skill demo.
- `typingmind/`: TypingMind plugin function demo.
- `poe/`: Poe server bot demo.
- `langflow/`: Langflow custom component demo.
- `langchain/`: LangChain JS tool wrapper demo for existing agents.
- `vercel-ai-sdk/`: Vercel AI SDK tool map demo for `generateText`, `streamText`, or agents.
- `n8n/`: n8n workflow and Code node helper demo.
- `pipedream/`: Pipedream Node.js action demo.
- `make/`: Make Custom Apps action-module demo.
- `zapier/`: Zapier Platform CLI action demo.
- `voiceflow/`: Voiceflow API tool and Workflow API step demo.
- `manychat/`: Manychat External Request action demo.
- `nomi/`: Nomi official API sidecar demo for external bots.
- `kindroid/`: Kindroid official API sidecar demo for single AI, group, and Discord-bot wrappers.
- `bot-framework/`: Microsoft Bot Framework activity handler demo.
- `dialogflow-es/`: Dialogflow ES webhook fulfillment demo.
- `dialogflow-cx/`: Dialogflow CX webhook fulfillment demo.
- `rasa/`: Rasa custom action demo.
- `amazon-lex/`: Amazon Lex V2 Lambda code-hook demo.
- `watsonx-assistant/`: IBM watsonx Assistant custom-extension demo.

Do not publish generated demo recordings until the runbook has been executed against production Remix.Camera and the inserted images are real Remix.Camera outputs.

## Support Bar

A host is demo-ready only when the evidence is recorded through that host's real UI, API, webhook, OpenAPI action, custom tool, or bot interface. Local bridge transcripts are useful engineering evidence, but they must stay labeled as bridge-only unless a real host received the message or image.

Popular hosted apps such as Character.AI, JanitorAI, Chub/Venus, SpicyChat, CrushOn, Candy, and Backyard AI are watchlist targets until they expose a reliable integration surface we can test directly. Nomi and Kindroid are supported as official API sidecars for external wrapping bots; do not describe that as native media injection inside their first-party apps. Do not record browser automation, scraped requests, or local harness output as if it were a production host demo.

## Evidence Ladder

The verifier reports one of these evidence levels for each supported target:

- `real host recording`: a production recording or artifact from the target host itself. This is the only level counted as public demo ready.
- `production bridge evidence`: real Remix.Camera bridge behavior, usually a no-credit dry-run, but not proof that the image landed inside the target host.
- `setup runbook and static adapter preflight`: adapter files, setup command, and demo instructions exist, but a real host demo still needs to be run.

Do not promote bridge-only evidence as a public demo. Bridge evidence is the engineering gate before spending credits or recording in the real host.

## Executable Verification

Run a static adapter/demo preflight:

```bash
npm run demo:verify
```

This writes:

```text
tmp/adapter-demo-verification/adapter-demo-evidence.json
tmp/adapter-demo-verification/adapter-demo-evidence.md
tmp/adapter-demo-verification/adapter-demo-evidence.html
```

Run against a paired local bridge to verify real Remix.Camera dry-run previews without spending credits:

```bash
REMIX_BRIDGE_URL=http://127.0.0.1:8787 npm run demo:verify
```

The verifier does not fabricate generated image outputs. Real video demos should be recorded from the target host after the dry-run evidence is clean, then generation should be triggered only with explicit user intent.

## Messaging Host Demo Recorder

Use the messaging recorder to create per-host, non-mocked demo evidence for Telegram, Discord, WhatsApp, Slack, Mattermost, Rocket.Chat, LINE, Messenger, Instagram, Twilio, Matrix, and VK.

No-spend bridge evidence for every messaging adapter:

```bash
npm run demo:messaging
```

Credentialed real host delivery for one platform:

```bash
TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... \
npm run demo:messaging:deliver -- \
  --target=telegram \
  --output-dir=demos/telegram/live-production-$(date +%F)
```

Credentialed real generation and host delivery, capped to one Remix.Camera generation:

```bash
TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=... \
npm run demo:messaging:deliver -- \
  --target=telegram \
  --command="/selfie cozy couch with lamp light" \
  --yes \
  --max-generations=1 \
  --output-dir=demos/telegram/live-production-$(date +%F)
```

The recorder writes a top-level `summary.json`, `summary.md`, and `summary.html` readiness matrix, plus each target's `result.json`, `transcript.md`, and `transcript.html`. It refuses to spend credits unless `--yes` is present and the planned generation count is at or below `--max-generations`.

Delivery environment variables:

| Target | Required for real host delivery |
| --- | --- |
| Telegram | `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` |
| Discord | `DISCORD_WEBHOOK_URL` |
| WhatsApp | `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TO` |
| Slack | `SLACK_BOT_TOKEN`, `SLACK_CHANNEL_ID` |
| Mattermost | `MATTERMOST_WEBHOOK_URL` |
| Rocket.Chat | `ROCKETCHAT_URL`, `ROCKETCHAT_AUTH_TOKEN`, `ROCKETCHAT_USER_ID`, `ROCKETCHAT_ROOM_ID` |
| LINE | `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_TO` |
| Messenger | `MESSENGER_PAGE_ACCESS_TOKEN`, `MESSENGER_RECIPIENT_ID` |
| Matrix | `MATRIX_HOMESERVER_URL`, `MATRIX_ACCESS_TOKEN`, `MATRIX_ROOM_ID` |

Do not use `--deliver` for public demo evidence unless the message lands in the real host. If delivery credentials are absent, the recorder labels the output as bridge-only evidence rather than host delivery.

## Current Adapter Evidence

The committed static adapter/demo preflight snapshot lives here:

```text
demos/evidence/adapter-demo-evidence.md
demos/evidence/adapter-demo-evidence.json
demos/evidence/adapter-demo-evidence.html
```

Refresh it as static preflight:

```bash
npm run demo:verify -- --output-dir=demos/evidence
```

Refresh it from a paired bridge without spending credits when you want real Remix.Camera dry-run preview evidence:

```bash
REMIX_BRIDGE_URL=http://127.0.0.1:8787 npm run demo:verify -- --output-dir=demos/evidence
```
