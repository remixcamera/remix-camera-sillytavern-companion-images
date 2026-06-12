#!/usr/bin/env node

import { createRemixTelegramTool, sendTelegramText } from "./remix-telegram-tool.mjs";

const LILY_PROFILE_ID = "GLUCbfOgIzOLe37Ft4G7S97B0fu2_lily";
const botToken = process.env.TELEGRAM_BOT_TOKEN || "";
const bridgeUrl = process.env.REMIX_BRIDGE_URL || "http://127.0.0.1:8787";
const characterName = process.env.REMIX_CHARACTER_NAME || "Lily";
const profileId = process.env.REMIX_PROFILE_ID || LILY_PROFILE_ID;
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
          const handled = await tool.handleUpdate(update);
          if (!handled && message?.text?.startsWith("/")) {
            await sendTelegramText({
              botToken,
              chatId,
              text: tool.helpText(),
            });
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

