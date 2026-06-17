#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  createRemixTelegramTool,
  extractTelegramChatId,
  extractTelegramText,
  sendTelegramText,
  telegramImageContextFromResult,
  telegramResultMetadataForLog,
} from "./remix-telegram-tool.mjs";

const LILY_PROFILE_ID = "GLUCbfOgIzOLe37Ft4G7S97B0fu2_lily";
const botToken = process.env.TELEGRAM_BOT_TOKEN || "";
const bridgeUrl = process.env.REMIX_BRIDGE_URL || "http://127.0.0.1:8787";
const characterName = process.env.REMIX_CHARACTER_NAME || "Lily";
const profileId = process.env.REMIX_PROFILE_ID || LILY_PROFILE_ID;
const imageContextPath =
  process.env.TELEGRAM_IMAGE_CONTEXT_FILE ||
  process.env.REMIX_TELEGRAM_IMAGE_CONTEXT_FILE ||
  path.join(os.homedir(), ".remix-camera", "telegram-last-images.json");
const visualIdentity =
  process.env.REMIX_CHARACTER_VISUAL_IDENTITY ||
  "Lily is a clearly adult AI companion with consistent face, hair, body type, realistic phone-camera presence, and a warm, playful style based on her Remix.Camera profile photos.";

if (!botToken) {
  console.error("TELEGRAM_BOT_TOKEN is required.");
  process.exit(1);
}

const tool = createRemixTelegramTool({
  botToken,
  bridgeUrl,
  profileId,
  characterName,
  visualIdentity,
  snapTtlSeconds: Number(process.env.REMIX_PRIVATE_SNAP_TTL_SECONDS || 120),
});

const recentChatById = new Map();
const lastImageById = readStoredImageContexts();

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function readStoredImageContexts() {
  if (!imageContextPath || !fs.existsSync(imageContextPath)) {
    return new Map();
  }
  try {
    const payload = JSON.parse(fs.readFileSync(imageContextPath, "utf8"));
    return new Map(
      Object.entries(payload?.chats || {})
        .filter(([chatId, context]) => chatId && context && typeof context === "object")
        .map(([chatId, context]) => [
          chatId,
          {
            sourceImageUrl: cleanString(context.sourceImageUrl),
            fallbackImageUrl: cleanString(context.fallbackImageUrl),
            generationId: cleanString(context.generationId),
            updatedAt: cleanString(context.updatedAt),
          },
        ])
        .filter(([, context]) => context.sourceImageUrl),
    );
  } catch (error) {
    console.warn(`Could not read Telegram image context at ${imageContextPath}: ${error.message}`);
    return new Map();
  }
}

function writeStoredImageContexts() {
  if (!imageContextPath) {
    return;
  }
  fs.mkdirSync(path.dirname(imageContextPath), { recursive: true });
  const tmpPath = `${imageContextPath}.${process.pid}.tmp`;
  fs.writeFileSync(
    tmpPath,
    JSON.stringify(
      {
        chats: Object.fromEntries(lastImageById.entries()),
        updatedAt: new Date().toISOString(),
      },
      null,
      2,
    ),
  );
  fs.renameSync(tmpPath, imageContextPath);
}

function rememberChatLine(chatId, line) {
  if (!chatId || !cleanString(line)) {
    return;
  }
  const key = String(chatId);
  const current = Array.isArray(recentChatById.get(key)) ? recentChatById.get(key) : [];
  recentChatById.set(key, [...current, line].slice(-12));
}

function recentChatText(chatId) {
  return (recentChatById.get(String(chatId)) || []).join("\n");
}

function rememberLastGeneratedImage(chatId, context) {
  if (!chatId || !context?.sourceImageUrl) {
    return;
  }
  lastImageById.set(String(chatId), {
    sourceImageUrl: cleanString(context.sourceImageUrl),
    fallbackImageUrl: cleanString(context.fallbackImageUrl),
    generationId: cleanString(context.generationId),
    updatedAt: cleanString(context.updatedAt) || new Date().toISOString(),
  });
  writeStoredImageContexts();
}

async function telegramJson(method, body) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    throw new Error(payload?.description || `Telegram ${method} failed with ${response.status}`);
  }
  return payload.result;
}

async function setCommands() {
  await telegramJson("setMyCommands", {
    commands: [
      { command: "start", description: "Show Lily image commands" },
      { command: "help", description: "Show Lily image commands" },
      { command: "preview", description: "Preview a Remix.Camera image prompt" },
      { command: "selfie", description: "Generate a Lily selfie" },
      { command: "date", description: "Generate a date-night photo" },
      { command: "daily", description: "Generate a daily-life snap" },
      { command: "couple", description: "Generate a couple photo with consent" },
      { command: "vacation", description: "Generate a 3-photo couples vacation set" },
      { command: "snap", description: "Generate an opted-in private snap" },
    ],
  });
}

async function pollUpdates() {
  let offset = Number(process.env.TELEGRAM_UPDATE_OFFSET || 0);
  console.log(`Lily Telegram bot listening. Bridge: ${bridgeUrl}; profile: ${profileId}`);
  await setCommands().catch((error) => console.warn(`Could not set Telegram commands: ${error.message}`));

  while (true) {
    try {
      const updates = await telegramJson("getUpdates", {
        offset,
        timeout: 25,
        allowed_updates: ["message", "edited_message"],
      });
      for (const update of updates) {
        offset = Math.max(offset, update.update_id + 1);
        const message = update.message || update.edited_message;
        const chatId = message?.chat?.id;
        if (!chatId) {
          continue;
        }
        try {
          const text = extractTelegramText(update);
          const details = await tool.handleUpdateDetailed(update, {
            recentChatText: recentChatText(chatId),
            lastGeneratedImageUrl: lastImageById.get(String(chatId))?.sourceImageUrl,
          });
          if (text) {
            rememberChatLine(chatId, `User: ${text}`);
          }
          if (!details.handled && message?.text?.startsWith("/")) {
            await sendTelegramText({
              botToken,
              chatId,
              text: tool.helpText(),
            });
          }
          if (details.handled) {
            const imageContext = telegramImageContextFromResult(details.result);
            if (imageContext) {
              rememberLastGeneratedImage(chatId, imageContext);
            }
            console.log(
              `Handled ${details.parsed?.command || details.parsed?.type || "message"} in chat ${extractTelegramChatId(update)}`,
              JSON.stringify(telegramResultMetadataForLog(details)),
            );
          }
        } catch (error) {
          await sendTelegramText({
            botToken,
            chatId,
            text: `Lily could not make that image yet: ${error.message}`,
          });
        }
      }
    } catch (error) {
      console.warn(`Telegram polling failed: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }
  }
}

pollUpdates();
