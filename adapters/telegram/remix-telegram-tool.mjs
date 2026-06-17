import crypto from "node:crypto";
import {
  buildCompanionBridgeInput,
  companionHelpText,
  companionNonImageText,
  companionProgressText,
  isPublicHttpsUrl,
  parseCompanionSurfaceCommand,
  publicImageUrlsFromCompanionResult,
  runCompanionBridgeCommand,
} from "../shared/companion-surface-controller.mjs";

const TELEGRAM_PHOTO_UPLOAD_MAX_BYTES = 10 * 1024 * 1024;

function timingSafeStringEqual(expected, received) {
  const expectedBuffer = Buffer.from(String(expected || ""), "utf8");
  const receivedBuffer = Buffer.from(String(received || ""), "utf8");
  return expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function telegramHelpText(characterName = "Lily") {
  return companionHelpText(characterName, { previewExample: "/preview send me a bath selfie" });
}

export function telegramNonImageText(characterName = "Lily") {
  return companionNonImageText(characterName);
}

export function parseTelegramCommand(text) {
  return parseCompanionSurfaceCommand(text);
}

export function isRemixTelegramCommand(text) {
  return parseTelegramCommand(text) !== null;
}

export function extractTelegramMessage(update) {
  return update?.message || update?.edited_message || update?.channel_post || update?.edited_channel_post || null;
}

export const getTelegramMessage = extractTelegramMessage;

export function extractTelegramText(update) {
  const message = extractTelegramMessage(update);
  return String(message?.text || message?.caption || update?.callback_query?.data || "").trim();
}

export function extractTelegramChatId(update) {
  const message = extractTelegramMessage(update) || update?.callback_query?.message || null;
  return message?.chat?.id ?? null;
}

export function shouldHandleTelegramUpdate(update) {
  return isRemixTelegramCommand(extractTelegramText(update));
}

export function verifyTelegramSecret({ expectedSecret, receivedSecret }) {
  if (!expectedSecret) {
    return true;
  }
  return timingSafeStringEqual(expectedSecret, receivedSecret);
}

export function buildBridgeInputFromTelegram(parsed, options = {}) {
  return buildCompanionBridgeInput(parsed, options);
}

export async function runTelegramRemixCommand(parsed, options = {}) {
  return runCompanionBridgeCommand(parsed, {
    previewExample: "/preview send me a bath selfie",
    ...options,
  });
}

function publicImageUrlsFromResult(result) {
  return publicImageUrlsFromCompanionResult(result);
}

function telegramPhotoMessagesFromResult(result, chatId) {
  const messages = [];
  const seen = new Set();
  const append = (photo, fallbackPhotoUrl) => {
    if (!isPublicHttpsUrl(photo) || seen.has(photo)) {
      return;
    }
    seen.add(photo);
    messages.push({
      method: "sendPhoto",
      fallbackPhotoUrl: cleanString(fallbackPhotoUrl),
      body: {
        ...chatIdPayload(chatId),
        photo,
        caption: undefined,
      },
    });
  };

  for (const item of Array.isArray(result?.payload?.results) ? result.payload.results : []) {
    append(item?.productionImageUrl, item?.imageUrl);
    if (!item?.productionImageUrl) {
      append(item?.imageUrl, "");
    }
  }
  for (const photo of Array.isArray(result?.imageUrls) ? result.imageUrls : []) {
    append(photo, "");
  }
  return messages;
}

function chatIdPayload(chatId) {
  return chatId === undefined || chatId === null ? {} : { chat_id: chatId };
}

export function telegramMessagesForResult(result, options = {}) {
  const chatId = options.chatId ?? result?.chatId;
  const publicImageUrls = publicImageUrlsFromResult(result);
  const imageUrls = Array.isArray(result?.imageUrls) ? result.imageUrls : [];
  const hasLocalOnlyImages = imageUrls.length > 0 && publicImageUrls.length === 0;

  if (hasLocalOnlyImages) {
    return [
      {
        method: "sendMessage",
        body: {
          ...chatIdPayload(chatId),
          text: "Remix.Camera generated a local bridge image, but Telegram cannot fetch 127.0.0.1 URLs. Use productionImageUrl delivery or a public bridge.",
          disable_web_page_preview: true,
        },
      },
    ];
  }

  if (!publicImageUrls.length) {
    return [
      {
        method: "sendMessage",
        body: {
          ...chatIdPayload(chatId),
          text: result?.text || telegramHelpText(options.characterName),
          disable_web_page_preview: true,
        },
      },
    ];
  }

  return telegramPhotoMessagesFromResult(result, chatId);
}

export function telegramProgressText(characterName = "Lily", parsed = {}) {
  return companionProgressText(characterName, parsed);
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function bridgeResultId(result) {
  return cleanString(result?.id || result?.generationId || result?.raw?.id || result?.raw?.generationId);
}

export function telegramImageContextFromResult(result = {}) {
  const candidates = Array.isArray(result?.payload?.results) ? result.payload.results : [];
  const selected = candidates.find((item) => item?.ok !== false && (item?.productionImageUrl || item?.imageUrl));
  if (!selected) {
    return null;
  }
  const sourceImageUrl = cleanString(selected.productionImageUrl || selected.imageUrl);
  if (!sourceImageUrl) {
    return null;
  }
  return {
    sourceImageUrl,
    fallbackImageUrl: cleanString(selected.imageUrl),
    generationId: bridgeResultId(selected) || null,
    updatedAt: new Date().toISOString(),
  };
}

export function telegramResultMetadataForLog(details = {}) {
  const payload = details?.result?.payload || {};
  const parsed = details?.parsed || {};
  const results = Array.isArray(payload?.results) ? payload.results : [];
  const responseMessages = Array.isArray(details?.responseMessages) ? details.responseMessages : [];
  const promptTemplate = payload?.promptTemplate && typeof payload.promptTemplate === "object"
    ? payload.promptTemplate
    : {};

  return {
    command: cleanString(parsed.command || payload.command) || null,
    action: cleanString(parsed.action) || null,
    modelId: cleanString(payload.modelId) || null,
    matureContent: payload.matureContent === true,
    promptTemplateDecision: cleanString(payload.promptTemplateDecision) || null,
    promptTemplatePackSlug: cleanString(promptTemplate.packSlug || payload.promptTemplatePackSlug) || null,
    promptTemplateMatchStrength: cleanString(promptTemplate.matchStrength || payload.promptTemplateMatchStrength) || null,
    resultCount: results.length,
    okResultCount: results.filter((result) => result?.ok !== false && (result?.imageUrl || result?.productionImageUrl)).length,
    generationIds: results.map(bridgeResultId).filter(Boolean),
    publicPhotoCount: responseMessages.filter((message) => message?.method === "sendPhoto").length,
  };
}

async function telegramApiRequest({
  botToken,
  method,
  body,
  fetchImpl = globalThis.fetch,
}) {
  if (!botToken) {
    throw new Error("Telegram bot token is required.");
  }
  const response = await fetchImpl(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body || {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.description || payload?.error || `Telegram request failed with ${response.status}`);
  }
  return payload?.result ?? payload;
}

async function telegramMultipartRequest({
  botToken,
  method,
  formData,
  fetchImpl = globalThis.fetch,
}) {
  if (!botToken) {
    throw new Error("Telegram bot token is required.");
  }
  const response = await fetchImpl(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    body: formData,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.description || payload?.error || `Telegram request failed with ${response.status}`);
  }
  return payload?.result ?? payload;
}

async function fetchPhotoForTelegramUpload(photoUrl, fetchImpl) {
  const response = await fetchImpl(photoUrl, {
    headers: {
      Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
    },
  });
  if (!response.ok) {
    throw new Error(`Could not fetch generated image for Telegram upload: ${response.status}`);
  }
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > TELEGRAM_PHOTO_UPLOAD_MAX_BYTES) {
    throw new Error("Generated image is too large for Telegram photo upload.");
  }
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > TELEGRAM_PHOTO_UPLOAD_MAX_BYTES) {
    throw new Error("Generated image is too large for Telegram photo upload.");
  }
  const mimeType = cleanString(response.headers.get("content-type")).split(";")[0] || "image/jpeg";
  return {
    bytes,
    mimeType,
  };
}

async function sendTelegramPhoto({
  botToken,
  body,
  fallbackPhotoUrl,
  fetchImpl = globalThis.fetch,
}) {
  try {
    return await telegramApiRequest({
      botToken,
      method: "sendPhoto",
      body,
      fetchImpl,
    });
  } catch (error) {
    const photoUrl = cleanString(body?.photo);
    const shouldUploadBytes =
      /^https?:\/\//i.test(photoUrl) &&
      /failed to get HTTP URL content|wrong file identifier|bad request/i.test(String(error?.message || ""));
    if (!shouldUploadBytes) {
      throw error;
    }

    const uploadUrl = cleanString(fallbackPhotoUrl) || photoUrl;
    const photo = await fetchPhotoForTelegramUpload(uploadUrl, fetchImpl);
    const formData = new FormData();
    for (const [key, value] of Object.entries(body || {})) {
      if (key !== "photo" && value !== undefined && value !== null) {
        formData.set(key, String(value));
      }
    }
    formData.set("photo", new Blob([photo.bytes], { type: photo.mimeType }), "remix-camera.jpg");
    return telegramMultipartRequest({
      botToken,
      method: "sendPhoto",
      formData,
      fetchImpl,
    });
  }
}

export async function sendTelegramText({
  botToken,
  chatId,
  text,
  fetchImpl = globalThis.fetch,
}) {
  return telegramApiRequest({
    botToken,
    method: "sendMessage",
    body: {
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
    },
    fetchImpl,
  });
}

export async function sendTelegramRemixResult({
  botToken,
  chatId,
  result,
  fetchImpl = globalThis.fetch,
}) {
  const messages = telegramMessagesForResult(result, { chatId });
  if (!botToken || !chatId) {
    return messages;
  }
  const sent = [];
  for (const message of messages) {
    if (message.method === "sendPhoto") {
      sent.push(await sendTelegramPhoto({
        botToken,
        body: message.body,
        fallbackPhotoUrl: message.fallbackPhotoUrl,
        fetchImpl,
      }));
    } else {
      sent.push(await telegramApiRequest({
        botToken,
        method: message.method,
        body: message.body,
        fetchImpl,
      }));
    }
  }
  return sent;
}

export function createRemixTelegramTool(options = {}) {
  const handleUpdateDetailed = async (update, overrides = {}) => {
    const merged = { ...options, ...overrides };
    if (!verifyTelegramSecret({
      expectedSecret: merged.expectedSecret || merged.secretToken,
      receivedSecret: merged.receivedSecret,
    })) {
      const message = extractTelegramMessage(update);
      return {
        handled: false,
        reason: "invalid-secret",
        chatId: extractTelegramChatId(update),
        messageId: message?.message_id,
        text: extractTelegramText(update),
        parsed: null,
        result: null,
        responseMessages: [],
        sentMessages: [],
      };
    }

    const text = extractTelegramText(update);
    const parsed = parseTelegramCommand(text);
    if (!parsed) {
      const message = extractTelegramMessage(update);
      return {
        handled: false,
        reason: "unknown-command",
        chatId: extractTelegramChatId(update),
        messageId: message?.message_id,
        text,
        parsed: null,
        result: null,
        responseMessages: [],
        sentMessages: [],
      };
    }

    const chatId = extractTelegramChatId(update) ?? merged.chatId;
    const result = await runTelegramRemixCommand(parsed, merged);
    const responseMessages = telegramMessagesForResult(result, { ...merged, chatId });
    const sentMessages =
      merged.autoSend === false || !merged.botToken || !chatId
        ? []
        : await sendTelegramRemixResult({ ...merged, chatId, result });

    return {
      handled: true,
      chatId,
      messageId: extractTelegramMessage(update)?.message_id,
      userId: extractTelegramMessage(update)?.from?.id || update?.callback_query?.from?.id || null,
      text,
      parsed,
      result,
      responseMessages,
      sentMessages,
    };
  };

  return {
    helpText: () => telegramHelpText(options.characterName),
    nonImageText: () => telegramNonImageText(options.characterName),
    progressText: (parsed) => telegramProgressText(options.characterName, parsed),
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
