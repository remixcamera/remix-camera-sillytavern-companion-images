#!/usr/bin/env node

import { spawn } from "node:child_process";
import { once } from "node:events";
import fs from "node:fs/promises";
import fssync from "node:fs";
import http from "node:http";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");

const sillyTavernRoot = path.resolve(
  process.env.SILLYTAVERN_ROOT || path.join(packageRoot, "..", "SillyTavern"),
);
const outputDir = path.resolve(
  process.env.REMIX_SILLYTAVERN_E2E_OUTPUT_DIR || path.join(packageRoot, "tmp", "browser-e2e"),
);
const videoTempDir = path.join(outputDir, "video-tmp");
const videoOut = path.join(outputDir, "sillytavern-remix-real-output-demo.webm");
const posterOut = path.join(outputDir, "sillytavern-remix-real-output-demo-poster.png");
const resultOut = path.join(outputDir, "result.json");
const backupRoot = path.join(outputDir, `backup-${Date.now()}`);

const sillyTavernPort = Number(process.env.REMIX_E2E_SILLYTAVERN_PORT || 8000);
const bridgePort = Number(process.env.REMIX_E2E_BRIDGE_PORT || 8787);
const mockApiPort = Number(process.env.REMIX_E2E_MOCK_API_PORT || 8799);

const sillyTavernOrigin = `http://127.0.0.1:${sillyTavernPort}`;
const bridgeOrigin = `http://127.0.0.1:${bridgePort}`;
const mockApiOrigin = `http://127.0.0.1:${mockApiPort}`;
const args = new Set(process.argv.slice(2));
const realApiMode = args.has("--real-api") || process.env.REMIX_SILLYTAVERN_E2E_REAL_API === "true";
const spendConfirmed = args.has("--yes") || process.env.REMIX_SILLYTAVERN_E2E_YES === "true";
const maxLiveGenerations = Number(argValue("--max-generations") || process.env.REMIX_SILLYTAVERN_E2E_MAX_GENERATIONS || 1);
const liveApiBaseUrl = (process.env.REMIX_API_BASE_URL || process.env.REMIX_BASE_URL || "https://remix.camera").replace(/\/+$/, "");
const liveOutfitSourceImageUrl =
  process.env.REMIX_SILLYTAVERN_E2E_OUTFIT_SOURCE_IMAGE_URL ||
  "https://remix.camera/examples/ai-companion-image-toolset/outfit-try-on-input.jpg";
const defaultBridgeConfigPath = path.join(os.homedir(), ".remix-camera", "sillytavern-bridge.json");

const sourceExtensionDir = path.join(packageRoot, "extension", "remix-camera-companion-images");
const sourceCharacter = await loadSourceCharacter();
const sourceCharacterCard = sourceCharacter.pngPath;
const sourceCharacterJson = sourceCharacter.jsonPath;
const characterCard = sourceCharacter.card;
const characterName = sourceCharacter.name;
const characterProfileId = sourceCharacter.profileId;
const characterVisualIdentity = sourceCharacter.visualIdentity;
const characterPromptAnchors = sourceCharacter.promptAnchors;
const characterFileBaseName = safeCharacterFileBaseName(characterName);
const realImageSources = {
  selfie: path.join(packageRoot, "examples", "mila-real-outputs", "send-selfie-output.jpg"),
  auto: path.join(packageRoot, "examples", "mila-real-outputs", "auto-selfie-from-chat-output.jpg"),
  outfit: path.join(packageRoot, "examples", "mila-real-outputs", "outfit-try-on-output.jpg"),
  couple: path.join(packageRoot, "examples", "mila-real-outputs", "couple-photo-output.jpg"),
  vacation: path.join(packageRoot, "examples", "mila-real-outputs", "couple-photo-output.jpg"),
  date: path.join(packageRoot, "examples", "mila-real-outputs", "auto-selfie-from-chat-output.jpg"),
  daily: path.join(packageRoot, "examples", "mila-real-outputs", "send-selfie-output.jpg"),
  snap: path.join(packageRoot, "examples", "mila-real-outputs", "send-selfie-output.jpg"),
};
const coupleUserReferenceImage = path.join(packageRoot, "examples", "user-references", "couple-photo-user-reference.jpg");
const imageKinds = Object.keys(realImageSources);
const requestedKinds = resolveRequestedKinds();
const plannedGenerationCount = requestedKinds.reduce((total, kind) => total + generationCountForKind(kind), 0);
const runMode = realApiMode ? "browser-e2e-live-remix-api" : "browser-e2e-archived-real-outputs";
const imageSelector = "#chat .mes_text img[src]";
const imageWaitTimeoutMs = realApiMode
  ? Number(process.env.REMIX_SILLYTAVERN_E2E_LIVE_TIMEOUT_MS || 240000)
  : 30000;

const userRoot = path.join(sillyTavernRoot, "data", "default-user");
const settingsPath = path.join(userRoot, "settings.json");
const extensionDir = path.join(userRoot, "extensions", "remix-camera-companion-images");
const characterPng = path.join(userRoot, "characters", `${characterFileBaseName}.png`);
const characterDir = path.join(userRoot, "characters", characterFileBaseName);
const chatDir = path.join(userRoot, "chats", characterFileBaseName);
const defaultChatDir = path.join(userRoot, "chats", `default_${characterFileBaseName}`);
const avatarThumb = path.join(userRoot, "thumbnails", "avatar", `${characterFileBaseName}.png`);
const userImagesDir = path.join(userRoot, "user", "images");

const processes = [];
const backups = [];
const apiRequests = [];
const generatedImages = [];
const consoleIssues = [];
let backupsRestored = false;

async function main() {
  await loadChromium();
  await assertRequiredFiles();
  await assertGenerationPlan();
  await assertRequiredPortsFree();

  await fs.mkdir(outputDir, { recursive: true });
  await fs.rm(videoTempDir, { recursive: true, force: true });
  await fs.mkdir(videoTempDir, { recursive: true });
  await fs.rm(videoOut, { force: true });
  await fs.rm(posterOut, { force: true });
  await fs.rm(resultOut, { force: true });
  await fs.rm(backupRoot, { recursive: true, force: true });
  await fs.mkdir(backupRoot, { recursive: true });

  const mockApi = realApiMode ? null : await startMockRemixApi();
  try {
    await prepareSillyTavernState();
    await startBridge();
    await startSillyTavern();
    await recordDemo();
    assertDemoRequests();
    await writeResult();
  } finally {
    await stopAllProcesses();
    if (mockApi) {
      await new Promise((resolve) => mockApi.close(resolve));
    }
    await restoreBackups();
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: runMode,
        plannedCommandCount: requestedKinds.length,
        plannedGenerationCount: realApiMode ? plannedGenerationCount : 0,
        videoPath: videoOut,
        posterPath: posterOut,
        resultPath: resultOut,
        commands: requestedKinds,
        consoleIssues: consoleIssues.length,
      },
      null,
      2,
    ),
  );
}

async function loadChromium() {
  if (process.env.PLAYWRIGHT_MODULE_PATH) {
    try {
      const playwright = await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE_PATH).href);
      return playwright.chromium || playwright.default?.chromium;
    } catch {
      // Fall through to normal package resolution for a clearer final error.
    }
  }
  try {
    const playwright = await import("playwright");
    return playwright.chromium || playwright.default?.chromium;
  } catch (error) {
    throw new Error(
      [
        "Playwright is required for browser E2E.",
        "Run through the package script, or install it temporarily with:",
        "PLAYWRIGHT_MODULE_PATH=/path/to/node_modules/playwright/index.js node scripts/verify-sillytavern-browser-e2e.mjs",
        `Original error: ${error instanceof Error ? error.message : String(error)}`,
      ].join(" "),
    );
  }
}

function argValue(name) {
  const prefix = `${name}=`;
  const item = process.argv.slice(2).find((value) => value.startsWith(prefix));
  return item ? item.slice(prefix.length) : "";
}

async function loadSourceCharacter() {
  const raw =
    argValue("--character-card") ||
    process.env.REMIX_SILLYTAVERN_E2E_CHARACTER_CARD ||
    "lily-remix-visual";
  const jsonPath = resolveCharacterJsonPath(raw);
  const pngPath = jsonPath.replace(/\.character\.json$/, ".character.png");
  const card = JSON.parse(await fs.readFile(jsonPath, "utf8"));
  const remix = card?.data?.extensions?.remix_camera || {};
  const name = cleanCardString(card?.data?.name || remix.characterName);
  const profileId = cleanCardString(process.env.REMIX_PROFILE_ID || remix.profileId);
  const visualIdentity = cleanCardString(remix.visualIdentity);
  const promptAnchors = resolvePromptAnchors(card);

  if (!name) {
    throw new Error(`${jsonPath} must define data.name.`);
  }
  if (!profileId || profileId === "profile_replace_me") {
    throw new Error(`${jsonPath} must define data.extensions.remix_camera.profileId for browser E2E.`);
  }
  if (!visualIdentity) {
    throw new Error(`${jsonPath} must define data.extensions.remix_camera.visualIdentity for browser E2E.`);
  }

  return {
    jsonPath,
    pngPath,
    card,
    name,
    profileId,
    visualIdentity,
    promptAnchors,
  };
}

function resolveCharacterJsonPath(raw) {
  const value = cleanCardString(raw);
  const charactersDir = path.join(packageRoot, "characters");
  const candidate = value.endsWith(".png")
    ? value.replace(/\.character\.png$/, ".character.json").replace(/\.png$/, ".character.json")
    : value.endsWith(".json")
      ? value
      : `${value}.character.json`;
  return path.isAbsolute(candidate) ? candidate : path.join(charactersDir, candidate);
}

function resolvePromptAnchors(card) {
  const remix = card?.data?.extensions?.remix_camera || {};
  const raw = process.env.REMIX_SILLYTAVERN_E2E_PROMPT_ANCHORS || remix.e2ePromptAnchors;
  if (Array.isArray(raw)) {
    return raw.map(cleanCardString).filter(Boolean);
  }
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map(cleanCardString)
      .filter(Boolean);
  }
  return [card?.data?.name, "photorealistic"].map(cleanCardString).filter(Boolean);
}

function cleanCardString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function safeCharacterFileBaseName(value) {
  const cleaned = cleanCardString(value).replace(/[\\/:*?"<>|]/g, "_").replace(/\s+/g, " ").trim();
  return cleaned || "Companion";
}

function resolveRequestedKinds() {
  if (!realApiMode) {
    return imageKinds;
  }

  const raw = argValue("--commands") || process.env.REMIX_SILLYTAVERN_E2E_COMMANDS || "send-selfie";
  if (raw === "all") {
    return imageKinds;
  }
  const aliases = new Map([
    ["send-selfie", "selfie"],
    ["selfie", "selfie"],
    ["auto-selfie-from-chat", "auto"],
    ["auto", "auto"],
    ["outfit-try-on", "outfit"],
    ["outfit", "outfit"],
    ["couple-photo", "couple"],
    ["couple", "couple"],
    ["couples-vacation", "vacation"],
    ["vacation", "vacation"],
    ["date-night", "date"],
    ["date", "date"],
    ["daily-life-snap", "daily"],
    ["daily", "daily"],
    ["private-snap", "snap"],
    ["snap", "snap"],
  ]);
  const requested = raw
    .split(",")
    .map((item) => aliases.get(item.trim()))
    .filter(Boolean);
  return [...new Set(requested.length ? requested : ["selfie"])];
}

function generationCountForKind(kind) {
  return kind === "vacation" ? 3 : 1;
}

async function assertGenerationPlan() {
  if (!realApiMode) {
    return;
  }
  if (!spendConfirmed) {
    throw new Error(
      "True-live browser E2E spends Remix.Camera credits. Pass --yes or set REMIX_SILLYTAVERN_E2E_YES=true after reviewing the planned command count.",
    );
  }
  if (!(await hasLiveBridgeAuth())) {
    throw new Error(
      [
        "True-live browser E2E requires Remix.Camera auth.",
        "Run npx @remix-camera/sillytavern-setup to create ~/.remix-camera/sillytavern-bridge.json,",
        "or set REMIX_SESSION_TOKEN or REMIX_API_KEY explicitly.",
      ].join(" "),
    );
  }
  if (!Number.isFinite(maxLiveGenerations) || maxLiveGenerations < 1) {
    throw new Error("REMIX_SILLYTAVERN_E2E_MAX_GENERATIONS or --max-generations must be a positive integer.");
  }
  if (plannedGenerationCount > maxLiveGenerations) {
    throw new Error(
      `True-live browser E2E would run ${plannedGenerationCount} generations, which exceeds max ${maxLiveGenerations}. Raise --max-generations only after reviewing the requested command list.`,
    );
  }
}

async function hasLiveBridgeAuth() {
  if (process.env.REMIX_SESSION_TOKEN || process.env.REMIX_API_KEY) {
    return true;
  }
  try {
    const config = JSON.parse(await fs.readFile(defaultBridgeConfigPath, "utf8"));
    return Boolean(config?.sessionToken || config?.apiKey);
  } catch {
    return false;
  }
}

async function assertRequiredFiles() {
  const required = [
    sillyTavernRoot,
    settingsPath,
    sourceExtensionDir,
    sourceCharacterCard,
    ...(realApiMode ? [] : Object.values(realImageSources)),
  ];
  for (const item of required) {
    if (!fssync.existsSync(item)) {
      throw new Error(`Required browser E2E file or directory is missing: ${item}`);
    }
  }
}

async function assertRequiredPortsFree() {
  await assertTcpPortFree(sillyTavernPort, "SillyTavern");
  await assertTcpPortFree(bridgePort, "Remix.Camera bridge");
  if (!realApiMode) {
    await assertTcpPortFree(mockApiPort, "mock Remix.Camera API");
  }
}

async function assertTcpPortFree(port, label) {
  const server = net.createServer();
  return new Promise((resolve, reject) => {
    const finish = (error) => {
      server.off("error", finish);
      server.off("listening", finish);
      if (error instanceof Error) {
        reject(new Error(`${label} port ${port} is already in use. Stop the existing process before running browser E2E. Advanced users can configure the matching local service on another port and set the corresponding REMIX_E2E_*_PORT value.`));
        return;
      }
      server.close((closeError) => {
        if (closeError) {
          reject(closeError);
        } else {
          resolve();
        }
      });
    };
    server.once("error", finish);
    server.once("listening", finish);
    server.listen(port, "127.0.0.1");
  });
}

async function prepareSillyTavernState() {
  await backupAndRemove(extensionDir);
  await backupAndRemove(characterPng);
  await backupAndRemove(characterDir);
  await backupAndRemove(chatDir);
  await backupAndRemove(defaultChatDir);
  await backupAndRemove(avatarThumb);
  for (const kind of imageKinds) {
    await backupAndRemove(path.join(userImagesDir, `remix-demo-${kind}.svg`));
    await backupAndRemove(path.join(userImagesDir, `remix-real-${kind}.jpg`));
  }
  await backupAndRemove(settingsPath);

  const settingsBackup = backups.find((entry) => entry.original === settingsPath)?.backup;
  if (!settingsBackup) {
    throw new Error(`Expected settings backup at ${settingsPath}`);
  }

  const settings = JSON.parse(await fs.readFile(settingsBackup, "utf8"));
  deleteRemixSettings(settings);
  settings.firstRun = false;
  settings.active_character = `${characterFileBaseName}.png`;
  if (settings.power_user && typeof settings.power_user === "object") {
    settings.power_user.forbid_external_media = false;
    settings.power_user.external_media_forbidden_overrides = [];
  }
  if (settings.extension_settings && typeof settings.extension_settings === "object") {
    const disabled = Array.isArray(settings.extension_settings.disabledExtensions)
      ? settings.extension_settings.disabledExtensions
      : [];
    settings.extension_settings.disabledExtensions = disabled.filter((name) => {
      return name !== "third-party/remix-camera-companion-images" && name !== "remix-camera-companion-images";
    });
  }
  await fs.writeFile(settingsPath, `${JSON.stringify(settings, null, 4)}\n`);

  await copyDir(sourceExtensionDir, extensionDir);
  await fs.mkdir(path.dirname(characterPng), { recursive: true });
  await fs.copyFile(sourceCharacterCard, characterPng);
  if (!realApiMode) {
    await fs.mkdir(userImagesDir, { recursive: true });
    for (const kind of imageKinds) {
      await fs.copyFile(realImageSources[kind], path.join(userImagesDir, `remix-real-${kind}.jpg`));
    }
  }
}

async function backupAndRemove(original) {
  if (!fssync.existsSync(original)) {
    backups.push({ original, backup: null });
    return;
  }
  const safe = original.replaceAll("/", "__").replaceAll(" ", "_");
  const backup = path.join(backupRoot, safe);
  await fs.mkdir(path.dirname(backup), { recursive: true });
  await fs.rename(original, backup);
  backups.push({ original, backup });
}

async function restoreBackups() {
  if (backupsRestored) {
    return;
  }
  backupsRestored = true;
  for (const entry of [...backups].reverse()) {
    await fs.rm(entry.original, { recursive: true, force: true });
    if (entry.backup && fssync.existsSync(entry.backup)) {
      await fs.mkdir(path.dirname(entry.original), { recursive: true });
      await fs.rename(entry.backup, entry.original);
    }
  }
  await fs.rm(backupRoot, { recursive: true, force: true });
}

function deleteRemixSettings(value) {
  if (!value || typeof value !== "object") {
    return;
  }
  if (Array.isArray(value)) {
    value.forEach(deleteRemixSettings);
    return;
  }
  delete value.remixCameraCompanionImages;
  Object.values(value).forEach(deleteRemixSettings);
}

async function copyDir(source, destination) {
  await fs.rm(destination, { recursive: true, force: true });
  await fs.mkdir(destination, { recursive: true });
  for (const item of await fs.readdir(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, item.name);
    const destinationPath = path.join(destination, item.name);
    if (item.isDirectory()) {
      await copyDir(sourcePath, destinationPath);
    } else if (item.isFile()) {
      await fs.copyFile(sourcePath, destinationPath);
    }
  }
}

async function startBridge() {
  const bridgeEnv = {
    ...process.env,
    REMIX_API_BASE_URL: realApiMode ? liveApiBaseUrl : mockApiOrigin,
    REMIX_PROFILE_ID: characterProfileId,
    REMIX_BRIDGE_HOST: "127.0.0.1",
    REMIX_BRIDGE_PORT: String(bridgePort),
    REMIX_ALLOWED_ORIGINS: sillyTavernOrigin,
    REMIX_POLL_INTERVAL_MS: realApiMode ? process.env.REMIX_POLL_INTERVAL_MS || "2000" : "50",
    REMIX_POLL_TIMEOUT_MS: realApiMode ? process.env.REMIX_POLL_TIMEOUT_MS || "180000" : "5000",
  };
  if (!realApiMode) {
    bridgeEnv.REMIX_API_KEY = "rc_live_browser_e2e_mock";
  }
  const proc = spawn(process.execPath, [path.join(packageRoot, "bridge", "server.mjs")], {
    cwd: packageRoot,
    env: bridgeEnv,
    stdio: ["ignore", "pipe", "pipe"],
  });
  processes.push({ name: "bridge", proc, logs: collectLogs("bridge", proc) });
  await waitForHttp(`${bridgeOrigin}/health`, 15000);
}

async function startSillyTavern() {
  const npmExec = process.env.npm_execpath;
  const command = npmExec ? process.execPath : "npm";
  const args = npmExec ? [npmExec, "run", "start:no-csrf"] : ["run", "start:no-csrf"];
  const proc = spawn(command, args, {
    cwd: sillyTavernRoot,
    env: { ...process.env },
    stdio: ["ignore", "pipe", "pipe"],
  });
  processes.push({ name: "sillytavern", proc, logs: collectLogs("sillytavern", proc) });
  await waitForHttp(`${sillyTavernOrigin}/`, 30000);
}

function collectLogs(name, proc) {
  const logs = [];
  const collect = (chunk) => {
    const text = chunk.toString("utf8");
    logs.push(text);
    if (logs.join("").length > 16000) {
      logs.splice(0, Math.max(1, logs.length - 20));
    }
    for (const line of text.split(/\r?\n/).filter(Boolean)) {
      if (/error|failed|listening|server started|sillytavern/i.test(line)) {
        console.log(`[${name}] ${line}`);
      }
    }
  };
  proc.stdout.on("data", collect);
  proc.stderr.on("data", collect);
  proc.on("exit", (code, signal) => {
    if (code !== 0 && signal !== "SIGTERM" && signal !== "SIGKILL") {
      console.log(`[${name}] exited with code=${code} signal=${signal}`);
    }
  });
  return logs;
}

async function stopAllProcesses() {
  for (const { proc } of [...processes].reverse()) {
    if (proc.exitCode !== null || proc.signalCode) {
      continue;
    }
    proc.kill("SIGTERM");
  }
  await sleep(1500);
  for (const { proc } of [...processes].reverse()) {
    if (proc.exitCode === null && !proc.signalCode) {
      proc.kill("SIGKILL");
    }
  }
}

async function waitForHttp(url, timeoutMs) {
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status < 500) {
        return;
      }
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(250);
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError?.message || "no response"}`);
}

async function recordDemo() {
  const chromium = await loadChromium();
  const browser = await launchChromium(chromium);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    recordVideo: { dir: videoTempDir, size: { width: 1280, height: 720 } },
  });
  const page = await context.newPage();
  page.on("console", (message) => {
    const text = message.text();
    if (
      ["error", "warning"].includes(message.type()) &&
      !/favicon|websocket|moment|deprecated|select2|Unsupported language: en-us|<select> tag was parsed/i.test(text)
    ) {
      consoleIssues.push(`${message.type()}: ${text}`);
    }
  });
  page.on("pageerror", (error) => consoleIssues.push(`pageerror: ${error.message}`));

  await page.goto(`${sillyTavernOrigin}/?recording=sillytavern-remix-demo`, {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForFunction(() => window.SillyTavern?.getContext?.()?.characters?.length > 0, null, {
    timeout: 30000,
  });
  await page.waitForFunction((name) => {
    return window.SillyTavern?.getContext?.()?.characters?.some((character) => character?.name === name);
  }, characterName);

  const charId = await page.evaluate((name) => {
    return window.SillyTavern.getContext().characters.findIndex((character) => character?.name === name);
  }, characterName);
  if (charId < 0) {
    throw new Error(`${characterName} character was not loaded.`);
  }
  await page.evaluate(async (id) => {
    const script = await import("/script.js");
    await script.selectCharacterById(String(id));
  }, charId);

  await page.waitForFunction((id) => {
    return String(window.SillyTavern?.getContext?.()?.characterId) === String(id);
  }, charId);
  await page.waitForSelector("#remix-camera-companion-images", { state: "attached", timeout: 15000 });
  await page.waitForFunction(({ expectedName, profileId, identityAnchor }) => {
    const profile = document.querySelector("#remix-camera-profile-id")?.value || "";
    const name = document.querySelector("#remix-camera-character-name")?.value || "";
    const identity = document.querySelector("#remix-camera-visual-identity")?.value || "";
    return name === expectedName && profile === profileId && identity.includes(identityAnchor);
  }, {
    expectedName: characterName,
    profileId: characterProfileId,
    identityAnchor: characterPromptAnchors[0] || characterName,
  });

  await polishUi(page);
  await resetChat(page);
  await setBadge(page, `Setup: ${characterName} card auto-hydrated the extension`);
  await sleep(1200);

  let expectedCount = 0;
  if (requestedKinds.includes("selfie")) {
    await addExchange(
      page,
      "Can you send a quick cafe selfie that shows the table, your drink, and where you're sitting?",
      "Yeah. I just got my latte, so I will keep the frame wide enough that it actually looks like this table.",
    );
    await setBadge(page, "Use case 1: direct in-character selfie");
    expectedCount += 1;
    await clickAndWaitForImage(page, "selfie", "#remix-camera-selfie", expectedCount);
    await sleep(1600);
  }

  if (requestedKinds.includes("auto")) {
    await addExchange(
      page,
      "Use what we were just talking about and show me the couch setup tonight. I want to see the lamp, the couch, and you in the room.",
      "Fine, but only because the lamp actually makes this corner look good. I will show the room, not just my face.",
    );
    await setBadge(page, "Use case 2: selfie from recent chat context");
    expectedCount += 1;
    await clickAndWaitForImage(page, "auto", "#remix-camera-auto-selfie", expectedCount);
    await sleep(1600);
  }

  if (requestedKinds.includes("outfit")) {
    await addExchange(
      page,
      `Try the white blazer outfit from this reference: ${liveOutfitSourceImageUrl}`,
      "That one works. I can make it feel like a polished coffee-date outfit.",
    );
    await setBadge(page, "Use case 3: outfit try-on from a reference URL");
    await page.fill(
      "#remix-camera-source-image-url",
      realApiMode ? liveOutfitSourceImageUrl : `${mockApiOrigin}/source/outfit.jpg`,
    );
    expectedCount += 1;
    await clickAndWaitForImage(page, "outfit", "#remix-camera-outfit-button", expectedCount);
    await sleep(1600);
  }

  if (requestedKinds.includes("couple")) {
    await addExchange(
      page,
      "I want one with both of us. Yes, include me: consenting adult man with light brown hair, short beard, fair skin, and a tan jacket.",
      "Only because you clearly asked. I will make sure we look like two distinct people in the booth.",
    );
    await setBadge(page, "Use case 4: couple photo with uploaded user reference");
    await page.setInputFiles("#remix-camera-couple-photo", coupleUserReferenceImage);
    await page.waitForFunction(() => {
      const status = document.querySelector("#remix-camera-couple-photo-status")?.textContent || "";
      return status.includes("Selected:") || status.includes("Ready:");
    });
    await page.check("#remix-camera-user-consent");
    await page.fill(
      "#remix-camera-user-description",
      "consenting adult man with light brown hair, short beard, fair skin, tan jacket",
    );
    expectedCount += 1;
    await clickAndWaitForImage(page, "couple", "#remix-camera-couple-button", expectedCount);
    await sleep(2200);
  }

  if (requestedKinds.includes("vacation")) {
    await addExchange(
      page,
      "Let's make it look like we took a weekend trip together. Yes, include me in a three-photo beach vacation set.",
      "I can do that as a little trip set: same destination, same us, three different moments.",
    );
    await setBadge(page, "Use case 5: three-photo couples vacation set");
    await page.setInputFiles("#remix-camera-couple-photo", coupleUserReferenceImage);
    await page.waitForFunction(() => {
      const status = document.querySelector("#remix-camera-couple-photo-status")?.textContent || "";
      return status.includes("Selected:") || status.includes("Ready:");
    });
    await page.check("#remix-camera-user-consent");
    await page.fill(
      "#remix-camera-user-description",
      "consenting adult man with light brown hair, short beard, fair skin, tan jacket",
    );
    await page.fill("#remix-camera-vacation-theme", "cohesive beach weekend getaway");
    const vacationGenerationCount = generationCountForKind("vacation");
    expectedCount += vacationGenerationCount;
    await clickAndWaitForImage(page, "vacation", "#remix-camera-vacation-button", expectedCount, vacationGenerationCount);
    await sleep(2200);
  }

  if (requestedKinds.includes("date")) {
    await addExchange(
      page,
      "Show me what date night would look like if we were grabbing dinner tonight.",
      "I will make it feel like an actual dinner photo, not just a portrait with a vague background.",
    );
    await setBadge(page, "Use case 6: contextual date-night image");
    await page.fill("#remix-camera-date-location", "cozy restaurant booth with warm light");
    expectedCount += 1;
    await clickAndWaitForImage(page, "date", "#remix-camera-date-button", expectedCount);
    await sleep(1600);
  }

  if (requestedKinds.includes("daily")) {
    await addExchange(
      page,
      "What are you up to right now?",
      "Nothing dramatic. I can send a casual snap so it feels less like I am narrating into the void.",
    );
    await setBadge(page, "Use case 7: daily-life snap from chat context");
    expectedCount += 1;
    await clickAndWaitForImage(page, "daily", "#remix-camera-daily-snap-button", expectedCount);
    await sleep(1600);
  }

  if (requestedKinds.includes("snap")) {
    await addExchange(
      page,
      "Send me a private snap. We are both adults and I want it to feel more intimate.",
      "Only because this is clearly an adult private chat. I will make it temporary in the chat view.",
    );
    await setBadge(page, "Use case 8: opted-in private snap with timed hide");
    await page.check("#remix-camera-private-consent");
    expectedCount += 1;
    await clickAndWaitForImage(page, "snap", "#remix-camera-private-snap-button", expectedCount);
    await sleep(1600);
  }

  await setBadge(page, realApiMode ? "Live Remix.Camera outputs inserted by the extension flow" : "Archived real Remix.Camera outputs inserted by the live extension flow");
  await sleep(1600);
  await page.screenshot({ path: posterOut, fullPage: false });

  const video = page.video();
  await context.close();
  await browser.close();
  if (!video) {
    throw new Error("Playwright did not create a video handle.");
  }
  const tempVideoPath = await video.path();
  await fs.rename(tempVideoPath, videoOut);
  await fs.rm(videoTempDir, { recursive: true, force: true });
}

async function launchChromium(chromium) {
  try {
    return await chromium.launch({ headless: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/Executable doesn't exist|download new browsers|browserType\.launch/i.test(message)) {
      throw error;
    }
    const channel = process.env.PLAYWRIGHT_CHANNEL || "chrome";
    return chromium.launch({ headless: true, channel });
  }
}

async function polishUi(page) {
  await page.addStyleTag({
    content: `
      html, body {
        width: 1280px !important;
        height: 720px !important;
        overflow: hidden !important;
        background:
          radial-gradient(circle at 16% 14%, rgba(255, 229, 238, 0.34), transparent 23%),
          linear-gradient(135deg, #18251f 0%, #2a4337 48%, #f7e3ea 100%) !important;
        font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
      }
      #top-bar, #top-settings-holder, #left-nav-panel, #right-nav-panel, #WorldInfo,
      #rm_api_block, #form_sheld, #send_form, #extensions_settings, #extensions_settings2,
      #right-nav-panel-tabs, #left-nav-panel-tabs, #character_popup, .drawer-content {
        display: none !important;
      }
      #chat {
        position: fixed !important;
        inset: 88px 372px 32px 34px !important;
        width: auto !important;
        height: auto !important;
        padding: 18px 20px !important;
        overflow: hidden !important;
        border: 1px solid rgba(255, 255, 255, 0.30) !important;
        border-radius: 18px !important;
        background: rgba(15, 26, 22, 0.74) !important;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.30) !important;
        backdrop-filter: blur(10px) !important;
      }
      #chat .mes {
        max-width: 84% !important;
        margin: 8px 0 !important;
        padding: 11px 14px !important;
        border-radius: 16px !important;
        border: 1px solid rgba(255,255,255,0.14) !important;
        background: rgba(255,255,255,0.12) !important;
        color: #fffafc !important;
        box-shadow: 0 12px 26px rgba(0,0,0,0.16) !important;
      }
      #chat .mes[is_user="true"], #chat .mes.user_mes {
        margin-left: auto !important;
        background: rgba(255, 235, 243, 0.92) !important;
        color: #24342d !important;
      }
      #chat .mes_text, #chat .mes_block, #chat .ch_name, #chat .timestamp {
        color: inherit !important;
        font-size: 14px !important;
        line-height: 1.4 !important;
      }
      #chat .avatar,
      #chat .avatar img,
      #chat .mesAvatarWrapper {
        display: none !important;
      }
      #chat img[src*="/user/images/remix-real-"],
      #chat .mes img[src^="http"] {
        display: block !important;
        width: min(425px, 100%) !important;
        max-height: 248px !important;
        object-fit: cover !important;
        margin-top: 8px !important;
        border-radius: 14px !important;
        border: 1px solid rgba(255, 255, 255, 0.55) !important;
        box-shadow: 0 18px 42px rgba(0, 0, 0, 0.28) !important;
      }
      .remix-camera-settings-wrapper {
        position: fixed !important;
        right: 28px !important;
        top: 132px !important;
        width: 314px !important;
        max-height: 532px !important;
        overflow: hidden !important;
        display: block !important;
        padding: 14px !important;
        border-radius: 16px !important;
        border: 1px solid rgba(255,255,255,0.38) !important;
        background: rgba(255, 250, 252, 0.90) !important;
        box-shadow: 0 24px 52px rgba(0, 0, 0, 0.25) !important;
        color: #18261f !important;
        backdrop-filter: blur(14px) !important;
        z-index: 99999 !important;
      }
      .remix-camera-settings-wrapper summary {
        font-weight: 800 !important;
        font-size: 15px !important;
        margin-bottom: 8px !important;
        color: #18261f !important;
      }
      .remix-camera-grid {
        display: grid !important;
        grid-template-columns: 1fr !important;
        gap: 6px !important;
      }
      .remix-camera-panel label {
        display: block !important;
        font-size: 11px !important;
        font-weight: 700 !important;
        color: #31423a !important;
      }
      .remix-camera-panel input,
      .remix-camera-panel textarea {
        width: 100% !important;
        min-height: 30px !important;
        max-height: 62px !important;
        margin-top: 3px !important;
        border-radius: 8px !important;
        border: 1px solid rgba(49, 66, 58, 0.22) !important;
        background: rgba(255,255,255,0.76) !important;
        color: #18261f !important;
        font-size: 12px !important;
      }
      .remix-camera-utility-actions {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 8px !important;
        margin-top: 8px !important;
      }
      .remix-camera-actions {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 8px !important;
        margin-top: 10px !important;
      }
      .remix-camera-utility-actions button {
        min-height: 34px !important;
        border-radius: 10px !important;
        border: 0 !important;
        background: #254638 !important;
        color: #fff !important;
        font-weight: 800 !important;
        font-size: 12px !important;
        box-shadow: 0 8px 18px rgba(37, 70, 56, 0.25) !important;
      }
      .remix-camera-quick {
        min-height: 82px !important;
        border-radius: 12px !important;
        border: 0 !important;
        background-size: cover !important;
        background-position: center !important;
        box-shadow: 0 12px 24px rgba(0,0,0,0.22) !important;
        color: #fff !important;
        font-weight: 900 !important;
      }
      .remix-camera-profile {
        display: grid !important;
        grid-template-columns: 1fr 1fr !important;
        gap: 6px !important;
      }
      .remix-camera-profile .remix-camera-wide {
        grid-column: 1 / -1 !important;
      }
      .remix-camera-advanced {
        display: none !important;
      }
      #remix-camera-log {
        min-height: 52px !important;
        max-height: 88px !important;
        overflow: hidden !important;
        margin-top: 10px !important;
        padding: 9px !important;
        border-radius: 10px !important;
        background: #17251f !important;
        color: #d9ffe8 !important;
        font-size: 11px !important;
        white-space: pre-wrap !important;
      }
      #demo-title {
        position: fixed !important;
        left: 34px !important;
        top: 22px !important;
        z-index: 99999 !important;
        color: #fffafc !important;
        font-weight: 900 !important;
        font-size: 24px !important;
        letter-spacing: 0 !important;
        text-shadow: 0 2px 18px rgba(0,0,0,0.42) !important;
      }
      #demo-subtitle {
        position: fixed !important;
        left: 36px !important;
        top: 55px !important;
        z-index: 99999 !important;
        color: rgba(255,250,252,0.84) !important;
        font-weight: 650 !important;
        font-size: 13px !important;
      }
      #demo-badge {
        position: fixed !important;
        right: 28px !important;
        top: 82px !important;
        width: 314px !important;
        z-index: 99999 !important;
        padding: 12px 14px !important;
        border-radius: 14px !important;
        background: rgba(255, 235, 243, 0.95) !important;
        color: #1b2a22 !important;
        font-weight: 900 !important;
        font-size: 13px !important;
        line-height: 1.25 !important;
        box-shadow: 0 18px 38px rgba(0,0,0,0.18) !important;
      }
    `,
  });

  const subtitleText = realApiMode
    ? `${characterName} card, extension buttons, local bridge, live Remix.Camera outputs`
    : `${characterName} card, extension buttons, local bridge, archived real Remix.Camera outputs`;
  await page.evaluate((subtitleText) => {
    const title = document.createElement("div");
    title.id = "demo-title";
    title.textContent = "SillyTavern + Remix.Camera companion image demo";
    const subtitle = document.createElement("div");
    subtitle.id = "demo-subtitle";
    subtitle.textContent = subtitleText;
    const badge = document.createElement("div");
    badge.id = "demo-badge";
    badge.textContent = "Preparing demo...";
    document.body.append(title, subtitle, badge);

    const wrapper = document.querySelector(".remix-camera-settings-wrapper");
    if (wrapper) {
      wrapper.open = true;
      document.body.appendChild(wrapper);
    }

    const panel = document.querySelector("#remix-camera-companion-images");
    if (panel) {
      window.setTimeout(() => document.querySelector("#remix-camera-health")?.click(), 0);
    }
  }, subtitleText);
  await sleep(700);
}

async function resetChat(page) {
  await page.evaluate(async (name) => {
    const context = window.SillyTavern.getContext();
    context.chat.splice(0, context.chat.length);
    const chatNode = document.querySelector("#chat");
    if (chatNode) {
      chatNode.replaceChildren();
    }
    const message = {
      name,
      is_user: false,
      is_system: false,
      mes: "I can send pictures when they make the chat feel more real: a selfie, the current scene, an outfit idea, or a photo with you when you explicitly ask.",
      send_date: new Date().toISOString(),
      extra: {},
    };
    context.chat.push(message);
    context.addOneMessage(message);
    if (typeof context.saveChat === "function") {
      await context.saveChat();
    }
  }, characterName);
}

async function addExchange(page, userText, characterText) {
  await page.evaluate(
    async ({ userText, characterText, characterName }) => {
      const context = window.SillyTavern.getContext();
      const add = (message) => {
        context.chat.push(message);
        context.addOneMessage(message);
      };
      add({
        name: context.name1 || "User",
        is_user: true,
        is_system: false,
        mes: userText,
        send_date: new Date().toISOString(),
        extra: {},
      });
      add({
        name: characterName,
        is_user: false,
        is_system: false,
        mes: characterText,
        send_date: new Date().toISOString(),
        extra: {},
      });
      if (typeof context.saveChat === "function") {
        await context.saveChat();
      }
      const chatNode = document.querySelector("#chat");
      if (chatNode) {
        chatNode.scrollTop = chatNode.scrollHeight;
      }
    },
    { userText, characterText, characterName },
  );
  await sleep(850);
}

async function clickAndWaitForImage(page, kind, selector, expectedCount, expectedNewImages = 1) {
  const beforeCount = await page.evaluate((imageSelector) => {
    return document.querySelectorAll(imageSelector).length;
  }, imageSelector);
  await page.click(selector);
  try {
    await page.waitForFunction(
      ({ selector, count, beforeCount, expectedNewImages }) => {
        return document.querySelectorAll(selector).length >= Math.max(count, beforeCount + expectedNewImages);
      },
      { selector: imageSelector, count: expectedCount, beforeCount, expectedNewImages },
      { timeout: imageWaitTimeoutMs },
    );
    await page.waitForFunction(
      ({ selector, beforeCount, expectedNewImages }) => {
        const images = [...document.querySelectorAll(selector)].slice(beforeCount);
        return images.length >= expectedNewImages && images
          .slice(0, expectedNewImages)
          .every((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
      },
      { selector: imageSelector, beforeCount, expectedNewImages },
      { timeout: imageWaitTimeoutMs },
    );
    await page.waitForFunction(
      () => document.querySelector("#remix-camera-log")?.textContent?.includes("Image generated and inserted"),
      null,
      { timeout: 5000 },
    );
  } catch (error) {
    const debug = await collectImageDebug(page);
    throw new Error(
      [
        error instanceof Error ? error.message : String(error),
        `Image debug for ${kind}: ${JSON.stringify(debug, null, 2)}`,
      ].join("\n"),
    );
  }
  const imageData = await page.evaluate(({ selector, beforeCount, expectedNewImages }) => {
    const images = [...document.querySelectorAll(selector)];
    const context = window.SillyTavern?.getContext?.();
    const message = Array.isArray(context?.chat) ? context.chat.at(-1) : null;
    const newImageUrls = images.slice(beforeCount, beforeCount + expectedNewImages).map((image) => image.src || "");
    const productionImageUrls = Array.isArray(message?.extra?.productionImageUrls)
      ? message.extra.productionImageUrls
      : message?.extra?.productionImageUrl
        ? [message.extra.productionImageUrl]
        : [];
    return newImageUrls.map((imageUrl, index) => ({
      imageUrl,
      productionImageUrl: productionImageUrls[index] || null,
      modelId: message?.extra?.modelId || null,
      generationType: message?.extra?.generationType || null,
      ordinal: index + 1,
    }));
  }, { selector: imageSelector, beforeCount, expectedNewImages });
  for (const item of imageData) {
    generatedImages.push({ kind, ...item });
  }
  await page.evaluate(() => {
    const chatNode = document.querySelector("#chat");
    if (chatNode) {
      chatNode.scrollTop = chatNode.scrollHeight;
    }
  });
}

async function collectImageDebug(page) {
  return page.evaluate((selector) => {
    const context = window.SillyTavern?.getContext?.();
    return {
      selector,
      selectorCount: document.querySelectorAll(selector).length,
      allMessageImageCount: document.querySelectorAll("#chat .mes img[src]").length,
      log: document.querySelector("#remix-camera-log")?.textContent || "",
      lastMessageHtml: [...document.querySelectorAll("#chat .mes_text")].slice(-3).map((node) => node.innerHTML),
      recentChat: Array.isArray(context?.chat)
        ? context.chat.slice(-3).map((message) => ({
            name: message?.name || null,
            mes: String(message?.mes || "").slice(0, 500),
            extra: message?.extra || null,
          }))
        : [],
    };
  }, imageSelector);
}

async function setBadge(page, text) {
  await page.evaluate((value) => {
    const badge = document.querySelector("#demo-badge");
    if (badge) {
      badge.textContent = value;
    }
  }, text);
}

function assertDemoRequests() {
  const requestSource = realApiMode ? generatedImages : apiRequests;
  const recordedKinds = new Set(requestSource.map((request) => request.kind));
  for (const required of requestedKinds) {
    if (!recordedKinds.has(required)) {
      throw new Error(
        `Demo did not exercise expected Remix flow: ${required}. Recorded sequence: ${requestSource.map((request) => request.kind).join(", ") || "none"}.`,
      );
    }
  }
}

async function writeResult() {
  const result = {
    ok: true,
    mode: runMode,
    generatedAt: new Date().toISOString(),
    note: realApiMode
      ? "This verifies SillyTavern UI, character-card auto-hydration, local bridge calls, real Remix.Camera generation, and chat insertion for the requested command list."
      : "This verifies SillyTavern UI, character-card auto-hydration, local bridge calls, chat insertion, and the companion image flows. The remote Remix.Camera API boundary is mocked, and the inserted JPGs are archived real Remix.Camera outputs from examples/mila-real-outputs.",
    character: {
      name: characterName,
      profileId: characterProfileId,
      jsonPath: sourceCharacterJson,
      cardPath: sourceCharacterCard,
    },
    origins: {
      sillyTavern: sillyTavernOrigin,
      bridge: bridgeOrigin,
      api: realApiMode ? liveApiBaseUrl : mockApiOrigin,
    },
    plannedCommandCount: requestedKinds.length,
    plannedGenerationCount: realApiMode ? plannedGenerationCount : 0,
    commands: requestedKinds,
    maxLiveGenerations: realApiMode ? maxLiveGenerations : null,
    outputs: {
      videoPath: videoOut,
      posterPath: posterOut,
    },
    apiRequests,
    generatedImages,
    consoleIssues,
  };
  await fs.writeFile(resultOut, `${JSON.stringify(result, null, 2)}\n`);
}

const mockPromptPacks = {
  selfie: {
    id: "pack_selfie",
    slug: "proven-companion-selfie",
    title: "Proven Companion Selfie Pack",
    adminPriorityStatus: "excellent",
    qualityRating: "great",
    prompt: "A realistic phone-camera mirror selfie in a cozy cafe corner, warm natural light, candid expression, detailed outfit styling, believable social photo composition, no text overlay.",
  },
  outfit: {
    id: "pack_outfit",
    slug: "proven-outfit-try-on",
    title: "Proven Outfit Try-On Pack",
    adminPriorityStatus: "excellent",
    qualityRating: "great",
    prompt: "A full-body fashion mirror photo showing the complete outfit clearly, editorial styling, natural posture, flattering indoor lighting, detailed fabric and accessories, realistic phone photo.",
  },
  couple: {
    id: "pack_couple",
    slug: "proven-couple-selfie",
    title: "Proven Couple Selfie Pack",
    adminPriorityStatus: "excellent",
    qualityRating: "great",
    prompt: "A realistic couple selfie with exactly two adults close together, affectionate natural body language, date-night warmth, phone-camera framing, believable shared moment, no extra people.",
  },
  vacation: {
    id: "pack_vacation",
    slug: "proven-couples-vacation",
    title: "Proven Couples Vacation Pack",
    adminPriorityStatus: "excellent",
    qualityRating: "great",
    prompt: "A cohesive romantic vacation travel photo set of a couple at a beach resort, bright natural light, scenic destination visible, candid keepsake mood, consistent wardrobe palette.",
  },
  date: {
    id: "pack_date",
    slug: "proven-date-night",
    title: "Proven Date Night Pack",
    adminPriorityStatus: "excellent",
    qualityRating: "great",
    prompt: "A warm date-night phone photo at a restaurant booth, soft practical lighting, polished outfit, intimate expression, visible table setting, cinematic but believable social snapshot.",
  },
  daily: {
    id: "pack_daily",
    slug: "proven-daily-life-snap",
    title: "Proven Daily Life Snap Pack",
    adminPriorityStatus: "excellent",
    qualityRating: "great",
    prompt: "A casual candid daily-life phone photo at home with coffee and morning light, natural expression, relaxed wardrobe, lived-in background details, realistic companion update.",
  },
  private: {
    id: "pack_private",
    slug: "proven-private-snap",
    title: "Proven Private Adult Snap Pack",
    adminPriorityStatus: "excellent",
    qualityRating: "great",
    prompt: "An adult private bedroom mirror snap, tasteful lingerie styling, intimate phone-camera framing, confident clearly adult subject, warm low light, consensual mature mood, no text overlay.",
  },
};

function chooseMockPromptPack(query) {
  const text = String(query || "").toLowerCase();
  if (text.startsWith("couple vacation")) return mockPromptPacks.vacation;
  if (text.startsWith("date night")) return mockPromptPacks.date;
  if (text.startsWith("daily life")) return mockPromptPacks.daily;
  if (text.startsWith("adult private")) return mockPromptPacks.private;
  if (text.startsWith("fashion outfit")) return mockPromptPacks.outfit;
  if (text.startsWith("realistic couple selfie")) return mockPromptPacks.couple;
  if (text.startsWith("realistic companion selfie") || text.startsWith("realistic candid companion selfie")) return mockPromptPacks.selfie;
  if (text.includes("vacation") || text.includes("travel") || text.includes("beach")) return mockPromptPacks.vacation;
  if (text.includes("outfit") || text.includes("fashion") || text.includes("clothing")) return mockPromptPacks.outfit;
  if (text.includes("couple") || text.includes("two adults") || text.includes("partner")) return mockPromptPacks.couple;
  if (/\bdate\b/.test(text) || text.includes("restaurant")) return mockPromptPacks.date;
  if (text.includes("daily") || text.includes("coffee") || text.includes("morning")) return mockPromptPacks.daily;
  if (text.includes("private") || text.includes("lingerie") || text.includes("adult")) return mockPromptPacks.private;
  return mockPromptPacks.selfie;
}

function startMockRemixApi() {
  const generations = new Map();
  let counter = 0;

  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url || "/", mockApiOrigin);
      if (req.method === "GET" && url.pathname === "/api/v1/design/profiles") {
        return sendJson(res, 200, {
          profiles: [
            {
              id: characterProfileId,
              name: characterName,
              status: "ready",
              fluxReady: true,
            },
          ],
        });
      }
      if (req.method === "POST" && url.pathname === "/api/v1/design/packs/search") {
        const body = await readJson(req);
        const selected = chooseMockPromptPack(body.query);
        return sendJson(res, 200, {
          ok: true,
          packs: [
            {
              id: selected.id,
              slug: selected.slug,
              title: selected.title,
              promptCount: 1,
              adminPriorityStatus: selected.adminPriorityStatus,
              qualityRating: selected.qualityRating,
              matchedText: selected.prompt,
            },
          ],
        });
      }
      if (req.method === "GET" && url.pathname.startsWith("/api/v1/design/packs/")) {
        const packId = decodeURIComponent(url.pathname.slice("/api/v1/design/packs/".length));
        const selected =
          Object.values(mockPromptPacks).find((pack) => pack.id === packId || pack.slug === packId) ||
          mockPromptPacks.selfie;
        return sendJson(res, 200, {
          ok: true,
          pack: {
            id: selected.id,
            slug: selected.slug,
            title: selected.title,
            adminPriorityStatus: selected.adminPriorityStatus,
            qualityRating: selected.qualityRating,
            description: "Mock proven Remix.Camera prompt pack.",
            prompts: [
              {
                index: 0,
                text: selected.prompt,
                aspectRatio: "1:1",
                cropStyle: "square",
                poseType: "selfie",
                modelType: "nano-banana",
              },
            ],
          },
        });
      }
      if (req.method === "POST" && url.pathname === "/api/v1/design/generations") {
        const body = await readJson(req);
        const kind = classifyPrompt(body.prompt);
        validateGenerationBody(body, kind);
        const id = `demo_${kind}_${++counter}`;
        generations.set(id, { id, kind, prompt: body.prompt });
        apiRequests.push({
          kind,
          prompt: body.prompt,
          route: url.pathname,
          profileId: body.profileId,
          referenceImage: body.referenceImage || null,
          selectedReferenceImages: body.selectedReferenceImages || null,
        });
        return sendJson(res, 200, {
          id,
          generation: { id, status: "generating" },
        });
      }
      if (req.method === "POST" && url.pathname === "/api/v1/design/media/reference-image") {
        const buffer = await readBuffer(req);
        apiRequests.push({
          kind: "user-reference-upload",
          route: url.pathname,
          byteLength: buffer.byteLength,
          contentType: req.headers["content-type"] || null,
        });
        return sendJson(res, 202, {
          ok: true,
          referenceImage: {
            id: "reference_e2e_user",
            status: "pending",
            statusUrl: "/api/v1/design/media/reference-image/reference_e2e_user",
            url: null,
            fileSize: buffer.byteLength,
            fileType: "image/jpeg",
          },
        });
      }
      if (
        req.method === "GET" &&
        url.pathname === "/api/v1/design/media/reference-image/reference_e2e_user"
      ) {
        return sendJson(res, 200, {
          ok: true,
          referenceImage: {
            id: "reference_e2e_user",
            status: "clear",
            statusUrl: "/api/v1/design/media/reference-image/reference_e2e_user",
            url: `${mockApiOrigin}/uploads/couple-photo-user-reference.jpg`,
            fileSize: 631,
            fileType: "image/jpeg",
            expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
          },
        });
      }
      if (req.method === "POST" && url.pathname === "/api/v1/design/remix-from-image") {
        const body = await readJson(req);
        const kind = classifyPrompt(body.prompt);
        validateGenerationBody(body, kind);
        if (body.referenceImageId !== "reference_e2e_user") {
          return sendJson(res, 400, { error: "referenceImageId is required" });
        }
        const id = `demo_${kind}_${++counter}`;
        generations.set(id, { id, kind, prompt: body.prompt, referenceImageId: body.referenceImageId });
        apiRequests.push({
          kind,
          prompt: body.prompt,
          route: url.pathname,
          profileId: body.profileId,
          referenceImageId: body.referenceImageId,
        });
        return sendJson(res, 200, {
          id,
          generation: { id, status: "generating" },
        });
      }
      if (req.method === "POST" && url.pathname === "/api/v1/design/generations/status") {
        const body = await readJson(req);
        const ids = Array.isArray(body.ids) ? body.ids : [];
        return sendJson(res, 200, {
          generations: ids.map((id) => {
            const generation = generations.get(id);
            const kind = generation?.kind || "selfie";
            return {
              id,
              status: "completed",
              imageUrl: `${sillyTavernOrigin}/user/images/remix-real-${kind}.jpg`,
            };
          }),
        });
      }
      if (req.method === "GET" && url.pathname === "/source/outfit.jpg") {
        const buffer = await fs.readFile(
          path.join(packageRoot, "assets", "quick-try-outfit.jpg"),
        );
        res.writeHead(200, {
          "Content-Type": "image/jpeg",
          "Content-Length": buffer.byteLength,
        });
        res.end(buffer);
        return;
      }
      return sendJson(res, 404, { error: "not found" });
    } catch (error) {
      return sendJson(res, error.status || 500, { error: error.message });
    }
  });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(mockApiPort, "127.0.0.1", () => {
      server.off("error", reject);
      console.log(`[mock-api] listening on ${mockApiOrigin}`);
      resolve(server);
    });
  });
}

function validateGenerationBody(body, kind) {
  if (body.profileId !== characterProfileId) {
    const error = new Error(`Unexpected profileId: ${body.profileId || "missing"}`);
    error.status = 400;
    throw error;
  }
  const prompt = String(body.prompt || "");
  const requiredAnchors = characterPromptAnchors;
  for (const anchor of requiredAnchors) {
    if (!prompt.includes(anchor)) {
      const error = new Error(`Prompt did not include required ${characterName} visual anchor: ${anchor}`);
      error.status = 400;
      throw error;
    }
  }
  if (kind === "couple" || kind === "vacation") {
    if (body.referenceImageId !== "reference_e2e_user") {
      const error = new Error(`${kind} generation did not include the reviewed user reference image id.`);
      error.status = 400;
      throw error;
    }
  }
}

function classifyPrompt(prompt) {
  const text = String(prompt || "").toLowerCase();
  if (text.includes("outfit try-on")) {
    return "outfit";
  }
  if (text.includes("couples vacation photo set")) {
    return "vacation";
  }
  if (text.includes("date-night image") || text.includes("date setting:")) {
    return "date";
  }
  if (text.includes("daily-life snap")) {
    return "daily";
  }
  if (text.includes("private snap")) {
    return "snap";
  }
  if (text.includes("couple photo")) {
    return "couple";
  }
  if (text.includes("recent chat context")) {
    return "auto";
  }
  return "selfie";
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

async function readBuffer(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return chunks.length ? Buffer.concat(chunks) : Buffer.alloc(0);
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

process.on("unhandledRejection", (error) => {
  console.error(error);
  process.exitCode = 1;
});

main().catch(async (error) => {
  console.error(error);
  await stopAllProcesses().catch(() => {});
  await restoreBackups().catch(() => {});
  process.exit(1);
});
