import crypto from "node:crypto";
import {
  callBridgeCommand,
  commandHelpLines,
  defaultInputForHost,
  imageUrlsFromBridgePayload,
  summarizeBridgePayload,
} from "../shared/bridge-client.mjs";

const DEFAULT_VIBER_API_BASE_URL = "https://chatapi.viber.com/pa";

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

function hasViberImageExtension(url) {
  try {
    const parsed = new URL(url);
    return /\.(jpe?g|png|gif)$/i.test(parsed.pathname);
  } catch {
    return false;
  }
}

function publicViberImageUrlsFromResult(result) {
  const payloadResults = Array.isArray(result?.payload?.results) ? result.payload.results : [];
  const urls = payloadResults
    .map((item) => item?.productionImageUrl || item?.imageUrl)
    .concat(result?.imageUrls || [])
    .filter((url, index, list) => typeof url === "string" && list.indexOf(url) === index)
    .filter((url) => isPublicHttpsUrl(url) && hasViberImageExtension(url));
  return urls;
}

export function viberHelpText(characterName = "Lily") {
  return [
    `${characterName} can send Remix.Camera companion images in Viber.`,
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
    "Viber picture messages require public HTTPS image URLs ending in .jpg, .jpeg, .png, or .gif.",
    "",
    "Bridge tools:",
    ...commandHelpLines().map((line) => `- ${line}`),
  ].join("\n");
}

export function parseViberCommand(text) {
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

export function isRemixViberCommand(text) {
  return parseViberCommand(text) !== null;
}

export function shouldHandleViberMessage(message) {
  const text = typeof message?.text === "string" ? message.text : message?.message?.text;
  return isRemixViberCommand(text || "");
}

export function shouldHandleViberWebhook(webhookPayload) {
  return extractViberTextMessages(webhookPayload).some((message) => shouldHandleViberMessage(message));
}

export function buildBridgeInputFromViber(parsed, options = {}) {
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

export async function runViberRemixCommand(parsed, options = {}) {
  if (!parsed || parsed.type === "help") {
    return {
      type: "help",
      text: viberHelpText(options.characterName),
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

  const input = buildBridgeInputFromViber(parsed, options);
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

export function verifyViberSignature({ authToken, signature, body }) {
  if (!authToken || !signature || body === undefined || body === null) {
    return false;
  }
  const receivedSignature = String(signature).trim();
  if (!/^[a-f0-9]{64}$/i.test(receivedSignature)) {
    return false;
  }
  const bodyBuffer = Buffer.isBuffer(body) ? body : Buffer.from(String(body), "utf8");
  const expected = crypto.createHmac("sha256", authToken).update(bodyBuffer).digest("hex");
  const received = Buffer.from(receivedSignature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return received.length === expectedBuffer.length && crypto.timingSafeEqual(received, expectedBuffer);
}

async function viberJsonRequest({
  authToken,
  viberApiBaseUrl = DEFAULT_VIBER_API_BASE_URL,
  path,
  body,
  fetchImpl = globalThis.fetch,
}) {
  const response = await fetchImpl(`${trimSlash(viberApiBaseUrl)}${path}`, {
    method: "POST",
    headers: {
      "X-Viber-Auth-Token": authToken,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || (payload?.status !== undefined && payload.status !== 0)) {
    throw new Error(payload?.status_message || payload?.message || `Viber ${path} failed with ${response.status}`);
  }
  return payload;
}

export async function sendViberText({
  authToken,
  receiver,
  text,
  sender = {},
  viberApiBaseUrl = DEFAULT_VIBER_API_BASE_URL,
  fetchImpl = globalThis.fetch,
}) {
  return viberJsonRequest({
    authToken,
    viberApiBaseUrl,
    fetchImpl,
    path: "/send_message",
    body: {
      receiver,
      type: "text",
      sender,
      text: String(text || "").slice(0, 7000),
    },
  });
}

export async function sendViberPicture({
  authToken,
  receiver,
  imageUrl,
  text = "Remix.Camera",
  sender = {},
  viberApiBaseUrl = DEFAULT_VIBER_API_BASE_URL,
  fetchImpl = globalThis.fetch,
}) {
  if (!isPublicHttpsUrl(imageUrl) || !hasViberImageExtension(imageUrl)) {
    throw new Error("Viber picture messages require a public HTTPS URL ending in .jpg, .jpeg, .png, or .gif.");
  }
  return viberJsonRequest({
    authToken,
    viberApiBaseUrl,
    fetchImpl,
    path: "/send_message",
    body: {
      receiver,
      type: "picture",
      sender,
      text: String(text || "Remix.Camera").slice(0, 768),
      media: imageUrl,
      thumbnail: imageUrl,
    },
  });
}

export function viberMessagesForResult(result, options = {}) {
  if (result?.type === "help" || result?.type === "text" || !result?.imageUrls?.length) {
    return [{ type: "text", text: result?.text || viberHelpText(options.characterName) }];
  }

  const publicUrls = publicViberImageUrlsFromResult(result);
  if (!publicUrls.length) {
    return [
      {
        type: "text",
        text: "Remix.Camera generated an image, but Viber picture messages require a public HTTPS image URL ending in .jpg, .jpeg, .png, or .gif. Return productionImageUrl or proxy the file through a stable image URL before sending.",
      },
    ];
  }

  const messages = publicUrls.map((url, index) => ({
    type: "picture",
    text: index === 0 ? "Remix.Camera" : "",
    media: url,
    thumbnail: url,
  }));
  if (result?.deleteAfterSeconds > 0) {
    messages.push({
      type: "text",
      text: "Private snap sent. Viber bots cannot force-delete delivered media; use private chat retention controls for sensitive media.",
    });
  }
  return messages;
}

export async function sendViberRemixResult({
  authToken,
  receiver,
  result,
  sender = {},
  viberApiBaseUrl = DEFAULT_VIBER_API_BASE_URL,
  fetchImpl = globalThis.fetch,
}) {
  const messages = viberMessagesForResult(result);
  const sent = [];
  for (const message of messages) {
    if (message.type === "picture") {
      sent.push(
        await sendViberPicture({
          authToken,
          receiver,
          imageUrl: message.media,
          text: message.text,
          sender,
          viberApiBaseUrl,
          fetchImpl,
        }),
      );
    } else {
      sent.push(
        await sendViberText({
          authToken,
          receiver,
          text: message.text,
          sender,
          viberApiBaseUrl,
          fetchImpl,
        }),
      );
    }
  }
  return sent;
}

export function extractViberTextMessages(webhookPayload) {
  if (webhookPayload?.event !== "message") {
    return [];
  }
  const text = webhookPayload?.message?.type === "text" ? webhookPayload.message.text : "";
  const senderId = webhookPayload?.sender?.id;
  if (typeof text !== "string" || !senderId) {
    return [];
  }
  return [
    {
      senderId,
      sender: webhookPayload.sender || {},
      text,
      messageToken: webhookPayload.message_token || "",
      timestamp: webhookPayload.timestamp || null,
    },
  ];
}

export function createRemixViberTool(options = {}) {
  const handleTextMessageDetailed = async (message, overrides = {}) => {
    const text = typeof message?.text === "string" ? message.text : message?.message?.text || "";
    const parsed = parseViberCommand(text);
    if (!parsed) {
      return {
        handled: false,
        reason: "unknown-command",
        senderId: message?.senderId || message?.sender?.id,
        text,
        messageToken: message?.messageToken,
        parsed: null,
        result: null,
        sentMessages: [],
      };
    }

    const merged = { ...options, ...overrides };
    const receiver = message?.senderId || message?.sender?.id || merged.receiver;
    const result = await runViberRemixCommand(parsed, merged);
    const sentMessages =
      merged.autoSend === false || !merged.authToken || !receiver
        ? []
        : await sendViberRemixResult({
            ...merged,
            receiver,
            result,
          });

    return {
      handled: true,
      senderId: receiver,
      text,
      messageToken: message?.messageToken,
      parsed,
      result,
      sentMessages,
    };
  };

  const handleWebhookDetailed = async (webhookPayload, overrides = {}) => {
    const messages = extractViberTextMessages(webhookPayload);
    const results = [];
    for (const message of messages) {
      results.push(await handleTextMessageDetailed(message, overrides));
    }
    return results;
  };

  return {
    helpText: () => viberHelpText(options.characterName),
    parseCommand: parseViberCommand,
    isCommand: isRemixViberCommand,
    shouldHandleMessage: shouldHandleViberMessage,
    shouldHandleWebhook: shouldHandleViberWebhook,
    buildInput: (parsed) => buildBridgeInputFromViber(parsed, options),
    run: (parsed, overrides = {}) => runViberRemixCommand(parsed, { ...options, ...overrides }),
    send: (result, sendOptions = {}) => sendViberRemixResult({ ...options, ...sendOptions, result }),
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
