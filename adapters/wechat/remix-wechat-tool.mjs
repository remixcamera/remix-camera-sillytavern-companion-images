import crypto from "node:crypto";
import {
  callBridgeCommand,
  commandHelpLines,
  defaultInputForHost,
  imageUrlsFromBridgePayload,
  summarizeBridgePayload,
} from "../shared/bridge-client.mjs";

const DEFAULT_WECHAT_API_BASE_URL = "https://api.weixin.qq.com";

const COMMANDS = new Map([
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

function trimSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function normalizeCommand(value) {
  return String(value || "")
    .replace(/^\//, "")
    .replace(/^!/, "")
    .toLowerCase();
}

function firstUrl(text) {
  return String(text || "").match(/https?:\/\/\S+/i)?.[0] || "";
}

function withoutFirstUrl(text) {
  const url = firstUrl(text);
  return url ? String(text || "").replace(url, "").trim() : String(text || "").trim();
}

function xmlTag(xml, tagName) {
  const pattern = new RegExp(`<${tagName}>(?:<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>|([\\s\\S]*?))<\\/${tagName}>`, "i");
  const match = String(xml || "").match(pattern);
  return match ? (match[1] ?? match[2] ?? "").trim() : "";
}

export function parseWeChatXmlMessage(xml) {
  return {
    toUserName: xmlTag(xml, "ToUserName"),
    fromUserName: xmlTag(xml, "FromUserName"),
    createTime: xmlTag(xml, "CreateTime"),
    msgType: xmlTag(xml, "MsgType"),
    content: xmlTag(xml, "Content"),
    msgId: xmlTag(xml, "MsgId"),
  };
}

export function wechatHelpText(characterName = "Lily") {
  return [
    `${characterName} can send Remix.Camera companion images in WeChat Official Account conversations.`,
    "",
    "Send one of:",
    "selfie cafe mirror selfie",
    "date quiet restaurant booth",
    "daily morning coffee on the couch",
    "outfit https://example.com/outfit.jpg red sundress",
    "couple yes coffee shop booth with me",
    "vacation yes Amalfi coast weekend",
    "snap yes warm bedroom mirror snap",
    "preview selfie cozy couch with lamp light",
    "",
    "Couple and private commands require the word yes before spending credits. Preview never spends credits.",
    "WeChat image replies upload the generated image to temporary media, then send an image customer-service message.",
    "",
    "Bridge tools:",
    ...commandHelpLines().map((line) => `- ${line}`),
  ].join("\n");
}

export function parseWeChatCommand(text) {
  const cleaned = String(text || "").trim();
  if (!cleaned) {
    return null;
  }
  const [rawCommand, ...restParts] = cleaned.split(/\s+/);
  const commandName = normalizeCommand(rawCommand);
  const rest = restParts.join(" ").trim();

  if (commandName === "help" || commandName === "start") {
    return { type: "help" };
  }

  if (commandName === "preview") {
    const [requested, ...previewParts] = rest.split(/\s+/);
    const command = COMMANDS.get(normalizeCommand(requested)) || "send-selfie";
    return {
      type: "image",
      action: "dry-run",
      command,
      text: previewParts.join(" ").trim(),
    };
  }

  const command = COMMANDS.get(commandName);
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

export function isRemixWeChatCommand(text) {
  return parseWeChatCommand(text) !== null;
}

export function shouldHandleWeChatMessage(message) {
  const text = typeof message?.text === "string" ? message.text : message?.content;
  return isRemixWeChatCommand(text || "");
}

export function shouldHandleWeChatWebhook(webhookBody) {
  return extractWeChatTextMessages(webhookBody).some((message) => shouldHandleWeChatMessage(message));
}

export function buildBridgeInputFromWeChat(parsed, options = {}) {
  const text = parsed?.text || "";
  const hasYes = /\byes\b/i.test(text);
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

export async function runWeChatRemixCommand(parsed, options = {}) {
  if (!parsed || parsed.type === "help") {
    return {
      type: "help",
      text: wechatHelpText(options.characterName),
      imageUrls: [],
    };
  }

  if (parsed.action === "generate" && ["couple-photo", "couples-vacation", "private-snap"].includes(parsed.command)) {
    if (!/\byes\b/i.test(parsed.text || "")) {
      return {
        type: "text",
        text: `${parsed.command} needs explicit yes before spending credits. Send preview first, or send the command again with yes.`,
        imageUrls: [],
      };
    }
  }

  const input = buildBridgeInputFromWeChat(parsed, options);
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

export function verifyWeChatSignature({ token, signature, timestamp, nonce }) {
  if (!token || !signature || !timestamp || !nonce) {
    return false;
  }
  const expected = [token, timestamp, nonce].sort().join("");
  const digest = crypto.createHash("sha1").update(expected).digest("hex");
  const received = Buffer.from(String(signature), "hex");
  const expectedBuffer = Buffer.from(digest, "hex");
  return received.length === expectedBuffer.length && crypto.timingSafeEqual(received, expectedBuffer);
}

async function wechatJsonRequest({
  accessToken,
  wechatApiBaseUrl = DEFAULT_WECHAT_API_BASE_URL,
  path,
  query = {},
  body,
  fetchImpl = globalThis.fetch,
}) {
  const url = new URL(`${trimSlash(wechatApiBaseUrl)}${path}`);
  url.searchParams.set("access_token", accessToken);
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== "") {
      url.searchParams.set(key, String(value));
    }
  }
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || (payload?.errcode !== undefined && payload.errcode !== 0)) {
    throw new Error(payload?.errmsg || payload?.message || `WeChat ${path} failed with ${response.status}`);
  }
  return payload;
}

async function uploadWeChatImageMedia({
  accessToken,
  imageUrl,
  wechatApiBaseUrl = DEFAULT_WECHAT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
}) {
  const imageResponse = await fetchImpl(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch bridge image for WeChat upload: ${imageResponse.status}`);
  }
  const mimeType = imageResponse.headers.get("content-type") || "image/jpeg";
  const form = new FormData();
  form.set("media", new Blob([await imageResponse.arrayBuffer()], { type: mimeType }), "remix-camera.jpg");
  const url = new URL(`${trimSlash(wechatApiBaseUrl)}/cgi-bin/media/upload`);
  url.searchParams.set("access_token", accessToken);
  url.searchParams.set("type", "image");
  const response = await fetchImpl(url, {
    method: "POST",
    body: form,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.errcode || !payload?.media_id) {
    throw new Error(payload?.errmsg || payload?.message || `WeChat media upload failed with ${response.status}`);
  }
  return payload.media_id;
}

export async function sendWeChatText({
  accessToken,
  toUser,
  text,
  wechatApiBaseUrl = DEFAULT_WECHAT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
}) {
  return wechatJsonRequest({
    accessToken,
    wechatApiBaseUrl,
    fetchImpl,
    path: "/cgi-bin/message/custom/send",
    body: {
      touser: toUser,
      msgtype: "text",
      text: {
        content: String(text || "").slice(0, 2000),
      },
    },
  });
}

export async function sendWeChatImage({
  accessToken,
  toUser,
  imageUrl,
  wechatApiBaseUrl = DEFAULT_WECHAT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
}) {
  const mediaId = await uploadWeChatImageMedia({
    accessToken,
    imageUrl,
    wechatApiBaseUrl,
    fetchImpl,
  });
  return wechatJsonRequest({
    accessToken,
    wechatApiBaseUrl,
    fetchImpl,
    path: "/cgi-bin/message/custom/send",
    body: {
      touser: toUser,
      msgtype: "image",
      image: {
        media_id: mediaId,
      },
    },
  });
}

export function wechatMessagesForResult(result, options = {}) {
  if (result?.type === "help" || result?.type === "text" || !result?.imageUrls?.length) {
    return [{ type: "text", text: result?.text || wechatHelpText(options.characterName) }];
  }
  const messages = result.imageUrls.map((imageUrl) => ({
    type: "image",
    imageUrl,
  }));
  if (result?.deleteAfterSeconds > 0) {
    messages.push({
      type: "text",
      text: "Private snap sent. WeChat Official Account messages cannot be force-deleted by the bot; use chat retention controls for sensitive media.",
    });
  }
  return messages;
}

export async function sendWeChatRemixResult({
  accessToken,
  toUser,
  result,
  wechatApiBaseUrl = DEFAULT_WECHAT_API_BASE_URL,
  fetchImpl = globalThis.fetch,
}) {
  const messages = wechatMessagesForResult(result);
  const sent = [];
  for (const message of messages) {
    if (message.type === "image") {
      sent.push(
        await sendWeChatImage({
          accessToken,
          toUser,
          imageUrl: message.imageUrl,
          wechatApiBaseUrl,
          fetchImpl,
        }),
      );
    } else {
      sent.push(
        await sendWeChatText({
          accessToken,
          toUser,
          text: message.text,
          wechatApiBaseUrl,
          fetchImpl,
        }),
      );
    }
  }
  return sent;
}

export function extractWeChatTextMessages(webhookBody) {
  const payload =
    typeof webhookBody === "string" || Buffer.isBuffer(webhookBody)
      ? parseWeChatXmlMessage(String(webhookBody))
      : {
          fromUserName: webhookBody?.fromUserName || webhookBody?.FromUserName,
          toUserName: webhookBody?.toUserName || webhookBody?.ToUserName,
          msgType: webhookBody?.msgType || webhookBody?.MsgType,
          content: webhookBody?.content || webhookBody?.Content,
          msgId: webhookBody?.msgId || webhookBody?.MsgId,
          createTime: webhookBody?.createTime || webhookBody?.CreateTime,
        };
  if (String(payload.msgType || "").toLowerCase() !== "text" || !payload.fromUserName || typeof payload.content !== "string") {
    return [];
  }
  return [
    {
      fromUserName: payload.fromUserName,
      toUserName: payload.toUserName || "",
      text: payload.content,
      content: payload.content,
      msgId: payload.msgId || "",
      createTime: payload.createTime || "",
    },
  ];
}

export function createRemixWeChatTool(options = {}) {
  const handleTextMessageDetailed = async (message, overrides = {}) => {
    const text = typeof message?.text === "string" ? message.text : message?.content || "";
    const parsed = parseWeChatCommand(text);
    if (!parsed) {
      return {
        handled: false,
        reason: "unknown-command",
        fromUserName: message?.fromUserName,
        text,
        parsed: null,
        result: null,
        sentMessages: [],
      };
    }

    const merged = { ...options, ...overrides };
    const toUser = message?.fromUserName || merged.toUser;
    const result = await runWeChatRemixCommand(parsed, merged);
    const sentMessages =
      merged.autoSend === false || !merged.accessToken || !toUser
        ? []
        : await sendWeChatRemixResult({
            ...merged,
            toUser,
            result,
          });

    return {
      handled: true,
      fromUserName: message?.fromUserName,
      toUser,
      text,
      parsed,
      result,
      sentMessages,
    };
  };

  const handleWebhookDetailed = async (webhookBody, overrides = {}) => {
    const messages = extractWeChatTextMessages(webhookBody);
    const results = [];
    for (const message of messages) {
      results.push(await handleTextMessageDetailed(message, overrides));
    }
    return results;
  };

  return {
    helpText: () => wechatHelpText(options.characterName),
    parseCommand: parseWeChatCommand,
    isCommand: isRemixWeChatCommand,
    shouldHandleMessage: shouldHandleWeChatMessage,
    shouldHandleWebhook: shouldHandleWeChatWebhook,
    buildInput: (parsed) => buildBridgeInputFromWeChat(parsed, options),
    run: (parsed, overrides = {}) => runWeChatRemixCommand(parsed, { ...options, ...overrides }),
    send: (result, sendOptions = {}) => sendWeChatRemixResult({ ...options, ...sendOptions, result }),
    handleTextMessageDetailed,
    async handleTextMessage(message, overrides = {}) {
      const details = await handleTextMessageDetailed(message, overrides);
      return details.handled ? details.result : null;
    },
    handleWebhookDetailed,
    async handleWebhook(webhookBody, overrides = {}) {
      const details = await handleWebhookDetailed(webhookBody, overrides);
      return details.filter((item) => item.handled).map((item) => item.result);
    },
  };
}
