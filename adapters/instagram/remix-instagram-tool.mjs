import crypto from "node:crypto";
import {
  callBridgeCommand,
  commandHelpLines,
  defaultInputForHost,
  imageUrlsFromBridgePayload,
  summarizeBridgePayload,
} from "../shared/bridge-client.mjs";

const DEFAULT_GRAPH_API_BASE_URL = "https://graph.instagram.com/v24.0";

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
  const urls = payloadResults
    .map((item) => item?.productionImageUrl || item?.imageUrl)
    .filter(isPublicHttpsUrl);
  if (urls.length) {
    return urls;
  }
  return (result?.imageUrls || []).filter(isPublicHttpsUrl);
}

export function instagramHelpText(characterName = "Lily") {
  return [
    `${characterName} can send Remix.Camera companion images in Instagram DMs.`,
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
    "Instagram DMs require public HTTPS image URLs; local bridge images need a productionImageUrl or HTTPS file proxy.",
    "",
    "Bridge tools:",
    ...commandHelpLines().map((line) => `- ${line}`),
  ].join("\n");
}

export function parseInstagramCommand(text) {
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

export function isRemixInstagramCommand(text) {
  return parseInstagramCommand(text) !== null;
}

export function shouldHandleInstagramMessage(message) {
  const text = typeof message?.text === "string" ? message.text : message?.message?.text;
  return isRemixInstagramCommand(text || "");
}

export function shouldHandleInstagramWebhook(webhookPayload) {
  return extractInstagramTextMessages(webhookPayload).some((message) => shouldHandleInstagramMessage(message));
}

export function buildBridgeInputFromInstagram(parsed, options = {}) {
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

export async function runInstagramRemixCommand(parsed, options = {}) {
  if (!parsed || parsed.type === "help") {
    return {
      type: "help",
      text: instagramHelpText(options.characterName),
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

  const input = buildBridgeInputFromInstagram(parsed, options);
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

export function verifyInstagramSignature({ appSecret, signature, body }) {
  if (!appSecret || !signature || body === undefined || body === null) {
    return false;
  }
  const receivedSignature = String(signature).replace(/^sha256=/i, "");
  if (!/^[a-f0-9]{64}$/i.test(receivedSignature)) {
    return false;
  }
  const bodyBuffer = Buffer.isBuffer(body) ? body : Buffer.from(String(body), "utf8");
  const expected = crypto.createHmac("sha256", appSecret).update(bodyBuffer).digest("hex");
  const received = Buffer.from(receivedSignature, "hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  return received.length === expectedBuffer.length && crypto.timingSafeEqual(received, expectedBuffer);
}

async function instagramJsonRequest({
  accessToken,
  igId = "me",
  graphApiBaseUrl = DEFAULT_GRAPH_API_BASE_URL,
  body,
  fetchImpl = globalThis.fetch,
}) {
  const response = await fetchImpl(`${trimSlash(graphApiBaseUrl)}/${igId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) {
    throw new Error(payload?.error?.message || payload?.message || `Instagram Send API failed with ${response.status}`);
  }
  return payload;
}

export async function sendInstagramText({
  accessToken,
  igId = "me",
  recipientId,
  text,
  graphApiBaseUrl = DEFAULT_GRAPH_API_BASE_URL,
  fetchImpl = globalThis.fetch,
}) {
  return instagramJsonRequest({
    accessToken,
    igId,
    graphApiBaseUrl,
    fetchImpl,
    body: {
      recipient: { id: recipientId },
      message: { text: String(text || "").slice(0, 1000) },
    },
  });
}

export async function sendInstagramImage({
  accessToken,
  igId = "me",
  recipientId,
  imageUrl,
  graphApiBaseUrl = DEFAULT_GRAPH_API_BASE_URL,
  fetchImpl = globalThis.fetch,
}) {
  return instagramJsonRequest({
    accessToken,
    igId,
    graphApiBaseUrl,
    fetchImpl,
    body: {
      recipient: { id: recipientId },
      message: {
        attachment: {
          type: "image",
          payload: {
            url: imageUrl,
          },
        },
      },
    },
  });
}

export async function sendInstagramRemixResult({
  accessToken,
  igId = "me",
  recipientId,
  result,
  graphApiBaseUrl = DEFAULT_GRAPH_API_BASE_URL,
  fetchImpl = globalThis.fetch,
}) {
  if (result?.type === "help" || result?.type === "text" || !result?.imageUrls?.length) {
    return [
      await sendInstagramText({
        accessToken,
        igId,
        recipientId,
        text: result?.text || instagramHelpText(),
        graphApiBaseUrl,
        fetchImpl,
      }),
    ];
  }

  const publicUrls = publicImageUrlsFromResult(result);
  if (!publicUrls.length) {
    return [
      await sendInstagramText({
        accessToken,
        igId,
        recipientId,
        text: "Remix.Camera generated a local bridge image, but Instagram DMs require a public HTTPS image URL. Use the productionImageUrl returned by the bridge or expose the image through a private HTTPS file proxy.",
        graphApiBaseUrl,
        fetchImpl,
      }),
    ];
  }

  const sent = [];
  for (const imageUrl of publicUrls) {
    sent.push(
      await sendInstagramImage({
        accessToken,
        igId,
        recipientId,
        imageUrl,
        graphApiBaseUrl,
        fetchImpl,
      }),
    );
  }
  if (result?.deleteAfterSeconds > 0) {
    sent.push(
      await sendInstagramText({
        accessToken,
        igId,
        recipientId,
        text: "Private snap sent. Instagram DMs do not let bots force-delete delivered media; use chat deletion/retention controls for sensitive media.",
        graphApiBaseUrl,
        fetchImpl,
      }),
    );
  }
  return sent;
}

export function extractInstagramTextMessages(webhookPayload) {
  const entries = Array.isArray(webhookPayload?.entry) ? webhookPayload.entry : [];
  const messages = [];
  for (const entry of entries) {
    for (const event of entry?.messaging || []) {
      const text = event?.message?.text;
      const senderId = event?.sender?.id;
      if (typeof text === "string" && senderId) {
        messages.push({
          senderId,
          recipientId: event?.recipient?.id || "",
          text,
          messageId: event?.message?.mid || "",
        });
      }
    }
    for (const change of entry?.changes || []) {
      for (const message of change?.value?.messages || []) {
        const text = message?.text?.body || message?.text;
        const senderId = message?.from || message?.sender?.id;
        if (typeof text === "string" && senderId) {
          messages.push({
            senderId,
            recipientId: change?.value?.metadata?.ig_id || entry?.id || "",
            text,
            messageId: message?.id || "",
          });
        }
      }
    }
  }
  return messages;
}

export function createRemixInstagramTool(options = {}) {
  const handleTextMessageDetailed = async (message, overrides = {}) => {
    const text = typeof message?.text === "string" ? message.text : message?.message?.text || "";
    const parsed = parseInstagramCommand(text);
    if (!parsed) {
      return {
        handled: false,
        reason: "unknown-command",
        senderId: message?.senderId || message?.sender?.id,
        recipientId: message?.recipientId || message?.recipient?.id,
        messageId: message?.messageId || message?.message?.mid,
        text,
        parsed: null,
        result: null,
        sentMessages: [],
      };
    }

    const merged = { ...options, ...overrides };
    const recipientId = message?.senderId || message?.sender?.id || merged.recipientId;
    const result = await runInstagramRemixCommand(parsed, merged);
    const sentMessages =
      merged.autoSend === false || !merged.accessToken || !recipientId
        ? []
        : await sendInstagramRemixResult({
            ...merged,
            recipientId,
            result,
          });

    return {
      handled: true,
      senderId: message?.senderId || message?.sender?.id,
      recipientId,
      messageId: message?.messageId || message?.message?.mid,
      text,
      parsed,
      result,
      sentMessages,
    };
  };

  const handleWebhookDetailed = async (webhookPayload, overrides = {}) => {
    const messages = extractInstagramTextMessages(webhookPayload);
    const results = [];
    for (const message of messages) {
      results.push(await handleTextMessageDetailed(message, overrides));
    }
    return results;
  };

  return {
    helpText: () => instagramHelpText(options.characterName),
    parseCommand: parseInstagramCommand,
    isCommand: isRemixInstagramCommand,
    shouldHandleMessage: shouldHandleInstagramMessage,
    shouldHandleWebhook: shouldHandleInstagramWebhook,
    buildInput: (parsed) => buildBridgeInputFromInstagram(parsed, options),
    run: (parsed, overrides = {}) => runInstagramRemixCommand(parsed, { ...options, ...overrides }),
    send: (result, sendOptions = {}) => sendInstagramRemixResult({ ...options, ...sendOptions, result }),
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
