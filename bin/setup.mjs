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
  "risu",
  "openwebui",
  "librechat",
  "lobechat",
  "agnai",
  "telegram",
  "discord",
  "whatsapp",
  "dify",
  "flowise",
  "botpress",
]);

function printHelp() {
  console.log(`Remix.Camera SillyTavern setup

Usage:
  Public GitHub package:
  npx --yes github:remixcamera/remix-camera-sillytavern-companion-images [options]

  Npm package after publish:
  npx @remix-camera/sillytavern-setup [options]

Options:
  --target=sillytavern|risu|openwebui|librechat|lobechat|agnai|telegram|discord|whatsapp|dify|flowise|botpress
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
      "The manifest points each companion image tool at the local bridge.",
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
