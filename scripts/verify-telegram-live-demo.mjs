#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  parseTelegramCommand,
  runTelegramRemixCommand,
  sendTelegramRemixResult,
  sendTelegramText,
} from "../adapters/telegram/remix-telegram-tool.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
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
const flags = new Set(process.argv.slice(2).filter((arg) => arg.startsWith("--") && !arg.includes("=")));

const outputDir = path.resolve(args.get("--output-dir") || path.join(packageRoot, "tmp", "telegram-live-demo"));
const bridgePort = Number(args.get("--bridge-port") || process.env.REMIX_TELEGRAM_DEMO_BRIDGE_PORT || 8797);
const providedBridgeUrl = String(args.get("--bridge-url") || process.env.REMIX_BRIDGE_URL || "").replace(/\/+$/, "");
const bridgeUrl = providedBridgeUrl || `http://127.0.0.1:${bridgePort}`;
const commandText = args.get("--command") || process.env.REMIX_TELEGRAM_DEMO_COMMAND || "/preview selfie cozy couch with lamp light";
const spendConfirmed = flags.has("--yes") || process.env.REMIX_TELEGRAM_DEMO_YES === "true";
const sendTelegram = flags.has("--send-telegram") || process.env.REMIX_TELEGRAM_DEMO_SEND === "true";
const requireTelegram = flags.has("--require-telegram") || process.env.REMIX_TELEGRAM_DEMO_REQUIRE_TELEGRAM === "true";
const includePrompt = flags.has("--include-prompt") || process.env.REMIX_TELEGRAM_DEMO_INCLUDE_PROMPT === "true";
const maxGenerations = Number(args.get("--max-generations") || process.env.REMIX_TELEGRAM_DEMO_MAX_GENERATIONS || 0);
const botToken = process.env.TELEGRAM_BOT_TOKEN || "";
const chatId = process.env.TELEGRAM_CHAT_ID || "";
const pairedConfig = await readPairedConfig();
const profileId = process.env.REMIX_PROFILE_ID || pairedConfig.profileId || "";
const characterName = process.env.REMIX_CHARACTER_NAME || pairedConfig.characterName || "Lily";
const visualIdentity =
  process.env.REMIX_CHARACTER_VISUAL_IDENTITY ||
  "Lily is a clearly adult AI companion with consistent face, hair, body type, realistic phone-camera presence, and a warm, playful style based on her Remix.Camera profile photos.";

let bridgeProcess = null;
const startedAt = new Date().toISOString();

async function readPairedConfig() {
  try {
    const configPath = process.env.REMIX_CONFIG_FILE || path.join(os.homedir(), ".remix-camera", "sillytavern-bridge.json");
    const config = JSON.parse(await readFile(configPath, "utf8"));
    return {
      profileId: typeof config.profileId === "string" ? config.profileId : "",
      characterName: typeof config.characterName === "string" ? config.characterName : "",
    };
  } catch {
    return { profileId: "", characterName: "" };
  }
}

async function main() {
  const parsed = parseTelegramCommand(commandText);
  if (!parsed || parsed.type !== "image") {
    throw new Error(`Expected an image Telegram command, got: ${commandText}`);
  }
  const plannedGenerationCount = parsed.action === "generate" ? (parsed.command === "couples-vacation" ? 3 : 1) : 0;
  if (plannedGenerationCount > 0 && !spendConfirmed) {
    throw new Error("Telegram live demo would spend Remix.Camera credits. Pass --yes after reviewing the command.");
  }
  if (plannedGenerationCount > maxGenerations) {
    throw new Error(`Telegram live demo would run ${plannedGenerationCount} generations, exceeding max ${maxGenerations}.`);
  }
  if ((sendTelegram || requireTelegram) && (!botToken || !chatId)) {
    throw new Error("TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required to send the Telegram demo.");
  }

  await rm(outputDir, { recursive: true, force: true });
  await mkdir(outputDir, { recursive: true });
  if (!providedBridgeUrl) {
    await startBridge();
  }

  try {
    const result = await runTelegramRemixCommand(parsed, {
      bridgeUrl,
      profileId,
      characterName,
      visualIdentity,
      snapTtlSeconds: Number(process.env.REMIX_PRIVATE_SNAP_TTL_SECONDS || 120),
    });
    const sentMessages = await maybeSendTelegram(result);
    const evidence = buildEvidence({ parsed, result, sentMessages, plannedGenerationCount });
    await writeEvidence(evidence);
    console.log(JSON.stringify(evidence, null, 2));
  } finally {
    await stopBridge();
  }
}

async function startBridge() {
  bridgeProcess = spawn(process.execPath, [path.join(packageRoot, "bridge", "server.mjs")], {
    cwd: packageRoot,
    env: {
      ...process.env,
      REMIX_BRIDGE_HOST: "127.0.0.1",
      REMIX_BRIDGE_PORT: String(bridgePort),
      REMIX_ALLOWED_ORIGINS: "http://127.0.0.1:8000,http://localhost:8000",
      REMIX_POLL_INTERVAL_MS: process.env.REMIX_POLL_INTERVAL_MS || "2000",
      REMIX_POLL_TIMEOUT_MS: process.env.REMIX_POLL_TIMEOUT_MS || "180000",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  bridgeProcess.stdout.on("data", (chunk) => {
    const text = chunk.toString("utf8");
    if (/listening|error|failed/i.test(text)) process.stdout.write(`[bridge] ${text}`);
  });
  bridgeProcess.stderr.on("data", (chunk) => {
    const text = chunk.toString("utf8");
    if (/listening|error|failed/i.test(text)) process.stderr.write(`[bridge] ${text}`);
  });
  await waitForHttp(`${bridgeUrl}/health`, 15000);
}

async function stopBridge() {
  if (!bridgeProcess || bridgeProcess.exitCode !== null || bridgeProcess.signalCode) {
    return;
  }
  bridgeProcess.kill("SIGTERM");
  await new Promise((resolve) => setTimeout(resolve, 750));
  if (bridgeProcess.exitCode === null && !bridgeProcess.signalCode) {
    bridgeProcess.kill("SIGKILL");
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
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Timed out waiting for ${url}: ${lastError?.message || "no response"}`);
}

async function maybeSendTelegram(result) {
  if (!sendTelegram) {
    return [];
  }
  await sendTelegramText({
    botToken,
    chatId,
    text: `Telegram live demo command: ${commandText}`,
  });
  return sendTelegramRemixResult({
    botToken,
    chatId,
    result,
  });
}

function buildEvidence({ parsed, result, sentMessages, plannedGenerationCount }) {
  const payload = result.payload || {};
  const generatedImages = Array.isArray(payload.results)
    ? payload.results.map((item) => ({
        imageUrl: item.imageUrl || null,
        productionImageUrl: item.productionImageUrl || null,
        modelId: item.modelId || payload.modelId || null,
        generationType: item.generationType || result.command || null,
      }))
    : [];
  return {
    ok: true,
    mode: sendTelegram
      ? plannedGenerationCount > 0
        ? "telegram-live-bot-api-generation"
        : "telegram-live-bot-api-dry-run"
      : plannedGenerationCount > 0
        ? "telegram-bridge-generation-no-delivery"
        : "telegram-bridge-dry-run-no-delivery",
    generatedAt: new Date().toISOString(),
    startedAt,
    commandText,
    parsed: {
      action: parsed.action,
      command: parsed.command,
      text: parsed.text,
    },
    character: {
      name: characterName,
      profileId: profileId || null,
    },
    bridge: {
      url: bridgeUrl,
      startedByVerifier: !providedBridgeUrl,
      dryRun: Boolean(payload.dryRun),
      promptTemplate: payload.promptTemplate?.packTitle || payload.promptTemplate?.packId || null,
    },
    telegramDelivery: {
      attempted: sendTelegram,
      skippedReason: sendTelegram ? null : "TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID were not provided; no Telegram message was sent.",
      sentMessageCount: sentMessages.length,
      messageIds: sentMessages.map((message) => message?.message_id || message?.messageId || message?.id).filter(Boolean),
    },
    plannedGenerationCount,
    generatedImages,
    text: publicResultText(result),
    fullPromptIncluded: includePrompt,
    imageUrls: result.imageUrls || [],
    outputs: {
      jsonPath: path.join(outputDir, "result.json"),
      markdownPath: path.join(outputDir, "transcript.md"),
      htmlPath: path.join(outputDir, "transcript.html"),
    },
  };
}

function publicResultText(result) {
  const payload = result.payload || {};
  if (payload.dryRun) {
    const template = payload.promptTemplate?.packTitle || payload.promptTemplate?.packId || "Remix.Camera template";
    const lines = [`Preview ready: ${template}`];
    if (includePrompt && payload.prompt) {
      lines.push("", payload.prompt);
    }
    return lines.join("\n");
  }
  return result.text || "";
}

async function writeEvidence(evidence) {
  await writeFile(evidence.outputs.jsonPath, `${JSON.stringify(evidence, null, 2)}\n`);
  await writeFile(evidence.outputs.markdownPath, renderMarkdown(evidence));
  await writeFile(evidence.outputs.htmlPath, renderHtml(evidence));
}

function renderMarkdown(evidence) {
  return [
    "# Telegram Remix.Camera Demo Evidence",
    "",
    `Generated at: ${evidence.generatedAt}`,
    `Mode: ${evidence.mode}`,
    `Command: \`${evidence.commandText}\``,
    `Bridge: ${evidence.bridge.url}`,
    `Prompt template: ${evidence.bridge.promptTemplate || "n/a"}`,
    `Telegram delivery: ${evidence.telegramDelivery.attempted ? "attempted" : "skipped"}`,
    evidence.telegramDelivery.skippedReason ? `Skipped reason: ${evidence.telegramDelivery.skippedReason}` : "",
    "",
    "## Result",
    "",
    "```text",
    evidence.text || "",
    "```",
    "",
    "## Images",
    "",
    ...(evidence.generatedImages.length
      ? evidence.generatedImages.map((image) => `- ${image.productionImageUrl || image.imageUrl || "image returned"} (${image.modelId || "model n/a"})`)
      : ["- No generated images; dry-run preview only."]),
    "",
  ]
    .filter((line) => line !== "")
    .join("\n");
}

function renderHtml(evidence) {
  const esc = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const images = evidence.generatedImages
    .map((image) => image.productionImageUrl || image.imageUrl)
    .filter(Boolean)
    .map((url) => `<figure><img src="${esc(url)}" alt="Telegram demo output"><figcaption>${esc(url)}</figcaption></figure>`)
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Telegram Remix.Camera Demo Evidence</title>
  <style>
    body { margin: 0; font: 15px/1.5 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #0f241d; color: #f4f7f4; }
    main { max-width: 920px; margin: 0 auto; padding: 32px; }
    .panel { background: rgba(255,255,255,.08); border: 1px solid rgba(255,255,255,.18); border-radius: 8px; padding: 18px; }
    code, pre { background: rgba(0,0,0,.28); border-radius: 6px; padding: 2px 5px; }
    pre { white-space: pre-wrap; padding: 12px; }
    img { max-width: 360px; border-radius: 8px; display: block; }
    figcaption { color: #cbd7ce; font-size: 12px; overflow-wrap: anywhere; margin-top: 6px; }
  </style>
</head>
<body>
  <main>
    <h1>Telegram Remix.Camera Demo Evidence</h1>
    <section class="panel">
      <p><strong>Mode:</strong> ${esc(evidence.mode)}</p>
      <p><strong>Command:</strong> <code>${esc(evidence.commandText)}</code></p>
      <p><strong>Prompt template:</strong> ${esc(evidence.bridge.promptTemplate || "n/a")}</p>
      <p><strong>Telegram delivery:</strong> ${esc(evidence.telegramDelivery.attempted ? "attempted" : "skipped")}</p>
      ${evidence.telegramDelivery.skippedReason ? `<p>${esc(evidence.telegramDelivery.skippedReason)}</p>` : ""}
      <pre>${esc(evidence.text || "")}</pre>
      ${images || "<p>No generated images; dry-run preview only.</p>"}
    </section>
  </main>
</body>
</html>
`;
}

main().catch(async (error) => {
  await stopBridge();
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
