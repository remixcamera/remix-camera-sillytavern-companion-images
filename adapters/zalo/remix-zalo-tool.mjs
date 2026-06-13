import crypto from "node:crypto";
import {
  callBridgeCommand,
  commandHelpLines,
  defaultInputForHost,
  imageUrlsFromBridgePayload,
  summarizeBridgePayload,
} from "../shared/bridge-client.mjs";

const DEFAULT_ZALO_API_BASE_URL = "https://openapi.zalo.me";

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

function isPublicHttpsUrl(url) {
  return /^https:\/\//i.test(String(url || "")) && !/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])[:/]/i.test(String(url || ""));
}

function publicImageUrlsFromResult(result) {
  const payloadResults = Array.isArray(result?.payload?.results) ? result.payload.results : [];
  return payloadResults
    .map((item) => item?.productionImageUrl || item?.imageUrl)
    .concat(result?.imageUrls || [])
    .filter((url, index, list) => typeof url === "string" && list.indexOf(url) === index)
    .filter(isPublicHttpsUrl);
}

export function zaloHelpText(characterName = "Lily") {
  return [
    `${characterName} can send Remix.Camera companion images from a Zalo Official Account.`,
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
    "Zalo OA image messages require public HTTPS image URLs or uploaded attachment IDs.",
    "",
    "Bridge tools:",
    ...commandHelpLines().map((line) => `- ${line}`),
  ].join("\n");
}

export function parseZaloCommand(text) {
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

export function isRemixZaloCommand(text) {
  return parseZaloCommand(text) !== null;
}

export function shouldHandleZaloMessage(message) {
  const text = typeof message?.text === "string" ? message.text : message?.message?.text;
  return isRemixZaloCommand(text || "");
}

export function shouldHandleZaloWebhook(webhookPayload) {
  return extractZaloTextMessages(webhookPayload).some((message) => shouldHandleZaloMessage(message));
}

export function buildBridgeInputFromZalo(parsed, options = {}) {
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

export async function runZaloRemixCommand(parsed, options = {}) {
  if (!parsed || parsed.type === "help") {
    return {
      type: "help",
      text: zaloHelpText(options.characterName),
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

  const input = buildBridgeInputFromZalo(parsed, options);
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

export function verifyZaloMac({ appSecret, mac, timestamp, body }) {
  if (!appSecret || !mac || body === undefined || body === null) {
    return false;
  }
  const received = String(mac).trim();
  if (!/^[a-f0-9]{64}$/i.test(received)) {
    return false;
  }
  const bodyText = Buffer.isBuffer(body) ? body.toString("utf8") : String(body);
  const expected = crypto.createHmac("sha256", appSecret).update(`${timestamp || ""}.${bodyText}`).digest("hex");
  const receivedBuffer = Buffer.from(received, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return receivedBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(receivedBuffer, expectedBuffer);
}

async function zaloJsonRequest({
  accessToken,
  zaloApiBaseUrl = DEFAULT_ZALO_API_BASE_URL,
  path,
  body,
  fetchImpl = globalThis.fetch,
}) {
  const response = await fetchImpl(`${trimSlash(zaloApiBaseUrl)}${path}`, {
    method: "POST",
    headers: {
      access_token: accessToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || (payload?.error !== undefined && Number(payload.error) !== 0)) {
    throw new Error(payload?.message || payload?.error_description || `Zalo ${path} failed with ${response.status}`);
  }
  return payload;
}

export async function sendZaloText({
  accessToken,
  userId,
  text,
  zaloApiBaseUrl = DEFAULT_ZALO_API_BASE_URL,
  fetchImpl = globalThis.fetch,
}) {
  return zaloJsonRequest({
    accessToken,
    zaloApiBaseUrl,
    fetchImpl,
    path: "/v3.0/oa/message/cs",
    body: {
      recipient: { user_id: userId },
      message: {
        text: String(text || "").slice(0, 2000),
      },
    },
  });
}

export async function sendZaloImage({
  accessToken,
  userId,
  imageUrl,
  text = "Remix.Camera",
  zaloApiBaseUrl = DEFAULT_ZALO_API_BASE_URL,
  fetchImpl = globalThis.fetch,
}) {
  if (!isPublicHttpsUrl(imageUrl)) {
    throw new Error("Zalo OA image messages require a public HTTPS image URL or an uploaded attachment ID.");
  }
  return zaloJsonRequest({
    accessToken,
    zaloApiBaseUrl,
    fetchImpl,
    path: "/v3.0/oa/message/cs",
    body: {
      recipient: { user_id: userId },
      message: {
        text: String(text || "Remix.Camera").slice(0, 2000),
        attachment: {
          type: "template",
          payload: {
            template_type: "media",
            elements: [
              {
                media_type: "image",
                url: imageUrl,
              },
            ],
          },
        },
      },
    },
  });
}

export function zaloMessagesForResult(result, options = {}) {
  if (result?.type === "help" || result?.type === "text" || !result?.imageUrls?.length) {
    return [{ type: "text", text: result?.text || zaloHelpText(options.characterName) }];
  }

  const publicUrls = publicImageUrlsFromResult(result);
  if (!publicUrls.length) {
    return [
      {
        type: "text",
        text: "Remix.Camera generated an image, but Zalo OA image messages require a public HTTPS image URL. Return productionImageUrl or proxy the file through a stable HTTPS image URL before sending.",
      },
    ];
  }

  const messages = publicUrls.map((url, index) => ({
    type: "image",
    text: index === 0 ? "Remix.Camera" : "",
    imageUrl: url,
  }));
  if (result?.deleteAfterSeconds > 0) {
    messages.push({
      type: "text",
      text: "Private snap sent. Zalo OA bots cannot force-delete delivered media; use chat retention controls for sensitive media.",
    });
  }
  return messages;
}

export async function sendZaloRemixResult({
  accessToken,
  userId,
  result,
  zaloApiBaseUrl = DEFAULT_ZALO_API_BASE_URL,
  fetchImpl = globalThis.fetch,
}) {
  const messages = zaloMessagesForResult(result);
  const sent = [];
  for (const message of messages) {
    if (message.type === "image") {
      sent.push(
        await sendZaloImage({
          accessToken,
          userId,
          imageUrl: message.imageUrl,
          text: message.text,
          zaloApiBaseUrl,
          fetchImpl,
        }),
      );
    } else {
      sent.push(
        await sendZaloText({
          accessToken,
          userId,
          text: message.text,
          zaloApiBaseUrl,
          fetchImpl,
        }),
      );
    }
  }
  return sent;
}

export function extractZaloTextMessages(webhookPayload) {
  const events = Array.isArray(webhookPayload?.events) ? webhookPayload.events : [webhookPayload];
  return events
    .map((event) => {
      const senderId = event?.sender?.id || event?.sender?.user_id || event?.user_id || event?.from?.id;
      const text =
        event?.message?.text ||
        event?.message?.content ||
        event?.text ||
        (typeof event?.message === "string" ? event.message : "");
      return {
        userId: senderId,
        text,
        eventName: event?.event_name || event?.eventName || "",
        messageId: event?.message?.msg_id || event?.message_id || event?.msg_id || "",
      };
    })
    .filter((message) => message.userId && typeof message.text === "string" && message.text);
}

export function createRemixZaloTool(options = {}) {
  const handleTextMessageDetailed = async (message, overrides = {}) => {
    const text = typeof message?.text === "string" ? message.text : message?.message?.text || "";
    const parsed = parseZaloCommand(text);
    if (!parsed) {
      return {
        handled: false,
        reason: "unknown-command",
        userId: message?.userId,
        text,
        parsed: null,
        result: null,
        sentMessages: [],
      };
    }

    const merged = { ...options, ...overrides };
    const userId = message?.userId || merged.userId;
    const result = await runZaloRemixCommand(parsed, merged);
    const sentMessages =
      merged.autoSend === false || !merged.accessToken || !userId
        ? []
        : await sendZaloRemixResult({
            ...merged,
            userId,
            result,
          });

    return {
      handled: true,
      userId,
      text,
      parsed,
      result,
      sentMessages,
    };
  };

  const handleWebhookDetailed = async (webhookPayload, overrides = {}) => {
    const messages = extractZaloTextMessages(webhookPayload);
    const results = [];
    for (const message of messages) {
      results.push(await handleTextMessageDetailed(message, overrides));
    }
    return results;
  };

  return {
    helpText: () => zaloHelpText(options.characterName),
    parseCommand: parseZaloCommand,
    isCommand: isRemixZaloCommand,
    shouldHandleMessage: shouldHandleZaloMessage,
    shouldHandleWebhook: shouldHandleZaloWebhook,
    buildInput: (parsed) => buildBridgeInputFromZalo(parsed, options),
    run: (parsed, overrides = {}) => runZaloRemixCommand(parsed, { ...options, ...overrides }),
    send: (result, sendOptions = {}) => sendZaloRemixResult({ ...options, ...sendOptions, result }),
    handleTextMessageDetailed,
    async handleTextMessage(message, overrides = {}) {
      const details = await handleTextMessageDetailed(message, overrides);
      return details.handled ? details.result : null;
    },
    handleWebhookDetailed,
    async handleWebhook(webhookPayload, overrides = {}) {
      const details = await handleWebhookDetailed(webhookPayload, overrides);
      return details.filter((item) => item.handled).map((item) => item.result);
    },
  };
}
