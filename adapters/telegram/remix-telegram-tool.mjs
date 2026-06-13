import {
  callBridgeCommand,
  commandHelpLines,
  defaultInputForHost,
  imageUrlsFromBridgePayload,
  summarizeBridgePayload,
} from "../shared/bridge-client.mjs";

const SLASH_COMMANDS = new Map([
  ["selfie", "send-selfie"],
  ["auto_selfie", "auto-selfie-from-chat"],
  ["outfit", "outfit-try-on"],
  ["couple", "couple-photo"],
  ["vacation", "couples-vacation"],
  ["date", "date-night"],
  ["daily", "daily-life-snap"],
  ["snap", "private-snap"],
  ["private", "private-snap"],
]);

export function telegramHelpText(characterName = "Lily") {
  return [
    `${characterName} can send Remix.Camera companion images from this chat.`,
    "",
    "Commands:",
    "/selfie cafe mirror selfie",
    "/date quiet restaurant booth",
    "/daily morning coffee on the couch",
    "/outfit https://example.com/outfit.jpg red sundress",
    "/couple yes coffee shop booth with me",
    "/vacation yes Amalfi coast weekend",
    "/snap yes warm bedroom mirror snap",
    "/preview selfie cozy couch with lamp light",
    "",
    "Couple and private commands require the word yes in the command. Preview never spends credits.",
    "",
    "Bridge tools:",
    ...commandHelpLines().map((line) => `- ${line}`),
  ].join("\n");
}

export function parseTelegramCommand(text) {
  const cleaned = String(text || "").trim();
  if (!cleaned.startsWith("/")) {
    return null;
  }
  const [rawCommand, ...restParts] = cleaned.slice(1).split(/\s+/);
  const slash = rawCommand.split("@")[0].toLowerCase();
  const rest = restParts.join(" ").trim();

  if (slash === "start" || slash === "help") {
    return { type: "help" };
  }

  if (slash === "preview") {
    const [requested, ...previewParts] = rest.split(/\s+/);
    const normalized = String(requested || "selfie").toLowerCase().replace(/-/g, "_");
    const command = SLASH_COMMANDS.get(normalized) || "send-selfie";
    return {
      type: "image",
      action: "dry-run",
      command,
      text: previewParts.join(" ").trim(),
    };
  }

  const command = SLASH_COMMANDS.get(slash);
  if (!command) {
    return null;
  }

  return {
    type: "image",
    action: "generate",
    command,
    text: rest,
  };
}

export function getTelegramMessage(update) {
  return update?.message || update?.edited_message || null;
}

export function isRemixTelegramCommand(text) {
  return parseTelegramCommand(text) !== null;
}

export function shouldHandleTelegramUpdate(update) {
  const message = getTelegramMessage(update);
  return isRemixTelegramCommand(message?.text || "");
}

function firstUrl(text) {
  return String(text || "").match(/https?:\/\/\S+/i)?.[0] || "";
}

function withoutFirstUrl(text) {
  const url = firstUrl(text);
  return url ? String(text || "").replace(url, "").trim() : String(text || "").trim();
}

export function buildBridgeInputFromTelegram(parsed, options = {}) {
  const text = parsed?.text || "";
  const lowerText = text.toLowerCase();
  const hasYes = /\byes\b/.test(lowerText);
  const sourceImageUrl = firstUrl(text);
  const promptText = withoutFirstUrl(text);
  const input = {
    profileId: options.profileId,
    characterName: options.characterName,
    visualIdentity: options.visualIdentity,
    chatText: promptText,
    mood: promptText,
    location: promptText,
    outfit: parsed?.command === "outfit-try-on" ? promptText : undefined,
    sourceImageUrl,
    userConsent: ["couple-photo", "couples-vacation"].includes(parsed?.command) && hasYes ? "yes" : undefined,
    theme: parsed?.command === "couples-vacation" ? promptText : undefined,
    matureContent: parsed?.command === "private-snap" ? true : options.matureContent,
    maxGenerations: parsed?.command === "couples-vacation" ? 3 : 1,
    snapTtlSeconds: parsed?.command === "private-snap" ? Number(options.snapTtlSeconds || 120) : undefined,
  };

  if (parsed?.action === "generate") {
    input.yes = true;
  }
  if (parsed?.command === "private-snap" && !hasYes && parsed?.action === "generate") {
    delete input.yes;
  }

  return defaultInputForHost(input);
}

export async function runTelegramRemixCommand(parsed, options = {}) {
  if (!parsed || parsed.type === "help") {
    return {
      type: "help",
      text: telegramHelpText(options.characterName),
    };
  }

  if (parsed.action === "generate" && ["couple-photo", "couples-vacation", "private-snap"].includes(parsed.command)) {
    const hasConsent = /\byes\b/i.test(parsed.text || "");
    if (!hasConsent) {
      return {
        type: "text",
        text: `${parsed.command} needs explicit yes in the command before spending credits. Use /preview first, or send the command again with yes.`,
      };
    }
  }

  const input = buildBridgeInputFromTelegram(parsed, options);
  const payload = await callBridgeCommand({
    bridgeUrl: options.bridgeUrl,
    command: parsed.command,
    action: parsed.action,
    input,
    fetchImpl: options.fetchImpl,
  });

  return {
    type: "bridge",
    command: parsed.command,
    input,
    payload,
    text: summarizeBridgePayload(payload),
    imageUrls: imageUrlsFromBridgePayload(payload),
    deleteAfterSeconds: parsed.command === "private-snap" ? Number(input.snapTtlSeconds || options.snapTtlSeconds || 120) : 0,
  };
}

async function telegramRequest(botToken, method, body) {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    throw new Error(payload?.description || `Telegram ${method} failed with ${response.status}`);
  }
  return payload.result;
}

export async function sendTelegramText({ botToken, chatId, text, parseMode = "" }) {
  const form = new FormData();
  form.set("chat_id", String(chatId));
  form.set("text", text);
  if (parseMode) {
    form.set("parse_mode", parseMode);
  }
  return telegramRequest(botToken, "sendMessage", form);
}

export async function sendTelegramPhoto({ botToken, chatId, imageUrl, caption = "" }) {
  const form = new FormData();
  form.set("chat_id", String(chatId));
  form.set("caption", caption.slice(0, 1024));

  if (/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])[:/]/i.test(imageUrl)) {
    const imageResponse = await fetch(imageUrl);
    if (!imageResponse.ok) {
      throw new Error(`Failed to fetch local bridge image: ${imageResponse.status}`);
    }
    const mimeType = imageResponse.headers.get("content-type") || "image/jpeg";
    const blob = new Blob([await imageResponse.arrayBuffer()], { type: mimeType });
    form.set("photo", blob, "remix-camera.jpg");
  } else {
    form.set("photo", imageUrl);
  }

  return telegramRequest(botToken, "sendPhoto", form);
}

export async function deleteTelegramMessage({ botToken, chatId, messageId }) {
  const form = new FormData();
  form.set("chat_id", String(chatId));
  form.set("message_id", String(messageId));
  return telegramRequest(botToken, "deleteMessage", form);
}

export async function sendTelegramRemixResult({ botToken, chatId, result }) {
  if (result.type === "help" || result.type === "text" || !result.imageUrls?.length) {
    return [await sendTelegramText({ botToken, chatId, text: result.text || telegramHelpText() })];
  }

  const sent = [];
  for (let index = 0; index < result.imageUrls.length; index += 1) {
    const caption = index === 0 ? "Remix.Camera" : "";
    sent.push(await sendTelegramPhoto({ botToken, chatId, imageUrl: result.imageUrls[index], caption }));
  }

  if (result.deleteAfterSeconds > 0) {
    for (const message of sent) {
      setTimeout(() => {
        void deleteTelegramMessage({ botToken, chatId, messageId: message.message_id }).catch(() => {});
      }, result.deleteAfterSeconds * 1000);
    }
  }

  return sent;
}

export function createRemixTelegramTool(options = {}) {
  const handleUpdateDetailed = async (update, overrides = {}) => {
    const message = getTelegramMessage(update);
    const text = message?.text || "";
    const chatId = message?.chat?.id;
    if (!chatId) {
      return {
        handled: false,
        reason: "missing-chat",
        parsed: null,
        result: null,
        sentMessages: [],
      };
    }
    const parsed = parseTelegramCommand(text);
    if (!parsed) {
      return {
        handled: false,
        reason: "unknown-command",
        chatId,
        messageId: message?.message_id,
        text,
        parsed: null,
        result: null,
        sentMessages: [],
      };
    }
    const merged = { ...options, ...overrides };
    const result = await runTelegramRemixCommand(parsed, merged);
    const sentMessages =
      merged.autoSend === false || !merged.botToken
        ? []
        : await sendTelegramRemixResult({
            botToken: merged.botToken,
            chatId,
            result,
          });
    return {
      handled: true,
      chatId,
      messageId: message?.message_id,
      text,
      parsed,
      result,
      sentMessages,
    };
  };

  return {
    helpText: () => telegramHelpText(options.characterName),
    parseCommand: parseTelegramCommand,
    isCommand: isRemixTelegramCommand,
    shouldHandleUpdate: shouldHandleTelegramUpdate,
    buildInput: (parsed) => buildBridgeInputFromTelegram(parsed, options),
    run: (parsed, overrides = {}) => runTelegramRemixCommand(parsed, { ...options, ...overrides }),
    send: (result, sendOptions = {}) => sendTelegramRemixResult({ ...options, ...sendOptions, result }),
    handleUpdateDetailed,
    async handleUpdate(update, overrides = {}) {
      const details = await handleUpdateDetailed(update, overrides);
      return details.handled ? details.result : null;
    },
  };
}
