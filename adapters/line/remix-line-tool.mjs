import crypto from "node:crypto";
import {
  callBridgeCommand,
  commandHelpLines,
  defaultInputForHost,
  imageUrlsFromBridgePayload,
  summarizeBridgePayload,
} from "../shared/bridge-client.mjs";

const DEFAULT_LINE_API_BASE_URL = "https://api.line.me";

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

export function lineHelpText(characterName = "Lily") {
  return [
    `${characterName} can send Remix.Camera companion images in LINE.`,
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
    "",
    "Bridge tools:",
    ...commandHelpLines().map((line) => `- ${line}`),
  ].join("\n");
}

export function parseLineCommand(text) {
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

export function buildBridgeInputFromLine(parsed, options = {}) {
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

export async function runLineRemixCommand(parsed, options = {}) {
  if (!parsed || parsed.type === "help") {
    return {
      type: "help",
      text: lineHelpText(options.characterName),
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

  const input = buildBridgeInputFromLine(parsed, options);
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

export function verifyLineSignature({ channelSecret, signature, body }) {
  if (!channelSecret || !signature || body === undefined || body === null) {
    return false;
  }
  const bodyBuffer = Buffer.isBuffer(body) ? body : Buffer.from(String(body), "utf8");
  const expected = crypto.createHmac("sha256", channelSecret).update(bodyBuffer).digest("base64");
  const received = Buffer.from(String(signature), "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return received.length === expectedBuffer.length && crypto.timingSafeEqual(received, expectedBuffer);
}

async function lineJsonRequest({
  channelAccessToken,
  lineApiBaseUrl = DEFAULT_LINE_API_BASE_URL,
  path,
  body,
  fetchImpl = globalThis.fetch,
}) {
  const response = await fetchImpl(`${trimSlash(lineApiBaseUrl)}${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${channelAccessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.message) {
    throw new Error(payload?.message || `LINE ${path} failed with ${response.status}`);
  }
  return payload;
}

export function lineMessagesForResult(result, options = {}) {
  if (result?.type === "help" || result?.type === "text" || !result?.imageUrls?.length) {
    return [{ type: "text", text: result?.text || lineHelpText(options.characterName) }];
  }
  const publicUrls = publicImageUrlsFromResult(result);
  if (!publicUrls.length) {
    return [
      {
        type: "text",
        text: "Remix.Camera generated a local bridge image, but LINE image messages require a public HTTPS image URL. Use the productionImageUrl returned by the bridge or expose the image through a private HTTPS file proxy.",
      },
    ];
  }
  const messages = publicUrls.map((url) => ({
    type: "image",
    originalContentUrl: url,
    previewImageUrl: url,
  }));
  if (result?.deleteAfterSeconds > 0) {
    messages.push({
      type: "text",
      text: "Private snap sent. LINE does not let bots force-delete delivered media; use chat deletion/retention controls for sensitive media.",
    });
  }
  return messages;
}

export async function replyLineMessages({
  channelAccessToken,
  replyToken,
  messages,
  lineApiBaseUrl = DEFAULT_LINE_API_BASE_URL,
  fetchImpl = globalThis.fetch,
}) {
  return lineJsonRequest({
    channelAccessToken,
    lineApiBaseUrl,
    fetchImpl,
    path: "/v2/bot/message/reply",
    body: { replyToken, messages: messages.slice(0, 5) },
  });
}

export async function pushLineMessages({
  channelAccessToken,
  to,
  messages,
  lineApiBaseUrl = DEFAULT_LINE_API_BASE_URL,
  fetchImpl = globalThis.fetch,
}) {
  return lineJsonRequest({
    channelAccessToken,
    lineApiBaseUrl,
    fetchImpl,
    path: "/v2/bot/message/push",
    body: { to, messages: messages.slice(0, 5) },
  });
}

export async function sendLineRemixResult({
  channelAccessToken,
  replyToken,
  to,
  result,
  lineApiBaseUrl = DEFAULT_LINE_API_BASE_URL,
  fetchImpl = globalThis.fetch,
}) {
  const messages = lineMessagesForResult(result);
  if (replyToken) {
    return replyLineMessages({ channelAccessToken, replyToken, messages, lineApiBaseUrl, fetchImpl });
  }
  if (to) {
    return pushLineMessages({ channelAccessToken, to, messages, lineApiBaseUrl, fetchImpl });
  }
  return { ok: true, messages };
}

export function extractLineTextEvents(webhookPayload) {
  const events = Array.isArray(webhookPayload?.events) ? webhookPayload.events : [];
  return events
    .filter((event) => event?.type === "message" && event?.message?.type === "text" && typeof event.message.text === "string")
    .map((event) => ({
      replyToken: event.replyToken || "",
      text: event.message.text,
      source: event.source || {},
      webhookEventId: event.webhookEventId || "",
    }));
}

export function createRemixLineTool(options = {}) {
  return {
    helpText: () => lineHelpText(options.characterName),
    parseCommand: parseLineCommand,
    buildInput: (parsed) => buildBridgeInputFromLine(parsed, options),
    run: (parsed, overrides = {}) => runLineRemixCommand(parsed, { ...options, ...overrides }),
    send: (result, sendOptions = {}) => sendLineRemixResult({ ...options, ...sendOptions, result }),
    async handleTextEvent(event, overrides = {}) {
      const parsed = parseLineCommand(event?.text || "");
      const result = await runLineRemixCommand(parsed, { ...options, ...overrides });
      await sendLineRemixResult({
        ...options,
        ...overrides,
        replyToken: event?.replyToken,
        result,
      });
      return result;
    },
    async handleWebhook(webhookPayload, overrides = {}) {
      const events = extractLineTextEvents(webhookPayload);
      const results = [];
      for (const event of events) {
        results.push(await this.handleTextEvent(event, overrides));
      }
      return results;
    },
  };
}
