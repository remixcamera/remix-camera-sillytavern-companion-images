import crypto from "node:crypto";
import {
  callBridgeCommand,
  commandHelpLines,
  defaultInputForHost,
  imageUrlsFromBridgePayload,
  summarizeBridgePayload,
} from "../shared/bridge-client.mjs";

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

function isLocalBridgeUrl(imageUrl) {
  return /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])[:/]/i.test(String(imageUrl || ""));
}

function isPublicHttpsUrl(imageUrl) {
  return /^https:\/\//i.test(String(imageUrl || "")) && !isLocalBridgeUrl(imageUrl);
}

function timingSafeStringEqual(expected, received) {
  const expectedBuffer = Buffer.from(String(expected || ""), "utf8");
  const receivedBuffer = Buffer.from(String(received || ""), "utf8");
  return expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function rocketChatHelpText(characterName = "Lily") {
  return [
    `${characterName} can send Remix.Camera companion images in Rocket.Chat.`,
    "",
    "Use an outgoing integration, slash command script, or existing bot server with:",
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
    "Rocket.Chat attachments use public Remix.Camera productionImageUrl values; local bridge URLs are never posted as broken images.",
    "",
    "Bridge tools:",
    ...commandHelpLines().map((line) => `- ${line}`),
  ].join("\n");
}

export function parseRocketChatCommand(text) {
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

export function isRemixRocketChatCommand(text) {
  return parseRocketChatCommand(text) !== null;
}

export function extractRocketChatText(payload) {
  return String(payload?.text || payload?.message?.msg || payload?.msg || payload?.content?.text || "").trim();
}

export function shouldHandleRocketChatWebhook(payload) {
  return isRemixRocketChatCommand(extractRocketChatText(payload));
}

export function verifyRocketChatToken({ expectedToken, receivedToken }) {
  if (!expectedToken) {
    return true;
  }
  return timingSafeStringEqual(expectedToken, receivedToken);
}

export function buildBridgeInputFromRocketChat(parsed, options = {}) {
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

export async function runRocketChatRemixCommand(parsed, options = {}) {
  if (!parsed || parsed.type === "help") {
    return {
      type: "help",
      text: rocketChatHelpText(options.characterName),
      imageUrls: [],
    };
  }

  if (parsed.action === "generate" && ["couple-photo", "couples-vacation", "private-snap"].includes(parsed.command)) {
    if (!/\byes\b/i.test(parsed.text || "")) {
      return {
        type: "text",
        text: `${parsed.command} needs explicit yes before spending credits. Use preview first, or send the command again with yes.`,
        imageUrls: [],
      };
    }
  }

  const input = buildBridgeInputFromRocketChat(parsed, options);
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

function publicImageUrlsFromResult(result) {
  const payloadResults = Array.isArray(result?.payload?.results) ? result.payload.results : [];
  return payloadResults
    .map((item) => item?.productionImageUrl || item?.imageUrl)
    .concat(result?.imageUrls || [])
    .filter((url, index, list) => typeof url === "string" && list.indexOf(url) === index)
    .filter(isPublicHttpsUrl);
}

export function rocketChatMessageForResult(result, options = {}) {
  const publicImageUrls = publicImageUrlsFromResult(result);
  const imageUrls = Array.isArray(result?.imageUrls) ? result.imageUrls : [];
  const hasLocalOnlyImages = imageUrls.length > 0 && publicImageUrls.length === 0;
  const text = hasLocalOnlyImages
    ? "Remix.Camera generated a local bridge image, but Rocket.Chat cannot fetch 127.0.0.1 URLs. Use productionImageUrl delivery or a public bridge."
    : publicImageUrls.length
      ? "Remix.Camera image ready."
      : result?.text || rocketChatHelpText(options.characterName);
  const target = options.roomId ? { roomId: options.roomId } : { channel: options.channel };
  return defaultInputForHost({
    ...target,
    alias: options.alias,
    avatar: options.avatar,
    emoji: options.emoji,
    text,
    parseUrls: false,
    attachments: publicImageUrls.map((imageUrl, index) => ({
      fallback: `Remix.Camera image ${index + 1}: ${imageUrl}`,
      title: `Remix.Camera image ${index + 1}`,
      title_link: imageUrl,
      title_link_download: true,
      image_url: imageUrl,
      color: "#D1FE17",
      text: index === 0 && result?.deleteAfterSeconds > 0 ? "Private snap. Rocket.Chat cannot guarantee automatic deletion after delivery." : undefined,
    })),
  });
}

async function rocketChatApiRequest({
  serverUrl,
  authToken,
  userId,
  endpoint = "/api/v1/chat.postMessage",
  body,
  fetchImpl = globalThis.fetch,
}) {
  if (!serverUrl) {
    throw new Error("Rocket.Chat server URL is required.");
  }
  if (!authToken || !userId) {
    throw new Error("Rocket.Chat X-Auth-Token and X-User-Id are required.");
  }
  const response = await fetchImpl(`${trimSlash(serverUrl)}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Auth-Token": authToken,
      "X-User-Id": userId,
    },
    body: JSON.stringify(body || {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.success === false || payload?.status === "error") {
    throw new Error(payload?.error || payload?.message || `Rocket.Chat request failed with ${response.status}`);
  }
  return payload;
}

export async function sendRocketChatText({
  serverUrl,
  authToken,
  userId,
  roomId,
  channel,
  text,
  fetchImpl = globalThis.fetch,
}) {
  const target = roomId ? { roomId } : { channel };
  if (!target.roomId && !target.channel) {
    throw new Error("Rocket.Chat roomId or channel is required.");
  }
  return rocketChatApiRequest({
    serverUrl,
    authToken,
    userId,
    body: { ...target, text, parseUrls: false },
    fetchImpl,
  });
}

export async function sendRocketChatRemixResult({
  serverUrl,
  authToken,
  userId,
  roomId,
  channel,
  result,
  fetchImpl = globalThis.fetch,
}) {
  const body = rocketChatMessageForResult(result, { roomId, channel });
  if (!body.roomId && !body.channel) {
    return [body];
  }
  return [
    await rocketChatApiRequest({
      serverUrl,
      authToken,
      userId,
      body,
      fetchImpl,
    }),
  ];
}

export function createRemixRocketChatTool(options = {}) {
  const handleWebhookDetailed = async (payload, overrides = {}) => {
    const merged = { ...options, ...overrides };
    const receivedToken = payload?.token;
    if (!verifyRocketChatToken({ expectedToken: merged.expectedToken || merged.token, receivedToken })) {
      return {
        handled: false,
        reason: "invalid-token",
        text: extractRocketChatText(payload),
        parsed: null,
        result: null,
        responseMessage: null,
        sentMessages: [],
      };
    }

    const text = extractRocketChatText(payload);
    const parsed = parseRocketChatCommand(text);
    if (!parsed) {
      return {
        handled: false,
        reason: "unknown-command",
        text,
        parsed: null,
        result: null,
        responseMessage: null,
        sentMessages: [],
      };
    }

    const roomId = payload?.channel_id || payload?.roomId || payload?.message?.rid || merged.roomId;
    const result = await runRocketChatRemixCommand(parsed, merged);
    const responseMessage = rocketChatMessageForResult(result, { ...merged, roomId });
    const sentMessages =
      merged.autoSend === false || !merged.serverUrl || !merged.authToken || !merged.userId
        ? []
        : await sendRocketChatRemixResult({ ...merged, roomId, result });

    return {
      handled: true,
      roomId,
      userId: payload?.user_id || payload?.user?._id,
      text,
      parsed,
      result,
      responseMessage,
      sentMessages,
    };
  };

  return {
    helpText: () => rocketChatHelpText(options.characterName),
    parseCommand: parseRocketChatCommand,
    isCommand: isRemixRocketChatCommand,
    shouldHandleWebhook: shouldHandleRocketChatWebhook,
    buildInput: (parsed) => buildBridgeInputFromRocketChat(parsed, options),
    run: (parsed, overrides = {}) => runRocketChatRemixCommand(parsed, { ...options, ...overrides }),
    send: (result, sendOptions = {}) => sendRocketChatRemixResult({ ...options, ...sendOptions, result }),
    handleWebhookDetailed,
    async handleWebhook(payload, overrides = {}) {
      const details = await handleWebhookDetailed(payload, overrides);
      return details.handled ? details.responseMessage : null;
    },
  };
}
