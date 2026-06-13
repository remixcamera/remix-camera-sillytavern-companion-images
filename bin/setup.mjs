#!/usr/bin/env node

import { spawn } from "node:child_process";
import { constants as fsConstants } from "node:fs";
import { access, chmod, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const extensionSource = path.join(packageRoot, "extension", "remix-camera-companion-images");
const bridgePath = path.join(packageRoot, "bridge", "server.mjs");
const adapterRoot = path.join(packageRoot, "adapters");
const DEFAULT_API_BASE_URL = "https://remix.camera";
const DEFAULT_CONFIG_DIR = path.join(os.homedir(), ".remix-camera");
const DEFAULT_CONFIG_PATH = path.join(DEFAULT_CONFIG_DIR, "sillytavern-bridge.json");
const SUPPORTED_TARGETS = new Set([
  "sillytavern",
  "mcp",
  "risu",
  "openwebui",
  "librechat",
  "lobechat",
  "chatgpt-actions",
  "agnai",
  "telegram",
  "discord",
  "whatsapp",
  "wechat",
  "viber",
  "slack",
  "line",
  "zalo",
  "kakao",
  "messenger",
  "instagram",
  "teams",
  "twilio",
  "matrix",
  "dify",
  "flowise",
  "botpress",
  "anythingllm",
  "typingmind",
  "poe",
  "langflow",
  "langchain",
  "vercel-ai-sdk",
  "n8n",
  "pipedream",
  "make",
  "zapier",
  "voiceflow",
  "manychat",
  "nomi",
  "kindroid",
  "bot-framework",
  "dialogflow-es",
  "dialogflow-cx",
  "rasa",
  "amazon-lex",
  "watsonx-assistant",
]);

function printHelp() {
  console.log(`Remix.Camera SillyTavern setup

Usage:
  Public GitHub package:
  npx --yes github:remixcamera/remix-camera-sillytavern-companion-images [options]

  Npm package after publish:
  npx @remix-camera/sillytavern-setup [options]

Options:
  --target=sillytavern|mcp|risu|openwebui|librechat|lobechat|chatgpt-actions|agnai|telegram|discord|whatsapp|wechat|viber|slack|line|zalo|kakao|messenger|instagram|teams|twilio|matrix|dify|flowise|botpress|anythingllm|typingmind|poe|langflow|langchain|vercel-ai-sdk|n8n|pipedream|make|zapier|voiceflow|manychat|nomi|kindroid|bot-framework|dialogflow-es|dialogflow-cx|rasa|amazon-lex|watsonx-assistant
  --sillytavern-dir=/path/to/SillyTavern  Use a specific local SillyTavern checkout
  --profile-id=profile_id                 Use a specific Remix.Camera character profile
  --character-name="Name"                 Override the Character Card name
  --user=default-user                     SillyTavern user data folder name
  --port=8787                             Local bridge port
  --api-base-url=https://remix.camera      Remix.Camera API base URL
  --config=/path/to/config.json           Bridge config output path
  --client-name="Device name"             Name shown on the Remix.Camera pairing page
  --no-open                               Do not open browser windows
  --no-start                              Install/configure only; do not start the bridge
  --help                                  Show this help

What it does:
  1. Detects your local SillyTavern install
  2. Opens Remix.Camera for device-code pairing
  3. Installs or updates the SillyTavern extension
  4. Writes a local scoped bridge token outside the browser
  5. Downloads a personalized Character Card PNG
  6. Starts the local bridge and opens the health check

For non-SillyTavern targets, setup pairs the local bridge and prints the
target-specific adapter or manifest URL.
`);
}

function argValue(name) {
  const prefix = `${name}=`;
  const match = process.argv.slice(2).find((arg) => arg === name || arg.startsWith(prefix));
  if (!match) {
    return null;
  }
  if (match === name) {
    const index = process.argv.indexOf(name);
    return process.argv[index + 1] || "";
  }
  return match.slice(prefix.length);
}

function hasFlag(name) {
  return process.argv.slice(2).includes(name);
}

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function safeFileName(name) {
  return String(name || "remix-companion")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "remix-companion";
}

function selectedTarget() {
  const target = (argValue("--target") || "sillytavern").toLowerCase();
  if (!SUPPORTED_TARGETS.has(target)) {
    throw new Error(`Unsupported target "${target}". Use one of: ${[...SUPPORTED_TARGETS].join(", ")}`);
  }
  return target;
}

function allowedOriginsForTarget(target) {
  const explicit = argValue("--allowed-origins") || process.env.REMIX_ALLOWED_ORIGINS;
  if (explicit) {
    return explicit.split(",").map((origin) => origin.trim()).filter(Boolean);
  }
  const origins = new Set([
    "http://127.0.0.1:8000",
    "http://localhost:8000",
    "http://[::1]:8000",
  ]);
  if (target === "agnai") {
    origins.add("https://agnai.chat");
    origins.add("http://localhost:3001");
    origins.add("http://127.0.0.1:3001");
  }
  if (target === "typingmind") {
    origins.add("https://typingmind.com");
    origins.add("https://www.typingmind.com");
    origins.add("https://custom.typingmind.com");
  }
  return [...origins];
}

async function exists(filePath) {
  try {
    await access(filePath, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function looksLikeSillyTavern(dir) {
  if (!dir) {
    return false;
  }
  const packageJsonPath = path.join(dir, "package.json");
  const hasPublicExtensions = await exists(path.join(dir, "public", "scripts", "extensions.js"));
  const hasDataDir = await exists(path.join(dir, "data"));
  if (!hasPublicExtensions && !hasDataDir) {
    return false;
  }
  if (!(await exists(packageJsonPath))) {
    return hasDataDir;
  }
  try {
    const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8"));
    return /sillytavern/i.test(`${packageJson.name || ""} ${packageJson.description || ""}`) || hasDataDir;
  } catch {
    return hasDataDir;
  }
}

async function findSillyTavernDir() {
  const explicit = argValue("--sillytavern-dir") || process.env.SILLYTAVERN_DIR;
  const candidates = [
    explicit,
    process.cwd(),
    path.join(os.homedir(), "SillyTavern"),
    path.join(os.homedir(), "sillytavern"),
    path.join(os.homedir(), "Documents", "SillyTavern"),
    path.join(os.homedir(), "Developer", "SillyTavern"),
    path.join(os.homedir(), "Projects", "SillyTavern"),
    path.join(os.homedir(), "code", "SillyTavern"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (await looksLikeSillyTavern(resolved)) {
      return resolved;
    }
  }

  throw new Error("Could not find SillyTavern. Re-run with --sillytavern-dir=/path/to/SillyTavern.");
}

async function postJson(apiBaseUrl, pathname, body, token = null) {
  const response = await fetch(`${apiBaseUrl}${pathname}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let payload = {};
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { raw: text };
    }
  }
  if (!response.ok) {
    const message = payload?.error?.message || payload?.error || `Request failed with ${response.status}`;
    throw new Error(message);
  }
  return { response, payload };
}

async function getJson(apiBaseUrl, pathname, token) {
  const response = await fetch(`${apiBaseUrl}${pathname}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.error?.message || payload?.error || `Request failed with ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

function openUrl(url) {
  const platform = process.platform;
  const command = platform === "darwin" ? "open" : platform === "win32" ? "cmd" : "xdg-open";
  const args = platform === "win32" ? ["/c", "start", "", url] : [url];
  const child = spawn(command, args, { detached: true, stdio: "ignore" });
  child.unref();
}

async function pairDevice(apiBaseUrl, target) {
  const clientName = argValue("--client-name") || `${os.hostname()} ${target}`;
  const { payload } = await postJson(apiBaseUrl, "/api/v1/design/auth/device/start", {
    clientName,
    source: target,
  });
  if (!payload?.deviceCode || !payload?.userCode || !payload?.verificationUriComplete) {
    throw new Error("Device pairing response was incomplete.");
  }

  console.log("");
  console.log(`Open Remix.Camera and approve this ${target} device:`);
  console.log(`  ${payload.verificationUriComplete}`);
  console.log("");
  console.log(`Pairing code: ${payload.userCode}`);
  console.log("");

  if (!hasFlag("--no-open")) {
    openUrl(payload.verificationUriComplete);
  }

  const expiresAt = Date.parse(payload.expiresAt || "");
  const intervalMs = Math.max(2, Number(payload.intervalSeconds || 3)) * 1000;
  while (!Number.isFinite(expiresAt) || Date.now() < expiresAt) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
    const { payload: pollPayload } = await postJson(apiBaseUrl, "/api/v1/design/auth/device/poll", {
      deviceCode: payload.deviceCode,
    });
    if (pollPayload?.ok && pollPayload.sessionToken) {
      return pollPayload;
    }
    if (pollPayload?.status === "authorization_pending") {
      process.stdout.write(".");
      continue;
    }
    throw new Error(pollPayload?.error?.message || pollPayload?.status || "Pairing failed.");
  }

  throw new Error("Pairing code expired before approval.");
}

async function writeBridgeConfig(config) {
  const configPath = argValue("--config") || process.env.REMIX_CONFIG_FILE || DEFAULT_CONFIG_PATH;
  await mkdir(path.dirname(configPath), { recursive: true });
  try {
    await chmod(path.dirname(configPath), 0o700);
  } catch {
    // Best effort on platforms that support POSIX modes.
  }
  await writeFile(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  try {
    await chmod(configPath, 0o600);
  } catch {
    // Best effort on platforms that support POSIX modes.
  }
  return configPath;
}

async function selectProfile(apiBaseUrl, sessionToken, pairedProfileId) {
  const payload = await getJson(apiBaseUrl, "/api/v1/design/profiles", sessionToken);
  const profiles = Array.isArray(payload?.profiles) ? payload.profiles : [];
  if (profiles.length === 0) {
    throw new Error("This account does not have a Remix.Camera profile yet. Create one on /account/sillytavern or /camera, then re-run setup.");
  }
  const requestedProfileId = argValue("--profile-id") || pairedProfileId || "";
  const requested = profiles.find((profile) => profile.id === requestedProfileId);
  return requested || profiles.find((profile) => profile.fluxReady) || profiles[0];
}

async function downloadCharacterCard(apiBaseUrl, sessionToken, profile, characterName, characterDir) {
  const response = await fetch(`${apiBaseUrl}/api/v1/design/sillytavern/character-card`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sessionToken}`,
    },
    body: JSON.stringify({
      profileId: profile.id,
      characterName,
    }),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload?.error?.message || payload?.error || `Character card request failed with ${response.status}`);
  }
  const arrayBuffer = await response.arrayBuffer();
  const disposition = response.headers.get("content-disposition") || "";
  const fileNameMatch = disposition.match(/filename="([^"]+)"/);
  const fileName = fileNameMatch?.[1] || `${safeFileName(characterName)}.character.png`;
  await mkdir(characterDir, { recursive: true });
  const outputPath = path.join(characterDir, fileName);
  await writeFile(outputPath, Buffer.from(arrayBuffer));
  return outputPath;
}

async function installExtension(sillyTavernDir, userName = "default-user") {
  const extensionTarget = path.join(sillyTavernDir, "data", userName, "extensions", "remix-camera-companion-images");
  await mkdir(path.dirname(extensionTarget), { recursive: true });
  await cp(extensionSource, extensionTarget, {
    recursive: true,
    force: true,
  });
  return extensionTarget;
}

async function startBridge(configPath, extraEnv = {}) {
  if (hasFlag("--no-start")) {
    return null;
  }
  const port = argValue("--port") || process.env.REMIX_BRIDGE_PORT || "8787";
  const child = spawn(process.execPath, [bridgePath], {
    detached: true,
    stdio: "ignore",
    env: {
      ...process.env,
      ...extraEnv,
      REMIX_CONFIG_FILE: configPath,
      REMIX_BRIDGE_PORT: port,
    },
  });
  child.unref();
  const healthUrl = `http://127.0.0.1:${port}/health`;
  await new Promise((resolve) => setTimeout(resolve, 900));
  if (!hasFlag("--no-open")) {
    openUrl(healthUrl);
  }
  return healthUrl;
}

function printTargetInstructions(target, { healthUrl, port, configPath }) {
  const bridgeUrl = `http://127.0.0.1:${port}`;
  const instructions = {
    mcp: [
      "Add this local stdio MCP server to Claude Desktop, Cursor, Cline, or another MCP client:",
      `  ${path.join(adapterRoot, "mcp", "remix-camera-mcp-server.mjs")}`,
      "Example MCP server command:",
      `  REMIX_BRIDGE_URL=${bridgeUrl} node ${path.join(adapterRoot, "mcp", "remix-camera-mcp-server.mjs")}`,
      "The server exposes no-spend preview tools plus guarded generate tools that require yes=true.",
    ],
    risu: [
      "Install the RisuAI plugin file:",
      `  ${path.join(adapterRoot, "risu", "remix-camera-companion-images.risu.js")}`,
      "Then set bridge_url to:",
      `  ${bridgeUrl}`,
      "Risu exposes the tools through its MCP plugin surface.",
    ],
    openwebui: [
      "Create an Open WebUI Tool from this Python file:",
      `  ${path.join(adapterRoot, "openwebui", "remix_camera_companion_images.py")}`,
      "Set BRIDGE_URL in the Tool valves to:",
      `  ${bridgeUrl}`,
      "Use yes=True only after the user explicitly asks to spend a generation.",
    ],
    librechat: [
      "Add a LibreChat OpenAPI Action using this local schema URL:",
      `  ${bridgeUrl}/librechat/openapi.json`,
      "The schema includes guarded generate endpoints and dry-run preview endpoints.",
    ],
    lobechat: [
      "Install a LobeChat custom plugin with this manifest URL:",
      `  ${bridgeUrl}/lobe/manifest.json`,
      "The manifest exposes Preview tools for dry-runs plus guarded generate tools that require yes=true.",
    ],
    "chatgpt-actions": [
      "Create a ChatGPT Custom GPT Action from the Remix.Camera bridge OpenAPI schema:",
      `  ${bridgeUrl}/chatgpt-actions/openapi.json`,
      "ChatGPT Actions must call a public HTTPS URL, so expose this local bridge with a tunnel such as ngrok or cloudflared before importing the schema.",
      "Set REMIX_ACTION_API_KEY on the bridge and configure the GPT Action Authentication as API Key with Auth Type: Bearer.",
      "Set REMIX_ACTION_BASE_URL=https://your-public-tunnel.example.com so the imported schema points at the public bridge URL.",
      "Preview actions never spend credits; generate actions require yes=true after the user explicitly asks for an image.",
    ],
    agnai: [
      "Install this userscript in Tampermonkey or a compatible userscript manager:",
      `  ${path.join(adapterRoot, "agnai", "remix-camera-agnai.user.js")}`,
      "The bridge was configured to allow https://agnai.chat by CORS.",
      "The panel copies or inserts returned Markdown into the active chat input.",
    ],
    telegram: [
      "Reusable Telegram tool module:",
      `  ${path.join(adapterRoot, "telegram", "remix-telegram-tool.mjs")}`,
      "Lily proof-of-concept bot:",
      `  TELEGRAM_BOT_TOKEN=... REMIX_CONFIG_FILE=${configPath} node ${path.join(adapterRoot, "telegram", "lily-bot.mjs")}`,
      "The adapter uploads local bridge images to Telegram as files, so 127.0.0.1 image URLs work.",
    ],
    discord: [
      "Register Lily/Remix.Camera Discord slash commands:",
      `  DISCORD_BOT_TOKEN=... DISCORD_APPLICATION_ID=... node ${path.join(adapterRoot, "discord", "register-commands.mjs")}`,
      "Run the Lily Discord interactions server:",
      `  DISCORD_PUBLIC_KEY=... DISCORD_APPLICATION_ID=... REMIX_CONFIG_FILE=${configPath} node ${path.join(adapterRoot, "discord", "lily-interactions-server.mjs")}`,
      "Point the Discord application interactions endpoint at your hosted server URL.",
    ],
    whatsapp: [
      "Reusable WhatsApp Cloud API tool module:",
      `  ${path.join(adapterRoot, "whatsapp", "remix-whatsapp-tool.mjs")}`,
      "Lily proof-of-concept WhatsApp webhook:",
      `  WHATSAPP_ACCESS_TOKEN=... WHATSAPP_PHONE_NUMBER_ID=... WHATSAPP_VERIFY_TOKEN=... REMIX_CONFIG_FILE=${configPath} node ${path.join(adapterRoot, "whatsapp", "lily-webhook-server.mjs")}`,
      "Expose the webhook over HTTPS and set that URL in the Meta app webhook settings.",
      "The adapter uploads local bridge images to WhatsApp media before sending.",
    ],
    wechat: [
      "Reusable WeChat Official Account tool module:",
      `  ${path.join(adapterRoot, "wechat", "remix-wechat-tool.mjs")}`,
      "Lily proof-of-concept WeChat webhook:",
      `  WECHAT_ACCESS_TOKEN=... WECHAT_WEBHOOK_TOKEN=... REMIX_CONFIG_FILE=${configPath} node ${path.join(adapterRoot, "wechat", "lily-webhook-server.mjs")}`,
      "Expose the webhook over HTTPS and set that URL in the WeChat Official Account platform.",
      "The adapter verifies signed callbacks, uploads generated images as temporary media, then sends image customer-service messages.",
    ],
    viber: [
      "Reusable Viber Bot API tool module:",
      `  ${path.join(adapterRoot, "viber", "remix-viber-tool.mjs")}`,
      "Lily proof-of-concept Viber webhook:",
      `  VIBER_AUTH_TOKEN=... REMIX_CONFIG_FILE=${configPath} node ${path.join(adapterRoot, "viber", "lily-webhook-server.mjs")}`,
      "Expose the webhook over HTTPS and set that URL with Viber's set_webhook endpoint.",
      "Viber picture messages require public HTTPS image URLs ending in .jpg, .jpeg, .png, or .gif; the adapter refuses to post local bridge URLs as broken images.",
    ],
    slack: [
      "Reusable Slack slash-command tool module:",
      `  ${path.join(adapterRoot, "slack", "remix-slack-tool.mjs")}`,
      "Lily proof-of-concept Slack slash-command server:",
      `  SLACK_SIGNING_SECRET=... SLACK_BOT_TOKEN=... REMIX_CONFIG_FILE=${configPath} node ${path.join(adapterRoot, "slack", "lily-slash-command-server.mjs")}`,
      "Expose the server over HTTPS and set the Slack slash-command Request URL to your hosted endpoint.",
      "The adapter uploads local bridge images to Slack files before sending, so 127.0.0.1 image URLs are not posted as broken Slack image blocks.",
    ],
    line: [
      "Reusable LINE Messaging API tool module:",
      `  ${path.join(adapterRoot, "line", "remix-line-tool.mjs")}`,
      "Lily proof-of-concept LINE webhook:",
      `  LINE_CHANNEL_ACCESS_TOKEN=... LINE_CHANNEL_SECRET=... REMIX_CONFIG_FILE=${configPath} node ${path.join(adapterRoot, "line", "lily-webhook-server.mjs")}`,
      "Expose the webhook over HTTPS and set that URL in the LINE Developers Console.",
      "LINE image messages require public HTTPS URLs; the adapter uses productionImageUrl instead of posting 127.0.0.1 bridge URLs.",
    ],
    zalo: [
      "Reusable Zalo Official Account tool module:",
      `  ${path.join(adapterRoot, "zalo", "remix-zalo-tool.mjs")}`,
      "Lily proof-of-concept Zalo OA webhook:",
      `  ZALO_ACCESS_TOKEN=... ZALO_APP_SECRET=... REMIX_CONFIG_FILE=${configPath} node ${path.join(adapterRoot, "zalo", "lily-webhook-server.mjs")}`,
      "Expose the webhook over HTTPS and set that URL in the Zalo OA developer console.",
      "Zalo OA image messages require public HTTPS image URLs; the adapter uses productionImageUrl instead of posting 127.0.0.1 bridge URLs.",
    ],
    kakao: [
      "Reusable Kakao i/Open Builder Skill handler:",
      `  ${path.join(adapterRoot, "kakao", "remix-kakao-skill.mjs")}`,
      "Lily proof-of-concept Kakao Skill server:",
      `  REMIX_CONFIG_FILE=${configPath} node ${path.join(adapterRoot, "kakao", "lily-skill-server.mjs")}`,
      "Expose the server over HTTPS and set the Kakao Skill URL to your hosted /kakao/skill endpoint.",
      "Kakao simpleImage outputs require public image URLs; the adapter uses productionImageUrl instead of posting 127.0.0.1 bridge URLs.",
    ],
    messenger: [
      "Reusable Messenger Platform tool module:",
      `  ${path.join(adapterRoot, "messenger", "remix-messenger-tool.mjs")}`,
      "Lily proof-of-concept Messenger webhook:",
      `  MESSENGER_PAGE_ACCESS_TOKEN=... MESSENGER_APP_SECRET=... MESSENGER_VERIFY_TOKEN=... REMIX_CONFIG_FILE=${configPath} node ${path.join(adapterRoot, "messenger", "lily-webhook-server.mjs")}`,
      "Expose the webhook over HTTPS and set that URL in the Meta Messenger webhook settings.",
      "Messenger image attachments require public HTTPS URLs; the adapter uses productionImageUrl instead of posting 127.0.0.1 bridge URLs.",
    ],
    instagram: [
      "Reusable Instagram Messaging API tool module:",
      `  ${path.join(adapterRoot, "instagram", "remix-instagram-tool.mjs")}`,
      "Import createRemixInstagramTool into your existing Instagram webhook server.",
      `  INSTAGRAM_ACCESS_TOKEN=... INSTAGRAM_IG_ID=... REMIX_CONFIG_FILE=${configPath} node your-instagram-bot.mjs`,
      "Expose the webhook over HTTPS and verify x-hub-signature-256 before processing messages.",
      "Instagram image attachments require public HTTPS URLs; the adapter uses productionImageUrl instead of posting 127.0.0.1 bridge URLs.",
    ],
    teams: [
      "Reusable Microsoft Teams tool module:",
      `  ${path.join(adapterRoot, "teams", "remix-teams-tool.mjs")}`,
      "Use createRemixTeamsMessageHandler(...) inside an existing Teams bot message handler.",
      "Teams image activities use public HTTPS contentUrl attachments from productionImageUrl.",
      "Teams bots cannot force-delete delivered private media; retention copy stays conservative.",
    ],
    twilio: [
      "Reusable Twilio SMS/MMS tool module:",
      `  ${path.join(adapterRoot, "twilio", "remix-twilio-mms-tool.mjs")}`,
      "Import createRemixTwilioMmsTool into your existing Twilio inbound webhook server.",
      `  TWILIO_ACCOUNT_SID=... TWILIO_AUTH_TOKEN=... TWILIO_FROM=... TWILIO_MESSAGING_SERVICE_SID=... REMIX_CONFIG_FILE=${configPath} node your-twilio-webhook.mjs`,
      "Twilio MMS requires public HTTPS MediaUrl values; the adapter uses productionImageUrl instead of posting 127.0.0.1 bridge URLs.",
    ],
    matrix: [
      "Reusable Matrix bot tool module:",
      `  ${path.join(adapterRoot, "matrix", "remix-matrix-tool.mjs")}`,
      "Lily proof-of-concept Matrix sync bot:",
      `  MATRIX_HOMESERVER_URL=... MATRIX_ACCESS_TOKEN=... REMIX_CONFIG_FILE=${configPath} node ${path.join(adapterRoot, "matrix", "lily-sync-bot.mjs")}`,
      "Invite the Matrix bot account to a room, optionally set MATRIX_ROOM_ID, then send !lily commands.",
      "Matrix image events use mxc:// media, so the adapter uploads returned image bytes to the homeserver before sending m.image events.",
    ],
    dify: [
      "Add a Dify custom OpenAPI tool from this schema URL:",
      `  ${bridgeUrl}/openapi.json`,
      "Add the imported Remix.Camera tool to an Agent or Workflow Tool node.",
      "Use dry-run endpoints for previews and generate endpoints only after explicit confirmation.",
    ],
    flowise: [
      "Create a Flowise Custom Tool using this helper:",
      `  ${path.join(adapterRoot, "flowise", "remix-camera-flowise-tool.js")}`,
      "Point REMIX_BRIDGE_URL at:",
      `  ${bridgeUrl}`,
      "Use preview=true for dry-runs and yes=true only after explicit generation confirmation.",
    ],
    botpress: [
      "Create a Botpress Execute Code card or Action using this helper:",
      `  ${path.join(adapterRoot, "botpress", "remix-camera-botpress-action.js")}`,
      "Point REMIX_BRIDGE_URL at:",
      `  ${bridgeUrl}`,
      "Use dry-run previews first and set yes=true only after explicit generation confirmation.",
    ],
    anythingllm: [
      "Install this AnythingLLM custom agent skill folder:",
      `  ${path.join(adapterRoot, "anythingllm", "remix-camera-companion-images")}`,
      "Copy it into AnythingLLM's plugins/agent-skills directory without renaming the folder.",
      "Configure REMIX_BRIDGE_URL in AnythingLLM if your bridge URL differs from:",
      `  ${bridgeUrl}`,
      "The skill returns dry-run previews unless yes=true or confirm=true is provided.",
    ],
    typingmind: [
      "Create a TypingMind plugin with this OpenAI function spec:",
      `  ${path.join(adapterRoot, "typingmind", "function-spec.json")}`,
      "Paste this JavaScript implementation:",
      `  ${path.join(adapterRoot, "typingmind", "remix-camera-plugin.js")}`,
      "Add a bridgeUrl user setting with this value:",
      `  ${bridgeUrl}`,
      "The plugin returns dry-run previews unless yes=true or confirm=true is provided.",
    ],
    poe: [
      "Use this Poe server bot wrapper:",
      `  ${path.join(adapterRoot, "poe", "remix_camera_poe_bot.py")}`,
      "Deploy it to a public HTTPS server URL, then create a Poe Server Bot pointed at that URL.",
      "Set REMIX_BRIDGE_URL for the Poe bot process if the bridge differs from:",
      `  ${bridgeUrl}`,
      "The bot previews first and generates only when the user says yes=true.",
    ],
    langflow: [
      "Create a Langflow custom component from this file:",
      `  ${path.join(adapterRoot, "langflow", "remix_camera_component.py")}`,
      "Set Bridge URL to:",
      `  ${bridgeUrl}`,
      "Connect the component output to an Agent's tools. Keep preview=true until explicit confirmation.",
    ],
    langchain: [
      "Add these Remix.Camera tools to an existing LangChain JS agent:",
      `  ${path.join(adapterRoot, "langchain", "remix-camera-langchain-tools.mjs")}`,
      "Example imports:",
      "  import { createAgent, tool } from \"langchain\";",
      "  import * as z from \"zod\";",
      "The adapter exposes preview tools plus guarded generate tools that require yes=true.",
    ],
    "vercel-ai-sdk": [
      "Add this Remix.Camera tool map to an existing Vercel AI SDK bot:",
      `  ${path.join(adapterRoot, "vercel-ai-sdk", "remix-camera-ai-sdk-tools.mjs")}`,
      "Example imports:",
      "  import { streamText, tool } from \"ai\";",
      "  import * as z from \"zod\";",
      "The adapter exposes preview tools plus guarded generate tools that require yes=true.",
    ],
    n8n: [
      "Import this n8n workflow or paste the Code node helper into an existing chatbot workflow:",
      `  ${path.join(adapterRoot, "n8n", "remix-camera-n8n-workflow.json")}`,
      `  ${path.join(adapterRoot, "n8n", "remix-camera-n8n-tool.mjs")}`,
      "Set REMIX_BRIDGE_URL for the n8n process if the bridge URL differs from:",
      `  ${bridgeUrl}`,
      "The workflow previews by default and requires action=generate plus yes=true before spending credits.",
    ],
    pipedream: [
      "Use this Pipedream Node.js action component inside an existing workflow:",
      `  ${path.join(adapterRoot, "pipedream", "remix-camera-pipedream-action.mjs")}`,
      "Set Bridge URL to:",
      `  ${bridgeUrl}`,
      "The action defaults to dry-run and requires action=generate plus yes=true before spending credits.",
    ],
    make: [
      "Create a Make Custom Apps action module from this JSON spec:",
      `  ${path.join(adapterRoot, "make", "remix-camera-make-action-module.json")}`,
      "Optional Node helper for local tests or self-hosted Make-like runners:",
      `  ${path.join(adapterRoot, "make", "remix-camera-make-tool.mjs")}`,
      "Set Bridge URL to a URL Make can reach:",
      `  ${bridgeUrl}`,
      "Make cloud scenarios need a public HTTPS bridge URL or secure tunnel; they cannot call your laptop's 127.0.0.1 directly.",
      "The action defaults to dry-run and requires action=generate plus yes=true before spending credits.",
    ],
    zapier: [
      "Use this Zapier Platform CLI app definition:",
      `  ${path.join(adapterRoot, "zapier", "remix-camera-zapier-app", "index.cjs")}`,
      "Configure the create action named Preview or Generate Companion Image.",
      "Set Bridge URL to a URL Zapier can reach:",
      `  ${bridgeUrl}`,
      "Zapier cloud Zaps need a public HTTPS bridge URL or secure tunnel; they cannot call your laptop's 127.0.0.1 directly.",
      "The action defaults to dry-run and requires action=generate plus yes=true before spending credits.",
    ],
    voiceflow: [
      "Create a Voiceflow API tool from this JSON request contract:",
      `  ${path.join(adapterRoot, "voiceflow", "remix-camera-voiceflow-api-tool.json")}`,
      "Optional Node helper for local tests or self-hosted runners:",
      `  ${path.join(adapterRoot, "voiceflow", "remix-camera-voiceflow-tool.mjs")}`,
      "Set bridgeUrl to a URL Voiceflow can reach:",
      `  ${bridgeUrl}`,
      "Voiceflow Cloud needs a public HTTPS bridge URL or secure tunnel; it cannot call your laptop's 127.0.0.1 directly.",
      "Use action=dry-run first and require action=generate plus yes=true before spending credits.",
    ],
    manychat: [
      "Create a Manychat Action block -> External Request from this request contract:",
      `  ${path.join(adapterRoot, "manychat", "remix-camera-manychat-external-request.json")}`,
      "Optional Node helper for local tests or self-hosted runners:",
      `  ${path.join(adapterRoot, "manychat", "remix-camera-manychat-tool.mjs")}`,
      "Set the request URL to a public HTTPS bridge URL. Manychat External Request does not allow plain HTTP URLs.",
      "Use action=dry-run first and require action=generate plus yes=true before spending credits.",
      "Map $.results[0].productionImageUrl into a Manychat custom field before sending an image message.",
    ],
    nomi: [
      "Import this Nomi sidecar helper into an external bot that already uses the official Nomi API:",
      `  ${path.join(adapterRoot, "nomi", "remix-camera-nomi-tool.mjs")}`,
      "Set NOMI_API_KEY and NOMI_UUID, or NOMI_ROOM_UUID plus NOMI_REQUEST_NOMI_UUID for room mode.",
      "Use callNomi=true when the wrapper should call Nomi for companion text before adding Remix.Camera image payloads.",
      "Nomi's public API chat endpoints are text/JSON surfaces; your wrapping bot sends the returned image payloads.",
      "Use action=dry-run first and require action=generate plus yes=true before spending credits.",
    ],
    kindroid: [
      "Import this Kindroid sidecar helper into an external bot that already uses the official Kindroid API:",
      `  ${path.join(adapterRoot, "kindroid", "remix-camera-kindroid-tool.mjs")}`,
      "Set KINDROID_API_KEY and KINDROID_AI_ID for single AI mode, KINDROID_GROUP_ID for group mode, or KINDROID_SHARE_CODE for the Discord bot endpoint.",
      "Use callKindroid=true when the wrapper should call Kindroid for companion text before adding Remix.Camera image payloads.",
      "Kindroid's public API returns text; your wrapping bot sends the returned image payloads.",
      "Use action=dry-run first and require action=generate plus yes=true before spending credits.",
    ],
    "bot-framework": [
      "Import this generic Bot Framework activity handler into an existing Azure Bot Service/Bot Builder bot:",
      `  ${path.join(adapterRoot, "bot-framework", "remix-camera-bot-framework-handler.mjs")}`,
      "Use createRemixBotFrameworkTurnHandler(...) inside your bot's turn handler.",
      "Direct commands default to preview; confirmed generation requires generate plus yes.",
      "Generated image replies use Bot Framework Hero Card attachments.",
    ],
    "dialogflow-es": [
      "Deploy an HTTPS webhook service that imports this Dialogflow ES handler:",
      `  ${path.join(adapterRoot, "dialogflow-es", "remix-camera-dialogflow-es-webhook.mjs")}`,
      "Set the Dialogflow ES Fulfillment webhook URL to that deployed service.",
      "Pass command, action, prompt, characterName, and consent/reference parameters through queryResult.parameters.",
      "Use action=dry-run first and require action=generate plus yes=true before spending credits.",
      "The webhook returns fulfillmentMessages, a remixCamera custom payload, and remix_camera output context metadata.",
    ],
    "dialogflow-cx": [
      "Deploy an HTTPS webhook service that imports this handler:",
      `  ${path.join(adapterRoot, "dialogflow-cx", "remix-camera-dialogflow-cx-webhook.mjs")}`,
      "Set the Dialogflow CX webhook URL to that deployed service.",
      "Pass command, action, prompt, characterName, and consent/reference parameters through sessionInfo.parameters.",
      "Use action=dry-run first and require action=generate plus yes=true before spending credits.",
      "The webhook returns fulfillment_response text plus remix_* session_info parameters.",
    ],
    rasa: [
      "Copy this Rasa custom action into your Rasa project's actions/ folder:",
      `  ${path.join(adapterRoot, "rasa", "remix_camera_rasa_actions.py")}`,
      "Add action_remix_camera_companion_image to domain.yml and route image intents or flows to it.",
      "Set REMIX_BRIDGE_URL for the Rasa action server if the bridge differs from:",
      `  ${bridgeUrl}`,
      "Use remix_action=dry-run first and require remix_action=generate plus remix_yes=true before spending credits.",
    ],
    "amazon-lex": [
      "Bundle this Lambda handler into the Lambda function for your Amazon Lex V2 bot alias:",
      `  ${path.join(adapterRoot, "amazon-lex", "remix-camera-lex-v2-lambda.mjs")}`,
      "Configure a Lex V2 DialogCodeHook or FulfillmentCodeHook for the image intent.",
      "Set REMIX_BRIDGE_URL for the Lambda function if the bridge differs from:",
      `  ${bridgeUrl}`,
      "Use remix_action=dry-run first and require remix_action=generate plus remix_yes=true before spending credits.",
    ],
    "watsonx-assistant": [
      "Import this OpenAPI JSON as a watsonx Assistant custom extension:",
      `  ${path.join(adapterRoot, "watsonx-assistant", "remix-camera-watsonx-extension.openapi.json")}`,
      "First replace the server URL in that file with a public HTTPS bridge URL.",
      "Optional Node helper for local tests or self-hosted runners:",
      `  ${path.join(adapterRoot, "watsonx-assistant", "remix-camera-watsonx-tool.mjs")}`,
      "Use action=dry-run first and require action=generate plus yes=true before spending credits.",
    ],
  };
  console.log("");
  console.log(`Remix.Camera ${target} setup complete.`);
  console.log(`  Bridge config: ${configPath}`);
  if (healthUrl) {
    console.log(`  Health check: ${healthUrl}`);
  }
  console.log("");
  for (const line of instructions[target] || []) {
    console.log(line);
  }
}

async function main() {
  if (hasFlag("--help") || hasFlag("-h")) {
    printHelp();
    return;
  }

  const target = selectedTarget();
  const apiBaseUrl = trimTrailingSlash(argValue("--api-base-url") || process.env.REMIX_API_BASE_URL || DEFAULT_API_BASE_URL);
  const port = argValue("--port") || process.env.REMIX_BRIDGE_PORT || "8787";
  const allowedOrigins = allowedOriginsForTarget(target);

  if (target !== "sillytavern") {
    console.log(`Target: ${target}`);
    console.log(`Remix.Camera: ${apiBaseUrl}`);
    const pairing = await pairDevice(apiBaseUrl, target);
    const sessionToken = pairing.sessionToken;
    const profile = await selectProfile(apiBaseUrl, sessionToken, pairing.profileId);
    const characterName = argValue("--character-name") || pairing.characterName || profile.name || "Remix Companion";
    const configPath = await writeBridgeConfig({
      apiBaseUrl,
      sessionToken,
      profileId: profile.id,
      characterName,
      target,
      allowedOrigins,
      pairedAt: new Date().toISOString(),
      session: pairing.session || null,
    });
    const healthUrl = await startBridge(configPath, {
      REMIX_ALLOWED_ORIGINS: allowedOrigins.join(","),
    });
    printTargetInstructions(target, { healthUrl, port, configPath });
    return;
  }

  const sillyTavernDir = await findSillyTavernDir();
  const userName = argValue("--user") || "default-user";
  const characterDir = path.join(sillyTavernDir, "data", userName, "characters");

  console.log(`SillyTavern: ${sillyTavernDir}`);
  console.log(`Remix.Camera: ${apiBaseUrl}`);

  const pairing = await pairDevice(apiBaseUrl, target);
  const sessionToken = pairing.sessionToken;
  const profile = await selectProfile(apiBaseUrl, sessionToken, pairing.profileId);
  const characterName = argValue("--character-name") || pairing.characterName || profile.name || "Remix Companion";
  const configPath = await writeBridgeConfig({
    apiBaseUrl,
    sessionToken,
    profileId: profile.id,
    characterName,
    target,
    allowedOrigins,
    pairedAt: new Date().toISOString(),
    session: pairing.session || null,
  });
  const extensionTarget = await installExtension(sillyTavernDir, userName);
  const cardPath = await downloadCharacterCard(apiBaseUrl, sessionToken, profile, characterName, characterDir);
  const healthUrl = await startBridge(configPath, {
    REMIX_ALLOWED_ORIGINS: allowedOrigins.join(","),
  });

  console.log("");
  console.log("Remix.Camera SillyTavern setup complete.");
  console.log(`  Extension: ${extensionTarget}`);
  console.log(`  Character: ${cardPath}`);
  console.log(`  Bridge config: ${configPath}`);
  if (healthUrl) {
    console.log(`  Health check: ${healthUrl}`);
  }
}

main().catch((error) => {
  console.error("");
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
