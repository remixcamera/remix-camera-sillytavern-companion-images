import { Buffer } from "node:buffer";
import { createRemixTelegramTool, telegramHelpText } from "./remix-telegram-tool.mjs";

function updateFromContext(ctx = {}) {
  if (ctx.update) {
    return ctx.update;
  }
  if (ctx.message || ctx.msg || ctx.editedMessage || ctx.edited_message) {
    return {
      message: ctx.message || ctx.msg || null,
      edited_message: ctx.editedMessage || ctx.edited_message || null,
    };
  }
  return {};
}

function attachDetails(ctx, details) {
  if (ctx && typeof ctx.state === "object" && ctx.state !== null) {
    ctx.state.remixCamera = details;
    return;
  }
  if (ctx && typeof ctx === "object") {
    ctx.remixCamera = details;
  }
}

function isLocalBridgeUrl(url) {
  return /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])[:/]/i.test(String(url || ""));
}

async function replyText(ctx, text) {
  if (typeof ctx.reply === "function") {
    return ctx.reply(text);
  }
  if (typeof ctx.replyWithHTML === "function") {
    return ctx.replyWithHTML(text);
  }
  const chatId = ctx?.chat?.id || ctx?.message?.chat?.id || ctx?.msg?.chat?.id;
  if (ctx?.api && typeof ctx.api.sendMessage === "function" && chatId) {
    return ctx.api.sendMessage(chatId, text);
  }
  return null;
}

async function photoPayloadForFramework(imageUrl, options = {}) {
  if (!isLocalBridgeUrl(imageUrl)) {
    return imageUrl;
  }

  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const response = await fetchImpl(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch local bridge image: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (typeof options.inputFileFactory === "function") {
    return options.inputFileFactory(buffer, "remix-camera.jpg");
  }
  if (options.framework === "grammy") {
    throw new Error("grammY local image upload requires inputFileFactory, for example (buffer, filename) => new InputFile(buffer, filename).");
  }
  return { source: buffer, filename: "remix-camera.jpg" };
}

async function replyPhoto(ctx, imageUrl, options = {}) {
  const photo = await photoPayloadForFramework(imageUrl, options);
  const extra = options.caption ? { caption: String(options.caption).slice(0, 1024) } : undefined;
  if (typeof ctx.replyWithPhoto === "function") {
    return ctx.replyWithPhoto(photo, extra);
  }
  const chatId = ctx?.chat?.id || ctx?.message?.chat?.id || ctx?.msg?.chat?.id;
  if (ctx?.api && typeof ctx.api.sendPhoto === "function" && chatId) {
    return ctx.api.sendPhoto(chatId, photo, extra);
  }
  throw new Error("Telegram framework context does not expose replyWithPhoto or api.sendPhoto.");
}

export async function sendRemixResultWithTelegramFramework(ctx, result, options = {}) {
  if (result?.type === "help" || result?.type === "text" || !result?.imageUrls?.length) {
    return [await replyText(ctx, result?.text || telegramHelpText(options.characterName))];
  }

  const sent = [];
  for (let index = 0; index < result.imageUrls.length; index += 1) {
    sent.push(
      await replyPhoto(ctx, result.imageUrls[index], {
        ...options,
        caption: index === 0 ? "Remix.Camera" : "",
      }),
    );
  }
  return sent;
}

function createFrameworkMiddleware({ framework, options = {} }) {
  const tool = createRemixTelegramTool(options);
  return async function remixCameraTelegramMiddleware(ctx, next) {
    const update = updateFromContext(ctx);
    if (!tool.shouldHandleUpdate(update)) {
      return typeof next === "function" ? next() : undefined;
    }

    const deliveryEnabled = options.delivery !== false && options.autoSend !== false;
    const resolvedOptions =
      typeof options.resolveOptions === "function" ? await options.resolveOptions(ctx, update) : {};
    const useBotApiSender =
      deliveryEnabled && Boolean(options.botToken || resolvedOptions.botToken) && options.delivery !== "framework";

    try {
      const details = await tool.handleUpdateDetailed(update, {
        ...resolvedOptions,
        autoSend: useBotApiSender,
      });
      attachDetails(ctx, details);

      if (deliveryEnabled && details.sentMessages.length === 0) {
        details.sentMessages = await sendRemixResultWithTelegramFramework(ctx, details.result, {
          ...options,
          ...resolvedOptions,
          framework,
        });
      }

      if (typeof options.onHandled === "function") {
        await options.onHandled(ctx, details);
      }
      return details;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const failure = {
        handled: true,
        error: message,
        result: null,
        sentMessages: [],
      };
      attachDetails(ctx, failure);
      if (options.replyOnError !== false) {
        await replyText(ctx, `${options.characterName || "Lily"} could not make that image yet: ${message}`);
      }
      if (options.throwOnError) {
        throw error;
      }
      return failure;
    }
  };
}

export function createRemixTelegramTelegrafMiddleware(options = {}) {
  return createFrameworkMiddleware({ framework: "telegraf", options });
}

export function createRemixTelegramGrammyMiddleware(options = {}) {
  return createFrameworkMiddleware({ framework: "grammy", options });
}
