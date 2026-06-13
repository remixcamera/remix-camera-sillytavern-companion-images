#!/usr/bin/env node

import { execFile } from "node:child_process";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { COMPANION_COMMANDS } from "../lib/companion-tools.mjs";
import { runRemixCameraLexV2Lambda } from "../adapters/amazon-lex/remix-camera-lex-v2-lambda.mjs";
import { runRemixCameraBotFrameworkActivity } from "../adapters/bot-framework/remix-camera-bot-framework-handler.mjs";
import { runRemixCameraDialogflowCxWebhook } from "../adapters/dialogflow-cx/remix-camera-dialogflow-cx-webhook.mjs";
import { runRemixCameraDialogflowEsWebhook } from "../adapters/dialogflow-es/remix-camera-dialogflow-es-webhook.mjs";
import { runDiscordRemixInteraction } from "../adapters/discord/remix-discord-tool.mjs";
import { parseInstagramCommand, runInstagramRemixCommand } from "../adapters/instagram/remix-instagram-tool.mjs";
import { runKakaoRemixSkill } from "../adapters/kakao/remix-kakao-skill.mjs";
import { createRemixCameraLangChainTools } from "../adapters/langchain/remix-camera-langchain-tools.mjs";
import { parseLineCommand, runLineRemixCommand } from "../adapters/line/remix-line-tool.mjs";
import { parseMessengerCommand, runMessengerRemixCommand } from "../adapters/messenger/remix-messenger-tool.mjs";
import { parseMatrixCommand, runMatrixRemixCommand } from "../adapters/matrix/remix-matrix-tool.mjs";
import { handleMcpRequest, normalizeMcpToolName } from "../adapters/mcp/remix-camera-mcp-server.mjs";
import { runRemixCameraMakeTool } from "../adapters/make/remix-camera-make-tool.mjs";
import { runRemixCameraManychatTool } from "../adapters/manychat/remix-camera-manychat-tool.mjs";
import { runRemixCameraN8nTool } from "../adapters/n8n/remix-camera-n8n-tool.mjs";
import { runRemixCameraKindroidTurn } from "../adapters/kindroid/remix-camera-kindroid-tool.mjs";
import { runRemixCameraNomiTurn } from "../adapters/nomi/remix-camera-nomi-tool.mjs";
import { runRemixCameraPipedreamAction } from "../adapters/pipedream/remix-camera-pipedream-action.mjs";
import { parseSlackCommand, runSlackRemixCommand } from "../adapters/slack/remix-slack-tool.mjs";
import { parseTelegramCommand, runTelegramRemixCommand } from "../adapters/telegram/remix-telegram-tool.mjs";
import { parseTeamsCommand, runTeamsRemixCommand } from "../adapters/teams/remix-teams-tool.mjs";
import { parseTwilioCommand, runTwilioRemixCommand } from "../adapters/twilio/remix-twilio-mms-tool.mjs";
import { createRemixCameraAiSdkTools } from "../adapters/vercel-ai-sdk/remix-camera-ai-sdk-tools.mjs";
import { parseViberCommand, runViberRemixCommand } from "../adapters/viber/remix-viber-tool.mjs";
import { parseVkCommand, runVkRemixCommand } from "../adapters/vk/remix-vk-tool.mjs";
import { runRemixCameraVoiceflowTool } from "../adapters/voiceflow/remix-camera-voiceflow-tool.mjs";
import { runRemixCameraWatsonxAssistantTool } from "../adapters/watsonx-assistant/remix-camera-watsonx-tool.mjs";
import { parseWeChatCommand, runWeChatRemixCommand } from "../adapters/wechat/remix-wechat-tool.mjs";
import { parseWhatsAppCommand, runWhatsAppRemixCommand } from "../adapters/whatsapp/remix-whatsapp-tool.mjs";
import { parseZaloCommand, runZaloRemixCommand } from "../adapters/zalo/remix-zalo-tool.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const execFileAsync = promisify(execFile);
const require = createRequire(import.meta.url);
const zapierApp = require("../adapters/zapier/remix-camera-zapier-app/index.cjs");
const packageRoot = path.resolve(__dirname, "..");
const args = new Map(
  process.argv
    .slice(2)
    .filter((arg) => arg.startsWith("--") && arg.includes("="))
    .map((arg) => {
      const [key, ...rest] = arg.split("=");
      return [key, rest.join("=")];
    }),
);
const bridgeUrl = String(args.get("--bridge-url") || process.env.REMIX_BRIDGE_URL || "").replace(/\/+$/, "");
const outputDir = path.resolve(args.get("--output-dir") || path.join(packageRoot, "tmp", "adapter-demo-verification"));

const targets = [
  {
    id: "sillytavern",
    title: "SillyTavern",
    adapterFiles: ["extension/remix-camera-companion-images/index.js", "extension/remix-camera-companion-images/manifest.json"],
    artifactFiles: [
      "demos/sillytavern/live-production-2026-06-12/sillytavern-remix-live-selfie-demo.webm",
      "demos/sillytavern/live-production-2026-06-12/sillytavern-remix-live-selfie-demo-poster.png",
      "demos/sillytavern/live-production-2026-06-12/result.json",
    ],
    artifactKind: "live-production-recording",
    demoFile: "demos/sillytavern/demo.md",
    setupCommand: "--target=sillytavern",
    markers: ["Health Check", "Preview Prompt", "real image messages"],
  },
  {
    id: "mcp",
    title: "MCP Clients",
    adapterFiles: ["adapters/mcp/remix-camera-mcp-server.mjs", "adapters/mcp/README.md"],
    demoFile: "demos/mcp/demo.md",
    setupCommand: "--target=mcp",
    markers: ["tools/list", "tools/call", "remix_camera_send_selfie_preview", "yes=true"],
  },
  {
    id: "risu",
    title: "RisuAI",
    adapterFiles: ["adapters/risu/remix-camera-companion-images.risu.js"],
    demoFile: "demos/risu/demo.md",
    setupCommand: "--target=risu",
    markers: ["registerMCP", "plugin:remix-camera-companion-images", "yes=true"],
  },
  {
    id: "openwebui",
    title: "Open WebUI",
    adapterFiles: ["adapters/openwebui/remix_camera_companion_images.py"],
    demoFile: "demos/openwebui/demo.md",
    setupCommand: "--target=openwebui",
    markers: ["class Tools", "yes=True", "BRIDGE_URL"],
  },
  {
    id: "librechat",
    title: "LibreChat",
    adapterFiles: ["adapters/librechat/README.md"],
    demoFile: "demos/librechat/demo.md",
    setupCommand: "--target=librechat",
    markers: ["/librechat/openapi.json", "yes=true", "dry-run"],
  },
  {
    id: "lobechat",
    title: "LobeChat",
    adapterFiles: ["adapters/lobe/README.md"],
    demoFile: "demos/lobechat/demo.md",
    setupCommand: "--target=lobechat",
    markers: ["/lobe/manifest.json", "Preview", "yes=true"],
  },
  {
    id: "chatgpt-actions",
    title: "ChatGPT Actions",
    adapterFiles: ["adapters/chatgpt-actions/README.md"],
    demoFile: "demos/chatgpt-actions/demo.md",
    setupCommand: "--target=chatgpt-actions",
    markers: ["Custom GPT Action", "/chatgpt-actions/openapi.json", "REMIX_ACTION_API_KEY", "Auth Type: Bearer"],
  },
  {
    id: "agnai",
    title: "Agnai",
    adapterFiles: ["adapters/agnai/remix-camera-agnai.user.js"],
    demoFile: "demos/agnai/demo.md",
    setupCommand: "--target=agnai",
    markers: ["@match        https://agnai.chat/*", "Selfie preview", "yes"],
  },
  {
    id: "telegram",
    title: "Telegram",
    adapterFiles: [
      "adapters/telegram/remix-telegram-tool.mjs",
      "adapters/telegram/framework-middleware.mjs",
      "adapters/telegram/lily-bot.mjs",
    ],
    artifactFiles: [
      "demos/telegram/evidence-production-2026-06-12/result.json",
      "demos/telegram/evidence-production-2026-06-12/transcript.md",
      "demos/telegram/evidence-production-2026-06-12/transcript.html",
    ],
    artifactKind: "production-bridge-dry-run",
    demoFile: "demos/telegram/demo.md",
    setupCommand: "--target=telegram",
    markers: ["createRemixTelegramTool", "createRemixTelegramTelegrafMiddleware", "LILY_PROFILE_ID", "uploads local bridge images"],
  },
  {
    id: "discord",
    title: "Discord",
    adapterFiles: ["adapters/discord/remix-discord-tool.mjs", "adapters/discord/lily-interactions-server.mjs"],
    demoFile: "demos/discord/demo.md",
    setupCommand: "--target=discord",
    markers: ["createRemixDiscordTool", "verifyDiscordSignature", "sendDiscordWebhookResult", "yes:true"],
  },
  {
    id: "whatsapp",
    title: "WhatsApp",
    adapterFiles: ["adapters/whatsapp/remix-whatsapp-tool.mjs", "adapters/whatsapp/lily-webhook-server.mjs"],
    demoFile: "demos/whatsapp/demo.md",
    setupCommand: "--target=whatsapp",
    markers: ["createRemixWhatsAppTool", "handleWebhookDetailed", "autoSend === false", "WHATSAPP_PHONE_NUMBER_ID", "uploads local bridge images"],
  },
  {
    id: "wechat",
    title: "WeChat Official Account",
    adapterFiles: ["adapters/wechat/remix-wechat-tool.mjs", "adapters/wechat/lily-webhook-server.mjs", "adapters/wechat/README.md"],
    demoFile: "demos/wechat/demo.md",
    setupCommand: "--target=wechat",
    markers: ["createRemixWeChatTool", "handleWebhookDetailed", "WECHAT_WEBHOOK_TOKEN", "temporary media", "customer-service"],
  },
  {
    id: "viber",
    title: "Viber",
    adapterFiles: ["adapters/viber/remix-viber-tool.mjs", "adapters/viber/lily-webhook-server.mjs", "adapters/viber/README.md"],
    demoFile: "demos/viber/demo.md",
    setupCommand: "--target=viber",
    markers: ["createRemixViberTool", "handleWebhookDetailed", "x-viber-content-signature", "send_message", "public HTTPS image URLs"],
  },
  {
    id: "vk",
    title: "VK community bots",
    adapterFiles: ["adapters/vk/remix-vk-tool.mjs", "adapters/vk/README.md"],
    demoFile: "demos/vk/demo.md",
    setupCommand: "--target=vk",
    markers: ["createRemixVkTool", "message_new", "VK_ACCESS_TOKEN", "messages.send", "productionImageUrl"],
  },
  {
    id: "slack",
    title: "Slack",
    adapterFiles: ["adapters/slack/remix-slack-tool.mjs", "adapters/slack/lily-slash-command-server.mjs"],
    demoFile: "demos/slack/demo.md",
    setupCommand: "--target=slack",
    markers: ["createRemixSlackTool", "handleSlashCommandDetailed", "autoSend === false", "SLACK_SIGNING_SECRET", "uploaded files"],
  },
  {
    id: "line",
    title: "LINE",
    adapterFiles: ["adapters/line/remix-line-tool.mjs", "adapters/line/lily-webhook-server.mjs"],
    demoFile: "demos/line/demo.md",
    setupCommand: "--target=line",
    markers: ["createRemixLineTool", "handleWebhookDetailed", "autoSend === false", "LINE_CHANNEL_SECRET", "productionImageUrl"],
  },
  {
    id: "zalo",
    title: "Zalo Official Account",
    adapterFiles: ["adapters/zalo/remix-zalo-tool.mjs", "adapters/zalo/lily-webhook-server.mjs", "adapters/zalo/README.md"],
    demoFile: "demos/zalo/demo.md",
    setupCommand: "--target=zalo",
    markers: ["createRemixZaloTool", "handleWebhookDetailed", "ZALO_ACCESS_TOKEN", "/v3.0/oa/message/cs", "productionImageUrl"],
  },
  {
    id: "kakao",
    title: "KakaoTalk",
    adapterFiles: ["adapters/kakao/remix-kakao-skill.mjs", "adapters/kakao/lily-skill-server.mjs", "adapters/kakao/README.md"],
    demoFile: "demos/kakao/demo.md",
    setupCommand: "--target=kakao",
    markers: ["createRemixKakaoSkill", "simpleImage", "version: \"2.0\"", "Kakao i/Open Builder", "public image URLs"],
  },
  {
    id: "messenger",
    title: "Messenger",
    adapterFiles: ["adapters/messenger/remix-messenger-tool.mjs", "adapters/messenger/lily-webhook-server.mjs"],
    demoFile: "demos/messenger/demo.md",
    setupCommand: "--target=messenger",
    markers: ["createRemixMessengerTool", "handleWebhookDetailed", "autoSend === false", "MESSENGER_APP_SECRET", "productionImageUrl"],
  },
  {
    id: "instagram",
    title: "Instagram DMs",
    adapterFiles: ["adapters/instagram/remix-instagram-tool.mjs", "adapters/instagram/README.md"],
    demoFile: "demos/instagram/demo.md",
    setupCommand: "--target=instagram",
    markers: ["createRemixInstagramTool", "verifyInstagramSignature", "autoSend === false", "productionImageUrl"],
  },
  {
    id: "teams",
    title: "Microsoft Teams",
    adapterFiles: ["adapters/teams/remix-teams-tool.mjs", "adapters/teams/README.md"],
    demoFile: "demos/teams/demo.md",
    setupCommand: "--target=teams",
    markers: ["createRemixTeamsMessageHandler", "context.sendActivity", "contentUrl", "autoSend === false"],
  },
  {
    id: "twilio",
    title: "Twilio SMS/MMS",
    adapterFiles: ["adapters/twilio/remix-twilio-mms-tool.mjs", "adapters/twilio/README.md"],
    demoFile: "demos/twilio/demo.md",
    setupCommand: "--target=twilio",
    markers: ["createRemixTwilioMmsTool", "MediaUrl", "autoSend === false", "MessagingServiceSid"],
  },
  {
    id: "matrix",
    title: "Matrix",
    adapterFiles: ["adapters/matrix/remix-matrix-tool.mjs", "adapters/matrix/lily-sync-bot.mjs"],
    demoFile: "demos/matrix/demo.md",
    setupCommand: "--target=matrix",
    markers: ["createRemixMatrixTool", "handleSyncDetailed", "autoSend === false", "MATRIX_ACCESS_TOKEN", "m.image"],
  },
  {
    id: "dify",
    title: "Dify",
    adapterFiles: ["adapters/dify/README.md"],
    demoFile: "demos/dify/demo.md",
    setupCommand: "--target=dify",
    markers: ["custom OpenAPI tool", "/openapi.json", "/dry-run"],
  },
  {
    id: "flowise",
    title: "Flowise",
    adapterFiles: ["adapters/flowise/remix-camera-flowise-tool.js", "adapters/flowise/README.md"],
    demoFile: "demos/flowise/demo.md",
    setupCommand: "--target=flowise",
    markers: ["remixCameraFlowiseTool", "Custom Tool", "preview=true", "confirm=true"],
  },
  {
    id: "botpress",
    title: "Botpress",
    adapterFiles: ["adapters/botpress/remix-camera-botpress-action.js", "adapters/botpress/README.md"],
    demoFile: "demos/botpress/demo.md",
    setupCommand: "--target=botpress",
    markers: ["remixCameraBotpressAction", "Execute Code", "yes=true", "confirm=true"],
  },
  {
    id: "anythingllm",
    title: "AnythingLLM",
    adapterFiles: [
      "adapters/anythingllm/README.md",
      "adapters/anythingllm/remix-camera-companion-images/plugin.json",
      "adapters/anythingllm/remix-camera-companion-images/handler.js",
    ],
    demoFile: "demos/anythingllm/demo.md",
    setupCommand: "--target=anythingllm",
    markers: ["module.exports.runtime", "REMIX_BRIDGE_URL", "yes=true"],
  },
  {
    id: "typingmind",
    title: "TypingMind",
    adapterFiles: ["adapters/typingmind/README.md", "adapters/typingmind/function-spec.json", "adapters/typingmind/remix-camera-plugin.js"],
    demoFile: "demos/typingmind/demo.md",
    setupCommand: "--target=typingmind",
    markers: ["remix_camera_companion_image", "OpenAI Function Spec", "yes=true"],
  },
  {
    id: "poe",
    title: "Poe",
    adapterFiles: ["adapters/poe/README.md", "adapters/poe/remix_camera_poe_bot.py"],
    demoFile: "demos/poe/demo.md",
    setupCommand: "--target=poe",
    markers: ["fastapi_poe", "PartialResponse", "yes=true"],
  },
  {
    id: "langflow",
    title: "Langflow",
    adapterFiles: ["adapters/langflow/README.md", "adapters/langflow/remix_camera_component.py"],
    demoFile: "demos/langflow/demo.md",
    setupCommand: "--target=langflow",
    markers: ["RemixCameraCompanionImages", "Output", "yes=true"],
  },
  {
    id: "langchain",
    title: "LangChain JS",
    adapterFiles: ["adapters/langchain/README.md", "adapters/langchain/remix-camera-langchain-tools.mjs"],
    demoFile: "demos/langchain/demo.md",
    setupCommand: "--target=langchain",
    markers: ["createRemixCameraLangChainTools", "returnDirect", "yes=true"],
  },
  {
    id: "vercel-ai-sdk",
    title: "Vercel AI SDK",
    adapterFiles: ["adapters/vercel-ai-sdk/README.md", "adapters/vercel-ai-sdk/remix-camera-ai-sdk-tools.mjs"],
    demoFile: "demos/vercel-ai-sdk/demo.md",
    setupCommand: "--target=vercel-ai-sdk",
    markers: ["createRemixCameraAiSdkTools", "inputSchema", "yes=true"],
  },
  {
    id: "n8n",
    title: "n8n",
    adapterFiles: ["adapters/n8n/README.md", "adapters/n8n/remix-camera-n8n-workflow.json", "adapters/n8n/remix-camera-n8n-tool.mjs"],
    demoFile: "demos/n8n/demo.md",
    setupCommand: "--target=n8n",
    markers: ["Companion Tool Webhook", "REMIX_BRIDGE_URL", "yes=true"],
  },
  {
    id: "pipedream",
    title: "Pipedream",
    adapterFiles: ["adapters/pipedream/README.md", "adapters/pipedream/remix-camera-pipedream-action.mjs"],
    demoFile: "demos/pipedream/demo.md",
    setupCommand: "--target=pipedream",
    markers: ["remix_camera_companion_image", "Pipedream", "yes=true"],
  },
  {
    id: "make",
    title: "Make",
    adapterFiles: ["adapters/make/README.md", "adapters/make/remix-camera-make-action-module.json", "adapters/make/remix-camera-make-tool.mjs"],
    demoFile: "demos/make/demo.md",
    setupCommand: "--target=make",
    markers: ["Preview or Generate Companion Image", "Make Custom Apps", "yes=true"],
  },
  {
    id: "zapier",
    title: "Zapier",
    adapterFiles: ["adapters/zapier/README.md", "adapters/zapier/remix-camera-zapier-app/index.cjs"],
    demoFile: "demos/zapier/demo.md",
    setupCommand: "--target=zapier",
    markers: ["Preview or Generate Companion Image", "Zapier Platform CLI", "yes=true"],
  },
  {
    id: "voiceflow",
    title: "Voiceflow",
    adapterFiles: [
      "adapters/voiceflow/README.md",
      "adapters/voiceflow/remix-camera-voiceflow-api-tool.json",
      "adapters/voiceflow/remix-camera-voiceflow-tool.mjs",
    ],
    demoFile: "demos/voiceflow/demo.md",
    setupCommand: "--target=voiceflow",
    markers: ["Remix.Camera Companion Image", "Voiceflow API tool", "yes=true"],
  },
  {
    id: "manychat",
    title: "Manychat",
    adapterFiles: [
      "adapters/manychat/README.md",
      "adapters/manychat/remix-camera-manychat-external-request.json",
      "adapters/manychat/remix-camera-manychat-tool.mjs",
    ],
    demoFile: "demos/manychat/demo.md",
    setupCommand: "--target=manychat",
    markers: ["Manychat External Request", "External Request", "yes=true"],
  },
  {
    id: "nomi",
    title: "Nomi",
    adapterFiles: ["adapters/nomi/README.md", "adapters/nomi/remix-camera-nomi-tool.mjs"],
    demoFile: "demos/nomi/demo.md",
    setupCommand: "--target=nomi",
    markers: ["official Nomi API", "external-bot-sidecar", "yes: true"],
  },
  {
    id: "kindroid",
    title: "Kindroid",
    adapterFiles: ["adapters/kindroid/README.md", "adapters/kindroid/remix-camera-kindroid-tool.mjs"],
    demoFile: "demos/kindroid/demo.md",
    setupCommand: "--target=kindroid",
    markers: ["official Kindroid API", "X-Kindroid-Requester", "yes: true"],
  },
  {
    id: "bot-framework",
    title: "Microsoft Bot Framework",
    adapterFiles: ["adapters/bot-framework/README.md", "adapters/bot-framework/remix-camera-bot-framework-handler.mjs"],
    demoFile: "demos/bot-framework/demo.md",
    setupCommand: "--target=bot-framework",
    markers: ["createRemixBotFrameworkTurnHandler", "Hero Card", "yes"],
  },
  {
    id: "dialogflow-es",
    title: "Dialogflow ES",
    adapterFiles: ["adapters/dialogflow-es/README.md", "adapters/dialogflow-es/remix-camera-dialogflow-es-webhook.mjs"],
    demoFile: "demos/dialogflow-es/demo.md",
    setupCommand: "--target=dialogflow-es",
    markers: ["Dialogflow ES", "fulfillmentMessages", "yes=true"],
  },
  {
    id: "dialogflow-cx",
    title: "Dialogflow CX",
    adapterFiles: ["adapters/dialogflow-cx/README.md", "adapters/dialogflow-cx/remix-camera-dialogflow-cx-webhook.mjs"],
    demoFile: "demos/dialogflow-cx/demo.md",
    setupCommand: "--target=dialogflow-cx",
    markers: ["Dialogflow CX webhook", "fulfillment_response", "yes=true"],
  },
  {
    id: "rasa",
    title: "Rasa",
    adapterFiles: ["adapters/rasa/README.md", "adapters/rasa/remix_camera_rasa_actions.py"],
    demoFile: "demos/rasa/demo.md",
    setupCommand: "--target=rasa",
    markers: ["action_remix_camera_companion_image", "dispatcher.utter_message", "yes=true"],
  },
  {
    id: "amazon-lex",
    title: "Amazon Lex V2",
    adapterFiles: ["adapters/amazon-lex/README.md", "adapters/amazon-lex/remix-camera-lex-v2-lambda.mjs"],
    demoFile: "demos/amazon-lex/demo.md",
    setupCommand: "--target=amazon-lex",
    markers: ["Lex V2", "sessionState", "yes=true"],
  },
  {
    id: "watsonx-assistant",
    title: "IBM watsonx Assistant",
    adapterFiles: [
      "adapters/watsonx-assistant/README.md",
      "adapters/watsonx-assistant/remix-camera-watsonx-extension.openapi.json",
      "adapters/watsonx-assistant/remix-camera-watsonx-tool.mjs",
    ],
    demoFile: "demos/watsonx-assistant/demo.md",
    setupCommand: "--target=watsonx-assistant",
    markers: ["custom extension", "OpenAPI", "yes=true"],
  },
];

const commandInputs = {
  "send-selfie": {
    characterName: "Lily",
    mood: "cozy couch with lamp light",
    location: "cozy couch with lamp light",
    visualIdentity: "clearly adult companion, realistic phone-camera presence, consistent Lily profile",
  },
  "auto-selfie-from-chat": {
    characterName: "Lily",
    chatText: "User: show me the couch setup tonight. Lily: Fine, but the lamp is doing half the work.",
    visualIdentity: "clearly adult companion, realistic phone-camera presence, consistent Lily profile",
  },
  "outfit-try-on": {
    characterName: "Lily",
    sourceImageUrl: "https://remix.camera/examples/ai-companion-image-toolset/outfit-try-on-input.jpg",
    outfit: "red sundress and white sneakers",
    visualIdentity: "clearly adult companion, realistic phone-camera presence, consistent Lily profile",
  },
  "couple-photo": {
    characterName: "Lily",
    userConsent: "yes",
    userDescription: "consenting adult man, casual black t-shirt",
    location: "coffee shop booth",
    visualIdentity: "clearly adult companion, realistic phone-camera presence, consistent Lily profile",
  },
  "couples-vacation": {
    characterName: "Lily",
    userConsent: "yes",
    userDescription: "consenting adult man, casual travel outfit",
    theme: "Amalfi coast weekend",
    maxGenerations: 3,
    visualIdentity: "clearly adult companion, realistic phone-camera presence, consistent Lily profile",
  },
  "date-night": {
    characterName: "Lily",
    location: "quiet restaurant booth",
    mood: "warm date-night",
    visualIdentity: "clearly adult companion, realistic phone-camera presence, consistent Lily profile",
  },
  "daily-life-snap": {
    characterName: "Lily",
    chatText: "morning coffee on the couch",
    location: "morning coffee on the couch",
    visualIdentity: "clearly adult companion, realistic phone-camera presence, consistent Lily profile",
  },
  "private-snap": {
    characterName: "Lily",
    matureContent: true,
    location: "warm bedroom mirror snap",
    snapTtlSeconds: 120,
    visualIdentity: "clearly adult companion, realistic phone-camera presence, consistent Lily profile",
  },
};

function rel(filePath) {
  return path.relative(packageRoot, filePath);
}

async function fileExists(filePath) {
  try {
    const info = await stat(filePath);
    return info.isFile();
  } catch {
    return false;
  }
}

async function readRelative(relativePath) {
  return readFile(path.join(packageRoot, relativePath), "utf8");
}

function okCheck(name, ok, details = {}) {
  return {
    name,
    ok: Boolean(ok),
    ...details,
  };
}

async function verifyStaticTarget(target) {
  const checks = [];
  for (const adapterFile of target.adapterFiles) {
    const absolutePath = path.join(packageRoot, adapterFile);
    checks.push(okCheck(`adapter exists: ${adapterFile}`, await fileExists(absolutePath), { path: adapterFile }));
  }
  for (const artifactFile of target.artifactFiles || []) {
    const absolutePath = path.join(packageRoot, artifactFile);
    checks.push(okCheck(`demo artifact exists: ${artifactFile}`, await fileExists(absolutePath), { path: artifactFile }));
  }

  const demoPath = path.join(packageRoot, target.demoFile);
  const hasDemo = await fileExists(demoPath);
  checks.push(okCheck(`demo runbook exists: ${target.demoFile}`, hasDemo, { path: target.demoFile }));
  if (hasDemo) {
    const demoText = await readFile(demoPath, "utf8");
    checks.push(okCheck("demo includes setup target", demoText.includes(target.setupCommand), { expected: target.setupCommand }));
  }

  const allTextParts = [];
  for (const file of [...target.adapterFiles, target.demoFile]) {
    if (await fileExists(path.join(packageRoot, file))) {
      allTextParts.push(await readRelative(file));
    }
  }
  const allText = allTextParts.join("\n\n");
  for (const marker of target.markers) {
    checks.push(okCheck(`marker present: ${marker}`, allText.includes(marker), { marker }));
  }

  return checks;
}

async function summarizeTargetEvidence(target) {
  const artifactFiles = target.artifactFiles || [];
  const missingArtifacts = [];
  for (const artifactFile of artifactFiles) {
    if (!(await fileExists(path.join(packageRoot, artifactFile)))) {
      missingArtifacts.push(artifactFile);
    }
  }

  const artifactsComplete = artifactFiles.length > 0 && missingArtifacts.length === 0;
  if (target.artifactKind === "live-production-recording" && artifactsComplete) {
    return {
      status: "live-production-recording",
      publicDemoReady: true,
      evidenceLevel: "real host recording",
      missingArtifacts,
      nextStep: "Keep recording current when behavior or UI changes.",
    };
  }
  if (target.artifactKind === "production-bridge-dry-run" && artifactsComplete) {
    return {
      status: "production-bridge-dry-run",
      publicDemoReady: false,
      evidenceLevel: "production bridge evidence",
      missingArtifacts,
      nextStep: "Record a real host-delivery demo after platform credentials are present.",
    };
  }
  if (artifactFiles.length > 0) {
    return {
      status: "artifact-incomplete",
      publicDemoReady: false,
      evidenceLevel: "runbook with missing artifacts",
      missingArtifacts,
      nextStep: "Regenerate or restore the missing demo artifacts.",
    };
  }
  return {
    status: "runbook-ready",
    publicDemoReady: false,
    evidenceLevel: "setup runbook and static adapter preflight",
    missingArtifacts,
    nextStep: "Run this target in the real host and add production demo evidence.",
  };
}

async function requestBridge(pathname, options = {}) {
  if (!bridgeUrl) {
    return null;
  }
  const response = await fetch(`${bridgeUrl}${pathname}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  return {
    ok: response.ok && payload?.ok !== false,
    status: response.status,
    payload,
  };
}

async function verifyBridgeContracts() {
  if (!bridgeUrl) {
    return [
      okCheck("bridge dry-run previews", false, {
        skipped: true,
        reason: "Set REMIX_BRIDGE_URL or pass --bridge-url=http://127.0.0.1:8787 to run real dry-run previews.",
      }),
    ];
  }

  const checks = [];
  const health = await requestBridge("/health");
  checks.push(okCheck("bridge health", health?.ok, { status: health?.status, authMode: health?.payload?.authMode }));

  const openApi = await requestBridge("/openapi.json");
  checks.push(
    okCheck("OpenAPI exposes all generate endpoints", COMPANION_COMMANDS.every((command) => openApi?.payload?.paths?.[`/v1/tools/${command.name}/generate`]), {
      status: openApi?.status,
    }),
  );

  const chatGptOpenApi = await requestBridge("/chatgpt-actions/openapi.json");
  checks.push(
    okCheck(
      "ChatGPT Actions OpenAPI exposes bearer-secured generate endpoints",
      COMPANION_COMMANDS.every((command) => chatGptOpenApi?.payload?.paths?.[`/chatgpt-actions/v1/tools/${command.name}/generate`]?.post?.security?.[0]?.bearerAuth) &&
        chatGptOpenApi?.payload?.components?.securitySchemes?.bearerAuth?.scheme === "bearer",
      {
        status: chatGptOpenApi?.status,
      },
    ),
  );

  const lobe = await requestBridge("/lobe/manifest.json");
  const lobeApis = Array.isArray(lobe?.payload?.api) ? lobe.payload.api : [];
  const lobeHasAllTools = COMPANION_COMMANDS.every(
    (command) =>
      lobeApis.some((api) => api.name === `${command.toolName}Preview` && String(api.url || "").endsWith(`/v1/tools/${command.name}/dry-run`)) &&
      lobeApis.some((api) => api.name === command.toolName && String(api.url || "").endsWith(`/v1/tools/${command.name}/generate`)),
  );
  checks.push(
    okCheck("Lobe manifest exposes preview and generate tools", lobeHasAllTools, {
      status: lobe?.status,
      apiCount: lobeApis.length,
    }),
  );

  for (const command of COMPANION_COMMANDS) {
    const preview = await requestBridge(`/v1/tools/${command.name}/dry-run`, {
      method: "POST",
      body: JSON.stringify(commandInputs[command.name]),
    });
    checks.push(
      okCheck(`bridge dry-run: ${command.name}`, preview?.ok && preview?.payload?.dryRun === true && typeof preview?.payload?.prompt === "string", {
        status: preview?.status,
        promptTemplate: preview?.payload?.promptTemplate?.packTitle || preview?.payload?.promptTemplate?.packId || null,
      }),
    );
  }

  return checks;
}

async function verifyHostAdapterDryRuns() {
  const checks = [];
  if (!bridgeUrl) {
    checks.push(
      okCheck("Telegram adapter real dry-run", false, {
        skipped: true,
        reason: "No bridge URL provided.",
      }),
    );
    checks.push(
      okCheck("MCP adapter real dry-run", false, {
        skipped: true,
        reason: "No bridge URL provided.",
      }),
    );
    checks.push(
      okCheck("ChatGPT Actions adapter real dry-run", false, {
        skipped: true,
        reason: "No bridge URL provided.",
      }),
    );
    checks.push(
      okCheck("Discord adapter real dry-run", false, {
        skipped: true,
        reason: "No bridge URL provided.",
      }),
    );
    checks.push(
      okCheck("WhatsApp adapter real dry-run", false, {
        skipped: true,
        reason: "No bridge URL provided.",
      }),
    );
    checks.push(
      okCheck("WeChat Official Account adapter real dry-run", false, {
        skipped: true,
        reason: "No bridge URL provided.",
      }),
    );
    checks.push(
      okCheck("Viber adapter real dry-run", false, {
        skipped: true,
        reason: "No bridge URL provided.",
      }),
    );
    checks.push(
      okCheck("VK community bot adapter real dry-run", false, {
        skipped: true,
        reason: "No bridge URL provided.",
      }),
    );
    checks.push(
      okCheck("Slack adapter real dry-run", false, {
        skipped: true,
        reason: "No bridge URL provided.",
      }),
    );
    checks.push(
      okCheck("LINE adapter real dry-run", false, {
        skipped: true,
        reason: "No bridge URL provided.",
      }),
    );
    checks.push(
      okCheck("Zalo Official Account adapter real dry-run", false, {
        skipped: true,
        reason: "No bridge URL provided.",
      }),
    );
    checks.push(
      okCheck("KakaoTalk adapter real dry-run", false, {
        skipped: true,
        reason: "No bridge URL provided.",
      }),
    );
    checks.push(
      okCheck("Messenger adapter real dry-run", false, {
        skipped: true,
        reason: "No bridge URL provided.",
      }),
    );
    checks.push(
      okCheck("Instagram adapter real dry-run", false, {
        skipped: true,
        reason: "No bridge URL provided.",
      }),
    );
    checks.push(
      okCheck("Teams adapter real dry-run", false, {
        skipped: true,
        reason: "No bridge URL provided.",
      }),
    );
    checks.push(
      okCheck("Twilio adapter real dry-run", false, {
        skipped: true,
        reason: "No bridge URL provided.",
      }),
    );
    checks.push(
      okCheck("Matrix adapter real dry-run", false, {
        skipped: true,
        reason: "No bridge URL provided.",
      }),
    );
    checks.push(
      okCheck("LangChain adapter real dry-run", false, {
        skipped: true,
        reason: "No bridge URL provided.",
      }),
    );
    checks.push(
      okCheck("Vercel AI SDK adapter real dry-run", false, {
        skipped: true,
        reason: "No bridge URL provided.",
      }),
    );
    checks.push(
      okCheck("n8n adapter real dry-run", false, {
        skipped: true,
        reason: "No bridge URL provided.",
      }),
    );
    checks.push(
      okCheck("Pipedream adapter real dry-run", false, {
        skipped: true,
        reason: "No bridge URL provided.",
      }),
    );
    checks.push(
      okCheck("Make adapter real dry-run", false, {
        skipped: true,
        reason: "No bridge URL provided.",
      }),
    );
    checks.push(
      okCheck("Zapier adapter real dry-run", false, {
        skipped: true,
        reason: "No bridge URL provided.",
      }),
    );
    checks.push(
      okCheck("Voiceflow adapter real dry-run", false, {
        skipped: true,
        reason: "No bridge URL provided.",
      }),
    );
    checks.push(
      okCheck("Manychat adapter real dry-run", false, {
        skipped: true,
        reason: "No bridge URL provided.",
      }),
    );
    checks.push(
      okCheck("Nomi adapter real dry-run", false, {
        skipped: true,
        reason: "No bridge URL provided.",
      }),
    );
    checks.push(
      okCheck("Kindroid adapter real dry-run", false, {
        skipped: true,
        reason: "No bridge URL provided.",
      }),
    );
    checks.push(
      okCheck("Microsoft Bot Framework adapter real dry-run", false, {
        skipped: true,
        reason: "No bridge URL provided.",
      }),
    );
    checks.push(
      okCheck("Dialogflow ES adapter real dry-run", false, {
        skipped: true,
        reason: "No bridge URL provided.",
      }),
    );
    checks.push(
      okCheck("Dialogflow CX adapter real dry-run", false, {
        skipped: true,
        reason: "No bridge URL provided.",
      }),
    );
    checks.push(
      okCheck("Rasa adapter real dry-run", false, {
        skipped: true,
        reason: "No bridge URL provided.",
      }),
    );
    checks.push(
      okCheck("Amazon Lex V2 adapter real dry-run", false, {
        skipped: true,
        reason: "No bridge URL provided.",
      }),
    );
    checks.push(
      okCheck("IBM watsonx Assistant adapter real dry-run", false, {
        skipped: true,
        reason: "No bridge URL provided.",
      }),
    );
    return checks;
  }

  const actionApiKey = String(process.env.REMIX_ACTION_API_KEY || "").trim();

  const telegram = await runTelegramRemixCommand(parseTelegramCommand("/preview selfie cozy couch with lamp light"), {
    bridgeUrl,
    profileId: process.env.REMIX_PROFILE_ID || "",
    characterName: "Lily",
  });
  checks.push(
    okCheck("Telegram adapter real dry-run", telegram?.payload?.dryRun === true && /Preview ready/i.test(telegram.text), {
      command: telegram?.command,
    }),
  );

  const mcp = await handleMcpRequest(
    {
      jsonrpc: "2.0",
      id: "mcp-preview",
      method: "tools/call",
      params: {
        name: normalizeMcpToolName("send-selfie", "dry-run"),
        arguments: commandInputs["send-selfie"],
      },
    },
    {
      bridgeUrl,
      profileId: process.env.REMIX_PROFILE_ID || "",
      characterName: "Lily",
    },
  );
  checks.push(
    okCheck("MCP adapter real dry-run", mcp?.result?.structuredContent?.payload?.dryRun === true && /Preview ready/i.test(mcp?.result?.content?.[0]?.text || ""), {
      command: "send-selfie",
    }),
  );

  if (actionApiKey) {
    const chatGptAction = await requestBridge("/chatgpt-actions/v1/tools/send-selfie/dry-run", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${actionApiKey}`,
      },
      body: JSON.stringify(commandInputs["send-selfie"]),
    });
    checks.push(
      okCheck("ChatGPT Actions adapter real dry-run", chatGptAction?.payload?.dryRun === true && typeof chatGptAction?.payload?.prompt === "string", {
        command: "send-selfie",
        status: chatGptAction?.status,
      }),
    );
  } else {
    checks.push(
      okCheck("ChatGPT Actions adapter real dry-run", false, {
        skipped: true,
        reason: "Set REMIX_ACTION_API_KEY on the bridge and verifier to test the authenticated ChatGPT Actions route.",
      }),
    );
  }

  const discord = await runDiscordRemixInteraction(
    {
      data: {
        name: "preview",
        options: [
          { name: "tool", value: "send-selfie" },
          { name: "prompt", value: "cozy couch with lamp light" },
        ],
      },
    },
    {
      bridgeUrl,
      profileId: process.env.REMIX_PROFILE_ID || "",
      characterName: "Lily",
    },
  );
  checks.push(
    okCheck("Discord adapter real dry-run", discord?.payload?.dryRun === true && /Preview ready/i.test(discord.text), {
      command: discord?.command,
    }),
  );

  const whatsapp = await runWhatsAppRemixCommand(parseWhatsAppCommand("preview selfie cozy couch with lamp light"), {
    bridgeUrl,
    profileId: process.env.REMIX_PROFILE_ID || "",
    characterName: "Lily",
  });
  checks.push(
    okCheck("WhatsApp adapter real dry-run", whatsapp?.payload?.dryRun === true && /Preview ready/i.test(whatsapp.text), {
      command: whatsapp?.command,
    }),
  );

  const wechat = await runWeChatRemixCommand(parseWeChatCommand("preview selfie cozy couch with lamp light"), {
    bridgeUrl,
    profileId: process.env.REMIX_PROFILE_ID || "",
    characterName: "Lily",
  });
  checks.push(
    okCheck("WeChat Official Account adapter real dry-run", wechat?.payload?.dryRun === true && /Preview ready/i.test(wechat.text), {
      command: wechat?.command,
    }),
  );

  const viber = await runViberRemixCommand(parseViberCommand("preview selfie cozy couch with lamp light"), {
    bridgeUrl,
    profileId: process.env.REMIX_PROFILE_ID || "",
    characterName: "Lily",
  });
  checks.push(
    okCheck("Viber adapter real dry-run", viber?.payload?.dryRun === true && /Preview ready/i.test(viber.text), {
      command: viber?.command,
    }),
  );

  const vk = await runVkRemixCommand(parseVkCommand("preview selfie cozy couch with lamp light"), {
    bridgeUrl,
    profileId: process.env.REMIX_PROFILE_ID || "",
    characterName: "Lily",
  });
  checks.push(
    okCheck("VK community bot adapter real dry-run", vk?.payload?.dryRun === true && /Preview ready/i.test(vk.text), {
      command: vk?.command,
    }),
  );

  const slack = await runSlackRemixCommand(parseSlackCommand("preview selfie cozy couch with lamp light"), {
    bridgeUrl,
    profileId: process.env.REMIX_PROFILE_ID || "",
    characterName: "Lily",
  });
  checks.push(
    okCheck("Slack adapter real dry-run", slack?.payload?.dryRun === true && /Preview ready/i.test(slack.text), {
      command: slack?.command,
    }),
  );

  const line = await runLineRemixCommand(parseLineCommand("preview selfie cozy couch with lamp light"), {
    bridgeUrl,
    profileId: process.env.REMIX_PROFILE_ID || "",
    characterName: "Lily",
  });
  checks.push(
    okCheck("LINE adapter real dry-run", line?.payload?.dryRun === true && /Preview ready/i.test(line.text), {
      command: line?.command,
    }),
  );

  const zalo = await runZaloRemixCommand(parseZaloCommand("preview selfie cozy couch with lamp light"), {
    bridgeUrl,
    profileId: process.env.REMIX_PROFILE_ID || "",
    characterName: "Lily",
  });
  checks.push(
    okCheck("Zalo Official Account adapter real dry-run", zalo?.payload?.dryRun === true && /Preview ready/i.test(zalo.text), {
      command: zalo?.command,
    }),
  );

  const kakao = await runKakaoRemixSkill(
    {
      userRequest: { utterance: "preview selfie cozy couch with lamp light" },
    },
    {
      bridgeUrl,
      profileId: process.env.REMIX_PROFILE_ID || "",
      characterName: "Lily",
    },
  );
  checks.push(
    okCheck(
      "KakaoTalk adapter real dry-run",
      kakao?.result?.payload?.dryRun === true && /Preview ready/i.test(kakao?.response?.template?.outputs?.[0]?.simpleText?.text || ""),
      {
        command: kakao?.parsed?.command,
      },
    ),
  );

  const messenger = await runMessengerRemixCommand(parseMessengerCommand("preview selfie cozy couch with lamp light"), {
    bridgeUrl,
    profileId: process.env.REMIX_PROFILE_ID || "",
    characterName: "Lily",
  });
  checks.push(
    okCheck("Messenger adapter real dry-run", messenger?.payload?.dryRun === true && /Preview ready/i.test(messenger.text), {
      command: messenger?.command,
    }),
  );

  const instagram = await runInstagramRemixCommand(parseInstagramCommand("preview selfie cozy couch with lamp light"), {
    bridgeUrl,
    profileId: process.env.REMIX_PROFILE_ID || "",
    characterName: "Lily",
  });
  checks.push(
    okCheck("Instagram adapter real dry-run", instagram?.payload?.dryRun === true && /Preview ready/i.test(instagram.text), {
      command: instagram?.command,
    }),
  );

  const teams = await runTeamsRemixCommand(parseTeamsCommand("preview selfie cozy couch with lamp light"), {
    bridgeUrl,
    profileId: process.env.REMIX_PROFILE_ID || "",
    characterName: "Lily",
  });
  checks.push(
    okCheck("Teams adapter real dry-run", teams?.payload?.dryRun === true && /Preview ready/i.test(teams.text), {
      command: teams?.command,
    }),
  );

  const twilio = await runTwilioRemixCommand(parseTwilioCommand("preview selfie cozy couch with lamp light"), {
    bridgeUrl,
    profileId: process.env.REMIX_PROFILE_ID || "",
    characterName: "Lily",
  });
  checks.push(
    okCheck("Twilio adapter real dry-run", twilio?.payload?.dryRun === true && /Preview ready/i.test(twilio.text), {
      command: twilio?.command,
    }),
  );

  const matrix = await runMatrixRemixCommand(parseMatrixCommand("preview selfie cozy couch with lamp light"), {
    bridgeUrl,
    profileId: process.env.REMIX_PROFILE_ID || "",
    characterName: "Lily",
  });
  checks.push(
    okCheck("Matrix adapter real dry-run", matrix?.payload?.dryRun === true && /Preview ready/i.test(matrix.text), {
      command: matrix?.command,
    }),
  );

  const langChainTools = createRemixCameraLangChainTools({
    tool: (fn, config) => ({ ...config, invoke: fn }),
    bridgeUrl,
    profileId: process.env.REMIX_PROFILE_ID || "",
    characterName: "Lily",
    commands: ["send-selfie"],
    includeGenerateTools: false,
  });
  const langChainText = await langChainTools[0].invoke(commandInputs["send-selfie"]);
  checks.push(
    okCheck("LangChain adapter real dry-run", /Preview ready/i.test(langChainText), {
      command: "send-selfie",
    }),
  );

  const aiSdkTools = createRemixCameraAiSdkTools({
    tool: (definition) => definition,
    bridgeUrl,
    profileId: process.env.REMIX_PROFILE_ID || "",
    characterName: "Lily",
    commands: ["send-selfie"],
    includeGenerateTools: false,
  });
  const aiSdk = await aiSdkTools.remix_camera_send_selfie_preview.execute(commandInputs["send-selfie"]);
  checks.push(
    okCheck("Vercel AI SDK adapter real dry-run", aiSdk?.payload?.dryRun === true && /Preview ready/i.test(aiSdk?.text || ""), {
      command: "send-selfie",
    }),
  );

  const n8n = await runRemixCameraN8nTool(commandInputs["send-selfie"], {
    bridgeUrl,
    profileId: process.env.REMIX_PROFILE_ID || "",
    characterName: "Lily",
  });
  checks.push(
    okCheck("n8n adapter real dry-run", n8n?.payload?.dryRun === true && /Preview ready/i.test(n8n?.text || ""), {
      command: "send-selfie",
    }),
  );

  const pipedream = await runRemixCameraPipedreamAction(commandInputs["send-selfie"], {
    bridgeUrl,
    profileId: process.env.REMIX_PROFILE_ID || "",
    characterName: "Lily",
  });
  checks.push(
    okCheck("Pipedream adapter real dry-run", pipedream?.payload?.dryRun === true && /Preview ready/i.test(pipedream?.text || ""), {
      command: "send-selfie",
    }),
  );

  const make = await runRemixCameraMakeTool(commandInputs["send-selfie"], {
    bridgeUrl,
    profileId: process.env.REMIX_PROFILE_ID || "",
    characterName: "Lily",
  });
  checks.push(
    okCheck("Make adapter real dry-run", make?.payload?.dryRun === true && /Preview ready/i.test(make?.text || ""), {
      command: "send-selfie",
    }),
  );

  const zapier = await zapierApp._test.perform(
    {
      request: async (options) => {
        const response = await fetch(options.url, {
          method: options.method || "GET",
          headers: options.headers,
          body: options.body,
        });
        return {
          json: await response.json().catch(() => ({})),
          status: response.status,
        };
      },
    },
    {
      inputData: {
        ...commandInputs["send-selfie"],
        bridgeUrl,
        command: "send-selfie",
        action: "dry-run",
      },
    },
  );
  checks.push(
    okCheck("Zapier adapter real dry-run", zapier?.dryRun === true && /Preview ready/i.test(zapier?.text || ""), {
      command: "send-selfie",
    }),
  );

  const voiceflow = await runRemixCameraVoiceflowTool(commandInputs["send-selfie"], {
    bridgeUrl,
    profileId: process.env.REMIX_PROFILE_ID || "",
    characterName: "Lily",
  });
  checks.push(
    okCheck("Voiceflow adapter real dry-run", voiceflow?.payload?.dryRun === true && /Preview ready/i.test(voiceflow?.text || ""), {
      command: "send-selfie",
    }),
  );

  const manychat = await runRemixCameraManychatTool(commandInputs["send-selfie"], {
    bridgeUrl,
    profileId: process.env.REMIX_PROFILE_ID || "",
    characterName: "Lily",
  });
  checks.push(
    okCheck("Manychat adapter real dry-run", manychat?.payload?.dryRun === true && /Preview ready/i.test(manychat?.text || ""), {
      command: "send-selfie",
    }),
  );

  const nomi = await runRemixCameraNomiTurn(
    {
      ...commandInputs["send-selfie"],
      callNomi: false,
    },
    {
      bridgeUrl,
      profileId: process.env.REMIX_PROFILE_ID || "",
      characterName: "Lily",
    },
  );
  checks.push(
    okCheck("Nomi adapter real dry-run", nomi?.payload?.dryRun === true && /Preview ready/i.test(nomi?.text || ""), {
      command: "send-selfie",
      mediaDelivery: nomi?.mediaDelivery,
    }),
  );

  const kindroid = await runRemixCameraKindroidTurn(
    {
      ...commandInputs["send-selfie"],
      callKindroid: false,
    },
    {
      bridgeUrl,
      profileId: process.env.REMIX_PROFILE_ID || "",
      characterName: "Lily",
    },
  );
  checks.push(
    okCheck("Kindroid adapter real dry-run", kindroid?.payload?.dryRun === true && /Preview ready/i.test(kindroid?.text || ""), {
      command: "send-selfie",
      mediaDelivery: kindroid?.mediaDelivery,
    }),
  );

  const botFramework = await runRemixCameraBotFrameworkActivity(
    {
      type: "message",
      text: "selfie cozy couch with lamp light",
    },
    {
      bridgeUrl,
      profileId: process.env.REMIX_PROFILE_ID || "",
      characterName: "Lily",
    },
  );
  checks.push(
    okCheck(
      "Microsoft Bot Framework adapter real dry-run",
      botFramework?.dryRun === true && /Preview ready/i.test(botFramework?.activities?.[0]?.text || botFramework?.text || ""),
      {
        command: "send-selfie",
      },
    ),
  );

  const dialogflowEs = await runRemixCameraDialogflowEsWebhook(
    {
      session: "projects/remix-camera/agent/sessions/adapter-demo",
      queryResult: {
        queryText: "cozy couch with lamp light",
        intent: { displayName: "remix_camera_send_selfie_preview" },
        parameters: {
          command: "send-selfie",
          action: "dry-run",
          characterName: "Lily",
        },
      },
    },
    {
      bridgeUrl,
      profileId: process.env.REMIX_PROFILE_ID || "",
      characterName: "Lily",
    },
  );
  checks.push(
    okCheck(
      "Dialogflow ES adapter real dry-run",
      dialogflowEs?.payload?.remixCamera?.dryRun === true &&
        /Preview ready/i.test(dialogflowEs?.fulfillmentMessages?.[0]?.text?.text?.[0] || ""),
      {
        command: "send-selfie",
      },
    ),
  );

  const dialogflowCx = await runRemixCameraDialogflowCxWebhook(
    {
      fulfillmentInfo: { tag: "remix_camera_send_selfie_preview" },
      text: "cozy couch with lamp light",
      sessionInfo: {
        parameters: {
          command: "send-selfie",
          action: "dry-run",
          characterName: "Lily",
        },
      },
    },
    {
      bridgeUrl,
      profileId: process.env.REMIX_PROFILE_ID || "",
      characterName: "Lily",
    },
  );
  checks.push(
    okCheck(
      "Dialogflow CX adapter real dry-run",
      dialogflowCx?.session_info?.parameters?.remix_dry_run === true &&
        /Preview ready/i.test(dialogflowCx?.fulfillment_response?.messages?.[0]?.text?.text?.[0] || ""),
      {
        command: "send-selfie",
      },
    ),
  );

  const rasaSource = `
import json
import sys
sys.path.insert(0, ${JSON.stringify(path.join(packageRoot, "adapters", "rasa"))})
from remix_camera_rasa_actions import run_remix_camera_rasa_tool
result = run_remix_camera_rasa_tool({"command": "send-selfie", "prompt": "cozy couch with lamp light", "characterName": "Lily"}, bridge_url=${JSON.stringify(bridgeUrl)})
print(json.dumps(result))
`;
  const rasaRun = await execFileAsync("python3", ["-c", rasaSource], {
    timeout: 120000,
    maxBuffer: 1024 * 1024,
  });
  const rasa = JSON.parse(rasaRun.stdout || "{}");
  checks.push(
    okCheck("Rasa adapter real dry-run", rasa?.dryRun === true && /Preview ready/i.test(rasa?.text || ""), {
      command: "send-selfie",
    }),
  );

  const amazonLex = await runRemixCameraLexV2Lambda(
    {
      inputTranscript: "cozy couch with lamp light",
      invocationLabel: "remix_camera_send_selfie_preview",
      sessionState: {
        intent: {
          name: "RemixCameraImage",
          slots: {
            remix_character_name: { value: { interpretedValue: "Lily" } },
          },
        },
        sessionAttributes: {},
      },
    },
    {
      bridgeUrl,
      profileId: process.env.REMIX_PROFILE_ID || "",
      characterName: "Lily",
    },
  );
  checks.push(
    okCheck(
      "Amazon Lex V2 adapter real dry-run",
      amazonLex?.sessionState?.sessionAttributes?.remix_dry_run === "true" &&
        /Preview ready/i.test(amazonLex?.messages?.[0]?.content || ""),
      {
        command: "send-selfie",
      },
    ),
  );

  const watsonx = await runRemixCameraWatsonxAssistantTool(commandInputs["send-selfie"], {
    bridgeUrl,
    profileId: process.env.REMIX_PROFILE_ID || "",
    characterName: "Lily",
  });
  checks.push(
    okCheck("IBM watsonx Assistant adapter real dry-run", watsonx?.payload?.dryRun === true && /Preview ready/i.test(watsonx?.text || ""), {
      command: "send-selfie",
    }),
  );

  return checks;
}

function renderMarkdownReport(evidence) {
  const detailText = (check) => {
    const details = [];
    if (check.status) details.push(`status ${check.status}`);
    if (check.authMode) details.push(`auth ${check.authMode}`);
    if (check.promptTemplate) details.push(`template: ${check.promptTemplate}`);
    if (check.command) details.push(`command: ${check.command}`);
    if (check.apiCount) details.push(`apis ${check.apiCount}`);
    return details.length ? ` (${details.join("; ")})` : "";
  };
  const lines = [
    "# Remix.Camera Adapter Demo Verification",
    "",
    `Generated at: ${evidence.generatedAt}`,
    `Mode: ${evidence.mode}`,
    `Bridge URL: ${evidence.bridgeUrl || "not provided"}`,
    "",
    "## Demo Evidence Status",
    "",
    "| Target | Evidence level | Public demo ready | Next step |",
    "| --- | --- | --- | --- |",
  ];
  for (const target of evidence.targets) {
    lines.push(
      `| ${target.title} | ${target.demoEvidence.evidenceLevel} | ${target.demoEvidence.publicDemoReady ? "yes" : "no"} | ${target.demoEvidence.nextStep} |`,
    );
  }
  lines.push(
    "",
    `Public demo ready targets: ${evidence.demoSummary.publicDemoReadyCount}/${evidence.demoSummary.targetCount}`,
    "",
    "## Targets",
    "",
  );
  for (const target of evidence.targets) {
    lines.push(`### ${target.title}`);
    lines.push(
      `Evidence: ${target.demoEvidence.evidenceLevel}. Public demo ready: ${target.demoEvidence.publicDemoReady ? "yes" : "no"}.`,
    );
    for (const check of target.checks) {
      const marker = check.ok ? "[x]" : check.skipped ? "[ ]" : "[!]";
      const suffix = check.reason ? ` - ${check.reason}` : "";
      lines.push(`- ${marker} ${check.name}${detailText(check)}${suffix}`);
    }
    lines.push("");
  }
  lines.push("## Bridge Contracts", "");
  for (const check of evidence.bridgeChecks) {
    const marker = check.ok ? "[x]" : check.skipped ? "[ ]" : "[!]";
    const suffix = check.reason ? ` - ${check.reason}` : "";
    lines.push(`- ${marker} ${check.name}${detailText(check)}${suffix}`);
  }
  lines.push("", "## Host Adapter Dry-Runs", "");
  for (const check of evidence.hostAdapterChecks) {
    const marker = check.ok ? "[x]" : check.skipped ? "[ ]" : "[!]";
    const suffix = check.reason ? ` - ${check.reason}` : "";
    lines.push(`- ${marker} ${check.name}${detailText(check)}${suffix}`);
  }
  lines.push("");
  return lines.join("\n");
}

function renderHtmlReport(evidence) {
  const esc = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const detailHtml = (check) => {
    const details = [];
    if (check.status) details.push(`status ${check.status}`);
    if (check.authMode) details.push(`auth ${check.authMode}`);
    if (check.promptTemplate) details.push(`template: ${check.promptTemplate}`);
    if (check.command) details.push(`command: ${check.command}`);
    if (check.apiCount) details.push(`apis ${check.apiCount}`);
    if (check.reason) details.push(check.reason);
    return details.length ? ` <small>${esc(details.join("; "))}</small>` : "";
  };
  const targetCards = evidence.targets
    .map(
      (target) => `
        <section>
          <h2>${esc(target.title)}</h2>
          <p><strong>Evidence:</strong> ${esc(target.demoEvidence.evidenceLevel)}<br>
          <strong>Public demo ready:</strong> ${target.demoEvidence.publicDemoReady ? "yes" : "no"}<br>
          <small>${esc(target.demoEvidence.nextStep)}</small></p>
          <ul>${target.checks
            .map((check) => `<li class="${check.ok ? "ok" : check.skipped ? "skip" : "fail"}">${check.ok ? "OK" : check.skipped ? "SKIP" : "FAIL"} ${esc(check.name)}${detailHtml(check)}</li>`)
            .join("")}</ul>
        </section>`,
    )
    .join("");
  const bridgeItems = [...evidence.bridgeChecks, ...evidence.hostAdapterChecks]
    .map((check) => `<li class="${check.ok ? "ok" : check.skipped ? "skip" : "fail"}">${check.ok ? "OK" : check.skipped ? "SKIP" : "FAIL"} ${esc(check.name)}${detailHtml(check)}</li>`)
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Remix.Camera Adapter Demo Verification</title>
  <style>
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #171717; color: #f7f7f8; }
    main { max-width: 1120px; margin: 0 auto; padding: 32px 20px; }
    h1 { margin: 0 0 8px; font-size: 32px; }
    p { color: #b8b8b8; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; margin-top: 24px; }
    section { border: 1px solid #333; background: #222; border-radius: 8px; padding: 16px; }
    h2 { margin: 0 0 12px; font-size: 18px; }
    ul { padding-left: 0; list-style: none; margin: 0; display: grid; gap: 8px; }
    li { border-left: 4px solid #666; padding-left: 10px; color: #ddd; }
    li.ok { border-color: #d1fe17; }
    li.skip { border-color: #888; color: #aaa; }
    li.fail { border-color: #ff6b6b; color: #ffd4d4; }
    small { display: block; color: #999; margin-top: 2px; }
  </style>
</head>
<body>
  <main>
    <h1>Remix.Camera Adapter Demo Verification</h1>
    <p>Generated at ${esc(evidence.generatedAt)}. Mode: ${esc(evidence.mode)}. Bridge: ${esc(evidence.bridgeUrl || "not provided")}.</p>
    <p>Public demo ready targets: ${esc(evidence.demoSummary.publicDemoReadyCount)}/${esc(evidence.demoSummary.targetCount)}. Bridge-only or runbook-only evidence is intentionally not counted as a public host recording.</p>
    <div class="grid">${targetCards}</div>
    <section style="margin-top:14px">
      <h2>Bridge and Host Adapter Checks</h2>
      <ul>${bridgeItems}</ul>
    </section>
  </main>
</body>
</html>`;
}

const evidence = {
  ok: false,
  generatedAt: new Date().toISOString(),
  mode: bridgeUrl ? "bridge-dry-run" : "static-adapter-demo-preflight",
  bridgeUrl: bridgeUrl || null,
  targets: [],
  demoSummary: {
    targetCount: 0,
    publicDemoReadyCount: 0,
    productionBridgeEvidenceCount: 0,
    runbookOnlyCount: 0,
  },
  bridgeChecks: [],
  hostAdapterChecks: [],
  outputs: {},
};

for (const target of targets) {
  const demoEvidence = await summarizeTargetEvidence(target);
  evidence.targets.push({
    id: target.id,
    title: target.title,
    demoEvidence,
    checks: await verifyStaticTarget(target),
  });
}
evidence.demoSummary = {
  targetCount: evidence.targets.length,
  publicDemoReadyCount: evidence.targets.filter((target) => target.demoEvidence.publicDemoReady).length,
  productionBridgeEvidenceCount: evidence.targets.filter((target) => target.demoEvidence.status === "production-bridge-dry-run").length,
  runbookOnlyCount: evidence.targets.filter((target) => target.demoEvidence.status === "runbook-ready").length,
};
evidence.bridgeChecks = await verifyBridgeContracts();
evidence.hostAdapterChecks = await verifyHostAdapterDryRuns();

const allChecks = [
  ...evidence.targets.flatMap((target) => target.checks),
  ...evidence.bridgeChecks.filter((check) => !check.skipped),
  ...evidence.hostAdapterChecks.filter((check) => !check.skipped),
];
evidence.ok = allChecks.every((check) => check.ok);

await mkdir(outputDir, { recursive: true });
const jsonPath = path.join(outputDir, "adapter-demo-evidence.json");
const markdownPath = path.join(outputDir, "adapter-demo-evidence.md");
const htmlPath = path.join(outputDir, "adapter-demo-evidence.html");
await writeFile(jsonPath, `${JSON.stringify(evidence, null, 2)}\n`);
await writeFile(markdownPath, renderMarkdownReport(evidence));
await writeFile(htmlPath, renderHtmlReport(evidence));
evidence.outputs = {
  jsonPath: rel(jsonPath),
  markdownPath: rel(markdownPath),
  htmlPath: rel(htmlPath),
};
await writeFile(jsonPath, `${JSON.stringify(evidence, null, 2)}\n`);

console.log(JSON.stringify(evidence, null, 2));
if (!evidence.ok) {
  process.exitCode = 1;
}
