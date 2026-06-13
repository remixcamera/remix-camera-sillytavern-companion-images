#!/usr/bin/env node

import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  parseDiscordInteraction,
  runDiscordRemixInteraction,
} from "../adapters/discord/remix-discord-tool.mjs";
import {
  parseLineCommand,
  runLineRemixCommand,
  sendLineRemixResult,
} from "../adapters/line/remix-line-tool.mjs";
import {
  parseMattermostCommand,
  runMattermostRemixCommand,
  sendMattermostRemixResult,
  sendMattermostText,
} from "../adapters/mattermost/remix-mattermost-tool.mjs";
import {
  parseInstagramCommand,
  runInstagramRemixCommand,
  sendInstagramRemixResult,
  sendInstagramText,
} from "../adapters/instagram/remix-instagram-tool.mjs";
import {
  parseMatrixCommand,
  runMatrixRemixCommand,
  sendMatrixRemixResult,
  sendMatrixText,
} from "../adapters/matrix/remix-matrix-tool.mjs";
import {
  parseMessengerCommand,
  runMessengerRemixCommand,
  sendMessengerRemixResult,
  sendMessengerText,
} from "../adapters/messenger/remix-messenger-tool.mjs";
import {
  parseSlackCommand,
  runSlackRemixCommand,
  sendSlackMessage,
  sendSlackRemixResult,
} from "../adapters/slack/remix-slack-tool.mjs";
import {
  parseTelegramCommand,
  runTelegramRemixCommand,
  sendTelegramRemixResult,
  sendTelegramText,
} from "../adapters/telegram/remix-telegram-tool.mjs";
import {
  parseTwilioCommand,
  runTwilioRemixCommand,
  sendTwilioRemixResult,
  sendTwilioText,
} from "../adapters/twilio/remix-twilio-mms-tool.mjs";
import {
  parseWhatsAppCommand,
  runWhatsAppRemixCommand,
  sendWhatsAppRemixResult,
  sendWhatsAppText,
} from "../adapters/whatsapp/remix-whatsapp-tool.mjs";
import {
  parseVkCommand,
  runVkRemixCommand,
  sendVkRemixResult,
  sendVkText,
} from "../adapters/vk/remix-vk-tool.mjs";
import {
  parseRocketChatCommand,
  runRocketChatRemixCommand,
  sendRocketChatRemixResult,
  sendRocketChatText,
} from "../adapters/rocketchat/remix-rocketchat-tool.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");

const MESSAGING_TARGETS = ["telegram", "discord", "whatsapp", "slack", "mattermost", "rocketchat", "line", "messenger", "instagram", "twilio", "matrix", "vk"];

const COMMAND_ALIASES = new Map([
  ["selfie", "send-selfie"],
  ["auto_selfie", "auto-selfie-from-chat"],
  ["auto-selfie", "auto-selfie-from-chat"],
  ["outfit", "outfit-try-on"],
  ["couple", "couple-photo"],
  ["vacation", "couples-vacation"],
  ["date", "date-night"],
  ["daily", "daily-life-snap"],
  ["snap", "private-snap"],
  ["private", "private-snap"],
]);

const DISCORD_SLASH_NAMES = new Map([
  ["selfie", "selfie"],
  ["auto_selfie", "auto_selfie"],
  ["auto-selfie", "auto_selfie"],
  ["outfit", "outfit"],
  ["couple", "couple"],
  ["vacation", "vacation"],
  ["date", "date"],
  ["daily", "daily"],
  ["snap", "snap"],
  ["private", "snap"],
]);

const DEFAULT_COMMANDS = {
  telegram: "/preview selfie cozy couch with lamp light",
  discord: "preview selfie cozy couch with lamp light",
  whatsapp: "preview selfie cozy couch with lamp light",
  slack: "preview selfie cozy couch with lamp light",
  mattermost: "preview selfie cozy couch with lamp light",
  rocketchat: "preview selfie cozy couch with lamp light",
  line: "preview selfie cozy couch with lamp light",
  messenger: "preview selfie cozy couch with lamp light",
  instagram: "preview selfie cozy couch with lamp light",
  twilio: "preview selfie cozy couch with lamp light",
  matrix: "!lily preview selfie cozy couch with lamp light",
  vk: "preview selfie cozy couch with lamp light",
};

const DELIVERY_ENV = {
  telegram: ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"],
  discord: ["DISCORD_WEBHOOK_URL"],
  whatsapp: ["WHATSAPP_ACCESS_TOKEN", "WHATSAPP_PHONE_NUMBER_ID", "WHATSAPP_TO"],
  slack: ["SLACK_BOT_TOKEN", "SLACK_CHANNEL_ID"],
  mattermost: ["MATTERMOST_WEBHOOK_URL"],
  rocketchat: ["ROCKETCHAT_URL", "ROCKETCHAT_AUTH_TOKEN", "ROCKETCHAT_USER_ID", "ROCKETCHAT_ROOM_ID"],
  line: ["LINE_CHANNEL_ACCESS_TOKEN", "LINE_TO"],
  messenger: ["MESSENGER_PAGE_ACCESS_TOKEN", "MESSENGER_RECIPIENT_ID"],
  instagram: ["INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_RECIPIENT_ID"],
  twilio: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM", "TWILIO_TO"],
  matrix: ["MATRIX_HOMESERVER_URL", "MATRIX_ACCESS_TOKEN", "MATRIX_ROOM_ID"],
  vk: ["VK_ACCESS_TOKEN", "VK_PEER_ID"],
};

function parseArgs(argv = process.argv.slice(2)) {
  const args = new Map();
  const flags = new Set();
  for (const arg of argv) {
    if (arg.startsWith("--") && arg.includes("=")) {
      const [key, ...rest] = arg.split("=");
      args.set(key, rest.join("="));
    } else if (arg.startsWith("--")) {
      flags.add(arg);
    }
  }
  return { args, flags };
}

function normalizeCommandName(value) {
  return String(value || "")
    .trim()
    .replace(/^\//, "")
    .toLowerCase();
}

function stripMatrixPrefix(value) {
  return String(value || "")
    .trim()
    .replace(/^(!lily|\/lily)\b/i, "")
    .trim();
}

function stripTelegramSlash(value) {
  return String(value || "").trim().replace(/^\//, "");
}

function commandParts(value, target) {
  const cleaned = target === "matrix" ? stripMatrixPrefix(value) : target === "telegram" ? stripTelegramSlash(value) : String(value || "").trim();
  return cleaned.split(/\s+/).filter(Boolean);
}

function textWithoutYes(value) {
  return String(value || "")
    .replace(/\byes\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function firstUrl(value) {
  return String(value || "").match(/https?:\/\/\S+/i)?.[0] || "";
}

function withoutFirstUrl(value) {
  const url = firstUrl(value);
  return url ? String(value || "").replace(url, "").trim() : String(value || "").trim();
}

function discordInteractionFromText(commandText) {
  const parts = commandParts(commandText, "discord");
  const raw = normalizeCommandName(parts.shift() || "preview").replace(/-/g, "_");
  const rest = parts.join(" ").trim();

  if (raw === "preview") {
    const [requestedRaw = "selfie", ...promptParts] = rest.split(/\s+/).filter(Boolean);
    const requested = normalizeCommandName(requestedRaw).replace(/-/g, "_");
    return {
      data: {
        name: "preview",
        options: [
          { name: "tool", value: COMMAND_ALIASES.get(requested) || "send-selfie" },
          { name: "prompt", value: promptParts.join(" ").trim() },
        ],
      },
    };
  }

  const slashName = DISCORD_SLASH_NAMES.get(raw);
  if (!slashName) {
    return { data: { name: raw, options: [] } };
  }

  const hasYes = /\byes\b/i.test(rest);
  const cleanPrompt = textWithoutYes(withoutFirstUrl(rest));
  const options = [];
  if (["couple", "vacation", "snap"].includes(slashName)) {
    options.push({ name: "yes", value: hasYes });
  }
  if (slashName === "outfit") {
    options.push({ name: "source_image_url", value: firstUrl(rest) });
  }
  options.push({ name: "prompt", value: cleanPrompt });

  return {
    data: {
      name: slashName,
      options,
    },
  };
}

export function parseTargetCommand(target, commandText) {
  switch (target) {
    case "telegram":
      return parseTelegramCommand(commandText);
    case "discord": {
      const interaction = discordInteractionFromText(commandText);
      return { parsed: parseDiscordInteraction(interaction), interaction };
    }
    case "whatsapp":
      return parseWhatsAppCommand(commandText);
    case "slack":
      return parseSlackCommand(commandText);
    case "mattermost":
      return parseMattermostCommand(commandText);
    case "rocketchat":
      return parseRocketChatCommand(commandText);
    case "line":
      return parseLineCommand(commandText);
    case "messenger":
      return parseMessengerCommand(commandText);
    case "instagram":
      return parseInstagramCommand(commandText);
    case "twilio":
      return parseTwilioCommand(commandText);
    case "matrix":
      return parseMatrixCommand(commandText);
    case "vk":
      return parseVkCommand(commandText);
    default:
      throw new Error(`Unsupported target: ${target}`);
  }
}

function commandNameFromParsed(target, parsedResult) {
  const parsed = target === "discord" ? parsedResult?.parsed : parsedResult;
  return parsed?.command || "";
}

function actionFromParsed(target, parsedResult) {
  const parsed = target === "discord" ? parsedResult?.parsed : parsedResult;
  return parsed?.action || "";
}

export function plannedGenerationCount(target, parsedResult) {
  const action = actionFromParsed(target, parsedResult);
  const command = commandNameFromParsed(target, parsedResult);
  if (action !== "generate") {
    return 0;
  }
  return command === "couples-vacation" ? 3 : 1;
}

function parsedSummary(target, parsedResult) {
  const parsed = target === "discord" ? parsedResult?.parsed : parsedResult;
  return {
    action: parsed?.action || null,
    command: parsed?.command || null,
    text: parsed?.text ?? parsed?.prompt ?? null,
  };
}

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

function bridgeOptions({ bridgeUrl, pairedConfig }) {
  return {
    bridgeUrl,
    profileId: process.env.REMIX_PROFILE_ID || pairedConfig.profileId || "",
    characterName: process.env.REMIX_CHARACTER_NAME || pairedConfig.characterName || "Lily",
    visualIdentity:
      process.env.REMIX_CHARACTER_VISUAL_IDENTITY ||
      "Lily is a clearly adult AI companion with consistent face, hair, body type, realistic phone-camera presence, and a warm, playful style based on her Remix.Camera profile photos.",
    snapTtlSeconds: Number(process.env.REMIX_PRIVATE_SNAP_TTL_SECONDS || 120),
  };
}

export async function runTargetCommand({ target, parsedResult, options }) {
  switch (target) {
    case "telegram":
      return runTelegramRemixCommand(parsedResult, options);
    case "discord":
      return runDiscordRemixInteraction(parsedResult.interaction, options);
    case "whatsapp":
      return runWhatsAppRemixCommand(parsedResult, options);
    case "slack":
      return runSlackRemixCommand(parsedResult, options);
    case "mattermost":
      return runMattermostRemixCommand(parsedResult, options);
    case "rocketchat":
      return runRocketChatRemixCommand(parsedResult, options);
    case "line":
      return runLineRemixCommand(parsedResult, options);
    case "messenger":
      return runMessengerRemixCommand(parsedResult, options);
    case "instagram":
      return runInstagramRemixCommand(parsedResult, options);
    case "twilio":
      return runTwilioRemixCommand(parsedResult, options);
    case "matrix":
      return runMatrixRemixCommand(parsedResult, options);
    case "vk":
      return runVkRemixCommand(parsedResult, options);
    default:
      throw new Error(`Unsupported target: ${target}`);
  }
}

function missingDeliveryEnv(target) {
  return (DELIVERY_ENV[target] || []).filter((name) => !process.env[name]);
}

function deliverySkippedReason(target) {
  const missing = missingDeliveryEnv(target);
  if (!missing.length) {
    return "";
  }
  return `Set ${missing.join(", ")} to send this demo through the real ${target} host.`;
}

export function deliveryReadiness(target) {
  const requiredEnv = DELIVERY_ENV[target] || [];
  const missingEnv = missingDeliveryEnv(target);
  return {
    target,
    requiredEnv,
    missingEnv,
    hasDeliveryCredentials: requiredEnv.length > 0 && missingEnv.length === 0,
    status: missingEnv.length === 0 ? "host-delivery-ready" : "missing-host-delivery-credentials",
  };
}

async function deliverDiscordWebhook({ webhookUrl, result, commandText }) {
  const sent = [];
  sent.push(await postDiscordWebhook({ webhookUrl, content: `Discord live demo command: ${commandText}` }));
  if (result?.type === "help" || result?.type === "text" || !result?.imageUrls?.length) {
    sent.push(await postDiscordWebhook({ webhookUrl, content: result?.text || "Remix.Camera demo result." }));
    return sent;
  }
  for (let index = 0; index < result.imageUrls.length; index += 1) {
    sent.push(
      await postDiscordWebhook({
        webhookUrl,
        content: index === 0 ? "Remix.Camera" : "",
        imageUrl: result.imageUrls[index],
      }),
    );
  }
  return sent;
}

async function postDiscordWebhook({ webhookUrl, content, imageUrl }) {
  if (!imageUrl) {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.message || `Discord webhook failed with ${response.status}`);
    }
    return payload;
  }

  if (!/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])[:/]/i.test(imageUrl)) {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content, embeds: [{ image: { url: imageUrl } }] }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.message || `Discord webhook failed with ${response.status}`);
    }
    return payload;
  }

  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch local bridge image: ${imageResponse.status}`);
  }
  const mimeType = imageResponse.headers.get("content-type") || "image/jpeg";
  const form = new FormData();
  form.set("payload_json", JSON.stringify({ content, attachments: [{ id: 0, filename: "remix-camera.jpg" }] }));
  form.set("files[0]", new Blob([await imageResponse.arrayBuffer()], { type: mimeType }), "remix-camera.jpg");
  const response = await fetch(webhookUrl, { method: "POST", body: form });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || `Discord webhook upload failed with ${response.status}`);
  }
  return payload;
}

async function deliverTargetResult({ target, result, commandText }) {
  switch (target) {
    case "telegram":
      await sendTelegramText({
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        chatId: process.env.TELEGRAM_CHAT_ID,
        text: `Telegram live demo command: ${commandText}`,
      });
      return sendTelegramRemixResult({
        botToken: process.env.TELEGRAM_BOT_TOKEN,
        chatId: process.env.TELEGRAM_CHAT_ID,
        result,
      });
    case "discord":
      return deliverDiscordWebhook({
        webhookUrl: process.env.DISCORD_WEBHOOK_URL,
        result,
        commandText,
      });
    case "whatsapp":
      await sendWhatsAppText({
        accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
        to: process.env.WHATSAPP_TO,
        text: `WhatsApp live demo command: ${commandText}`,
      });
      return sendWhatsAppRemixResult({
        accessToken: process.env.WHATSAPP_ACCESS_TOKEN,
        phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID,
        to: process.env.WHATSAPP_TO,
        result,
      });
    case "slack":
      await sendSlackMessage({
        botToken: process.env.SLACK_BOT_TOKEN,
        channelId: process.env.SLACK_CHANNEL_ID,
        text: `Slack live demo command: ${commandText}`,
      });
      return sendSlackRemixResult({
        botToken: process.env.SLACK_BOT_TOKEN,
        channelId: process.env.SLACK_CHANNEL_ID,
        result,
      });
    case "mattermost":
      await sendMattermostText({
        webhookUrl: process.env.MATTERMOST_WEBHOOK_URL,
        text: `Mattermost live demo command: ${commandText}`,
      });
      return sendMattermostRemixResult({
        webhookUrl: process.env.MATTERMOST_WEBHOOK_URL,
        result,
      });
    case "rocketchat":
      await sendRocketChatText({
        serverUrl: process.env.ROCKETCHAT_URL,
        authToken: process.env.ROCKETCHAT_AUTH_TOKEN,
        userId: process.env.ROCKETCHAT_USER_ID,
        roomId: process.env.ROCKETCHAT_ROOM_ID,
        channel: process.env.ROCKETCHAT_CHANNEL,
        text: `Rocket.Chat live demo command: ${commandText}`,
      });
      return sendRocketChatRemixResult({
        serverUrl: process.env.ROCKETCHAT_URL,
        authToken: process.env.ROCKETCHAT_AUTH_TOKEN,
        userId: process.env.ROCKETCHAT_USER_ID,
        roomId: process.env.ROCKETCHAT_ROOM_ID,
        channel: process.env.ROCKETCHAT_CHANNEL,
        result,
      });
    case "line":
      return sendLineRemixResult({
        channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
        to: process.env.LINE_TO,
        result,
      });
    case "messenger":
      await sendMessengerText({
        pageAccessToken: process.env.MESSENGER_PAGE_ACCESS_TOKEN,
        recipientId: process.env.MESSENGER_RECIPIENT_ID,
        text: `Messenger live demo command: ${commandText}`,
      });
      return sendMessengerRemixResult({
        pageAccessToken: process.env.MESSENGER_PAGE_ACCESS_TOKEN,
        recipientId: process.env.MESSENGER_RECIPIENT_ID,
        result,
      });
    case "instagram":
      await sendInstagramText({
        accessToken: process.env.INSTAGRAM_ACCESS_TOKEN,
        igId: process.env.INSTAGRAM_IG_ID || "me",
        recipientId: process.env.INSTAGRAM_RECIPIENT_ID,
        text: `Instagram live demo command: ${commandText}`,
      });
      return sendInstagramRemixResult({
        accessToken: process.env.INSTAGRAM_ACCESS_TOKEN,
        igId: process.env.INSTAGRAM_IG_ID || "me",
        recipientId: process.env.INSTAGRAM_RECIPIENT_ID,
        result,
      });
    case "twilio":
      await sendTwilioText({
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        from: process.env.TWILIO_FROM,
        to: process.env.TWILIO_TO,
        text: `Twilio live demo command: ${commandText}`,
        messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
      });
      return sendTwilioRemixResult({
        accountSid: process.env.TWILIO_ACCOUNT_SID,
        authToken: process.env.TWILIO_AUTH_TOKEN,
        from: process.env.TWILIO_FROM,
        to: process.env.TWILIO_TO,
        messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
        result,
      });
    case "matrix":
      await sendMatrixText({
        homeserverUrl: process.env.MATRIX_HOMESERVER_URL,
        accessToken: process.env.MATRIX_ACCESS_TOKEN,
        roomId: process.env.MATRIX_ROOM_ID,
        text: `Matrix live demo command: ${commandText}`,
      });
      return sendMatrixRemixResult({
        homeserverUrl: process.env.MATRIX_HOMESERVER_URL,
        accessToken: process.env.MATRIX_ACCESS_TOKEN,
        roomId: process.env.MATRIX_ROOM_ID,
        result,
      });
    case "vk":
      await sendVkText({
        accessToken: process.env.VK_ACCESS_TOKEN,
        peerId: process.env.VK_PEER_ID,
        message: `VK live demo command: ${commandText}`,
      });
      return sendVkRemixResult({
        accessToken: process.env.VK_ACCESS_TOKEN,
        peerId: process.env.VK_PEER_ID,
        result,
        attachImages: process.env.VK_ATTACH_IMAGES === "true",
      });
    default:
      throw new Error(`Unsupported target: ${target}`);
  }
}

function publicResultText(result, includePrompt = false) {
  const payload = result?.payload || {};
  if (payload.dryRun) {
    const template = payload.promptTemplate?.packTitle || payload.promptTemplate?.packId || "Remix.Camera template";
    const lines = [`Preview ready: ${template}`];
    if (includePrompt && payload.prompt) {
      lines.push("", payload.prompt);
    }
    return lines.join("\n");
  }
  return result?.text || "";
}

function generatedImagesFromResult(result) {
  const payload = result?.payload || {};
  if (!Array.isArray(payload.results)) {
    return [];
  }
  return payload.results.map((item) => ({
    imageUrl: item?.imageUrl || null,
    productionImageUrl: item?.productionImageUrl || null,
    modelId: item?.modelId || payload.modelId || null,
    generationType: item?.generationType || result?.command || null,
  }));
}

export function buildEvidence({
  target,
  commandText,
  parsedResult,
  result,
  sentMessages = [],
  deliveryAttempted = false,
  skippedReason = "",
  plannedGenerationCount: generationCount,
  bridgeUrl,
  bridgeStarted,
  startedAt,
  characterName,
  profileId,
  includePrompt = false,
  outputDir,
}) {
  const payload = result?.payload || {};
  const generatedImages = generatedImagesFromResult(result);
  return {
    ok: true,
    target,
    mode: deliveryAttempted
      ? generationCount > 0
        ? `${target}-live-host-delivery-generation`
        : `${target}-live-host-delivery-dry-run`
      : generationCount > 0
        ? `${target}-bridge-generation-no-delivery`
        : `${target}-bridge-dry-run-no-delivery`,
    generatedAt: new Date().toISOString(),
    startedAt,
    commandText,
    parsed: parsedSummary(target, parsedResult),
    character: {
      name: characterName,
      profileId: profileId || null,
    },
    bridge: {
      url: bridgeUrl,
      startedByRecorder: bridgeStarted,
      dryRun: Boolean(payload.dryRun),
      promptTemplate: payload.promptTemplate?.packTitle || payload.promptTemplate?.packId || null,
    },
    hostDelivery: {
      attempted: deliveryAttempted,
      delivered: deliveryAttempted,
      skippedReason: deliveryAttempted ? null : skippedReason,
      sentMessageCount: Array.isArray(sentMessages) ? sentMessages.length : sentMessages ? 1 : 0,
      messageIds: messageIdsFromSent(sentMessages),
    },
    plannedGenerationCount: generationCount,
    generatedImages,
    text: publicResultText(result, includePrompt),
    fullPromptIncluded: includePrompt,
    imageUrls: result?.imageUrls || [],
    outputs: {
      jsonPath: path.join(outputDir, "result.json"),
      markdownPath: path.join(outputDir, "transcript.md"),
      htmlPath: path.join(outputDir, "transcript.html"),
    },
  };
}

function messageIdsFromSent(sentMessages) {
  const messages = Array.isArray(sentMessages) ? sentMessages : sentMessages ? [sentMessages] : [];
  return messages
    .map((message) => message?.message_id || message?.messageId || message?.id || message?.event_id || message?.ts || message?.file?.id || message?.messages?.[0]?.id)
    .filter(Boolean);
}

async function writeEvidence(evidence) {
  await mkdir(path.dirname(evidence.outputs.jsonPath), { recursive: true });
  await writeFile(evidence.outputs.jsonPath, `${JSON.stringify(evidence, null, 2)}\n`);
  await writeFile(evidence.outputs.markdownPath, renderMarkdown(evidence));
  await writeFile(evidence.outputs.htmlPath, renderHtml(evidence));
}

function renderMarkdown(evidence) {
  return [
    `# ${titleCase(evidence.target)} Remix.Camera Demo Evidence`,
    "",
    `Generated at: ${evidence.generatedAt}`,
    `Mode: ${evidence.mode}`,
    `Command: \`${evidence.commandText}\``,
    `Bridge: ${evidence.bridge.url}`,
    `Prompt template: ${evidence.bridge.promptTemplate || "n/a"}`,
    `Host delivery: ${evidence.hostDelivery.attempted ? "attempted" : "skipped"}`,
    evidence.hostDelivery.skippedReason ? `Skipped reason: ${evidence.hostDelivery.skippedReason}` : "",
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
    .map((url) => `<figure><img src="${esc(url)}" alt="${esc(evidence.target)} demo output"><figcaption>${esc(url)}</figcaption></figure>`)
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(titleCase(evidence.target))} Remix.Camera Demo Evidence</title>
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
    <h1>${esc(titleCase(evidence.target))} Remix.Camera Demo Evidence</h1>
    <section class="panel">
      <p><strong>Mode:</strong> ${esc(evidence.mode)}</p>
      <p><strong>Command:</strong> <code>${esc(evidence.commandText)}</code></p>
      <p><strong>Prompt template:</strong> ${esc(evidence.bridge.promptTemplate || "n/a")}</p>
      <p><strong>Host delivery:</strong> ${esc(evidence.hostDelivery.attempted ? "attempted" : "skipped")}</p>
      ${evidence.hostDelivery.skippedReason ? `<p>${esc(evidence.hostDelivery.skippedReason)}</p>` : ""}
      <pre>${esc(evidence.text || "")}</pre>
      ${images || "<p>No generated images; dry-run preview only.</p>"}
    </section>
  </main>
</body>
</html>
`;
}

function renderSummaryMarkdown(summary) {
  const lines = [
    "# Remix.Camera Messaging Demo Readiness",
    "",
    `Generated at: ${summary.generatedAt}`,
    `Target: ${summary.target}`,
    `Bridge: ${summary.bridgeUrl}`,
    `Delivery requested: ${summary.deliveryRequested ? "yes" : "no"}`,
    "",
    "## Host Matrix",
    "",
    "| Host | Mode | Prompt template | Delivery status | Missing env | Evidence |",
    "| --- | --- | --- | --- | --- | --- |",
  ];
  for (const item of summary.evidence) {
    const readiness = item.deliveryReadiness || { missingEnv: [], status: "unknown" };
    const missing = readiness.missingEnv?.length ? readiness.missingEnv.join(", ") : "none";
    const evidencePath = item.outputs?.markdownPath || item.outputs?.jsonPath || "";
    lines.push(
      `| ${item.target} | ${item.mode} | ${item.promptTemplate || "n/a"} | ${readiness.status} | ${missing} | ${evidencePath} |`,
    );
  }
  lines.push(
    "",
    "Bridge-only output is not a public host demo. Record a host-delivery demo only after the required platform credentials are present and the message/image lands in the real host.",
    "",
  );
  return lines.join("\n");
}

function renderSummaryHtml(summary) {
  const esc = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const rows = summary.evidence
    .map((item) => {
      const readiness = item.deliveryReadiness || { missingEnv: [], status: "unknown" };
      const ready = readiness.status === "host-delivery-ready";
      const missing = readiness.missingEnv?.length ? readiness.missingEnv.join(", ") : "none";
      const evidencePath = item.outputs?.markdownPath || item.outputs?.jsonPath || "";
      return `<tr>
        <td>${esc(titleCase(item.target))}</td>
        <td><code>${esc(item.mode)}</code></td>
        <td>${esc(item.promptTemplate || "n/a")}</td>
        <td class="${ready ? "ready" : "blocked"}">${esc(readiness.status)}</td>
        <td>${esc(missing)}</td>
        <td>${esc(evidencePath)}</td>
      </tr>`;
    })
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Remix.Camera Messaging Demo Readiness</title>
  <style>
    body { margin: 0; font: 15px/1.5 system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #171717; color: #f7f7f8; }
    main { max-width: 1120px; margin: 0 auto; padding: 32px 20px; }
    h1 { margin: 0 0 8px; font-size: 30px; }
    p { color: #b8b8b8; }
    table { width: 100%; border-collapse: collapse; margin-top: 20px; background: #222; border: 1px solid #333; }
    th, td { border-bottom: 1px solid #333; padding: 10px; text-align: left; vertical-align: top; overflow-wrap: anywhere; }
    th { color: #d1fe17; font-size: 12px; letter-spacing: .08em; text-transform: uppercase; }
    code { color: #f7f7f8; background: rgba(255,255,255,.08); border-radius: 4px; padding: 2px 4px; }
    .ready { color: #d1fe17; font-weight: 700; }
    .blocked { color: #f7b955; font-weight: 700; }
    .note { margin-top: 18px; border-left: 4px solid #f7b955; padding-left: 12px; }
  </style>
</head>
<body>
  <main>
    <h1>Remix.Camera Messaging Demo Readiness</h1>
    <p>Generated at ${esc(summary.generatedAt)}. Target: ${esc(summary.target)}. Bridge: ${esc(summary.bridgeUrl)}. Delivery requested: ${summary.deliveryRequested ? "yes" : "no"}.</p>
    <table>
      <thead>
        <tr><th>Host</th><th>Mode</th><th>Prompt template</th><th>Delivery status</th><th>Missing env</th><th>Evidence</th></tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p class="note">Bridge-only output is not a public host demo. Record a host-delivery demo only after the required platform credentials are present and the message/image lands in the real host.</p>
  </main>
</body>
</html>
`;
}

function titleCase(value) {
  return String(value || "")
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

async function startBridge({ bridgePort }) {
  const bridgeUrl = `http://127.0.0.1:${bridgePort}`;
  const bridgeProcess = spawn(process.execPath, [path.join(packageRoot, "bridge", "server.mjs")], {
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
  return { bridgeProcess, bridgeUrl };
}

async function stopBridge(bridgeProcess) {
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

async function runOneTarget({
  target,
  commandText,
  outputDir,
  bridgeUrl,
  bridgeStarted,
  pairedConfig,
  deliveryRequested,
  spendConfirmed,
  maxGenerations,
  includePrompt,
}) {
  const parsedResult = parseTargetCommand(target, commandText);
  const parsed = target === "discord" ? parsedResult?.parsed : parsedResult;
  if (!parsed || parsed.type === "help") {
    throw new Error(`Expected an image command for ${target}, got: ${commandText}`);
  }

  const generationCount = plannedGenerationCount(target, parsedResult);
  if (generationCount > 0 && !spendConfirmed) {
    throw new Error(`${target} demo would spend Remix.Camera credits. Pass --yes after reviewing the command.`);
  }
  if (generationCount > maxGenerations) {
    throw new Error(`${target} demo would run ${generationCount} generations, exceeding max ${maxGenerations}.`);
  }

  if (deliveryRequested) {
    const missing = missingDeliveryEnv(target);
    if (missing.length) {
      throw new Error(`${target} delivery requires ${missing.join(", ")}.`);
    }
  }

  const options = bridgeOptions({ bridgeUrl, pairedConfig });
  const result = await runTargetCommand({ target, parsedResult, options });
  const sentMessages = deliveryRequested ? await deliverTargetResult({ target, result, commandText }) : [];
  const evidence = buildEvidence({
    target,
    commandText,
    parsedResult,
    result,
    sentMessages,
    deliveryAttempted: deliveryRequested,
    skippedReason: deliverySkippedReason(target),
    plannedGenerationCount: generationCount,
    bridgeUrl,
    bridgeStarted,
    startedAt: new Date().toISOString(),
    characterName: options.characterName,
    profileId: options.profileId,
    includePrompt,
    outputDir,
  });
  await writeEvidence(evidence);
  return evidence;
}

export async function runRecorder(argv = process.argv.slice(2)) {
  const { args, flags } = parseArgs(argv);
  const requestedTarget = args.get("--target") || process.env.REMIX_MESSAGING_DEMO_TARGET || "all";
  const targets = requestedTarget === "all" ? MESSAGING_TARGETS : [requestedTarget];
  for (const target of targets) {
    if (!MESSAGING_TARGETS.includes(target)) {
      throw new Error(`Unsupported target: ${target}. Use one of: ${MESSAGING_TARGETS.join(", ")}, all.`);
    }
  }

  const outputRoot = path.resolve(args.get("--output-dir") || path.join(packageRoot, "tmp", "messaging-demo"));
  const bridgePort = Number(args.get("--bridge-port") || process.env.REMIX_MESSAGING_DEMO_BRIDGE_PORT || 8798);
  const providedBridgeUrl = String(args.get("--bridge-url") || process.env.REMIX_BRIDGE_URL || "").replace(/\/+$/, "");
  const deliveryRequested =
    flags.has("--deliver") || flags.has("--require-delivery") || process.env.REMIX_MESSAGING_DEMO_DELIVER === "true";
  const spendConfirmed = flags.has("--yes") || process.env.REMIX_MESSAGING_DEMO_YES === "true";
  const includePrompt = flags.has("--include-prompt") || process.env.REMIX_MESSAGING_DEMO_INCLUDE_PROMPT === "true";
  const maxGenerations = Number(args.get("--max-generations") || process.env.REMIX_MESSAGING_DEMO_MAX_GENERATIONS || 0);
  const explicitCommand = args.get("--command") || process.env.REMIX_MESSAGING_DEMO_COMMAND || "";
  const pairedConfig = await readPairedConfig();

  let bridgeProcess = null;
  let bridgeUrl = providedBridgeUrl;
  if (!bridgeUrl) {
    const started = await startBridge({ bridgePort });
    bridgeProcess = started.bridgeProcess;
    bridgeUrl = started.bridgeUrl;
  }

  try {
    await rm(outputRoot, { recursive: true, force: true });
    await mkdir(outputRoot, { recursive: true });
    const evidence = [];
    for (const target of targets) {
      const commandText = explicitCommand || DEFAULT_COMMANDS[target];
      const targetOutputDir = targets.length === 1 ? outputRoot : path.join(outputRoot, target);
      evidence.push(
        await runOneTarget({
          target,
          commandText,
          outputDir: targetOutputDir,
          bridgeUrl,
          bridgeStarted: !providedBridgeUrl,
          pairedConfig,
          deliveryRequested,
          spendConfirmed,
          maxGenerations,
          includePrompt,
        }),
      );
    }
    const summary = {
      ok: evidence.every((item) => item.ok),
      generatedAt: new Date().toISOString(),
      target: requestedTarget,
      bridgeUrl,
      deliveryRequested,
      outputRoot,
      evidence: evidence.map((item) => ({
        target: item.target,
        mode: item.mode,
        promptTemplate: item.bridge.promptTemplate,
        hostDelivery: item.hostDelivery,
        plannedGenerationCount: item.plannedGenerationCount,
        deliveryReadiness: deliveryReadiness(item.target),
        outputs: item.outputs,
      })),
      outputs: {
        jsonPath: path.join(outputRoot, "summary.json"),
        markdownPath: path.join(outputRoot, "summary.md"),
        htmlPath: path.join(outputRoot, "summary.html"),
      },
    };
    await writeFile(summary.outputs.jsonPath, `${JSON.stringify(summary, null, 2)}\n`);
    await writeFile(summary.outputs.markdownPath, renderSummaryMarkdown(summary));
    await writeFile(summary.outputs.htmlPath, renderSummaryHtml(summary));
    console.log(JSON.stringify(summary, null, 2));
    return summary;
  } finally {
    await stopBridge(bridgeProcess);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runRecorder().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
