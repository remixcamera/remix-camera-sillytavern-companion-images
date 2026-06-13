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

export function mattermostHelpText(characterName = "Lily") {
  return [
    `${characterName} can send Remix.Camera companion images in Mattermost.`,
    "",
    "Use a slash command or outgoing webhook trigger with:",
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
    "Mattermost image attachments use public Remix.Camera productionImageUrl values; local 127.0.0.1 bridge URLs are never posted as broken images.",
    "",
    "Bridge tools:",
    ...commandHelpLines().map((line) => `- ${line}`),
  ].join("\n");
}

export function parseMattermostCommand(text) {
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

export function isRemixMattermostCommand(text) {
  return parseMattermostCommand(text) !== null;
}

export function shouldHandleMattermostSlashCommand(payload) {
  return isRemixMattermostCommand(payload?.text || "");
}

export function extractMattermostText(payload) {
  return String(payload?.text || payload?.message?.text || payload?.post?.message || "").trim();
}

export function shouldHandleMattermostWebhook(payload) {
  return isRemixMattermostCommand(extractMattermostText(payload));
}

export function verifyMattermostToken({ expectedToken, receivedToken }) {
  if (!expectedToken) {
    return true;
  }
  return timingSafeStringEqual(expectedToken, receivedToken);
}

export function buildBridgeInputFromMattermost(parsed, options = {}) {
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

export async function runMattermostRemixCommand(parsed, options = {}) {
  if (!parsed || parsed.type === "help") {
    return {
      type: "help",
      text: mattermostHelpText(options.characterName),
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

  const input = buildBridgeInputFromMattermost(parsed, options);
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

export function mattermostPayloadForResult(result, options = {}) {
  const publicImageUrls = publicImageUrlsFromResult(result);
  const imageUrls = Array.isArray(result?.imageUrls) ? result.imageUrls : [];
  const hasLocalOnlyImages = imageUrls.length > 0 && publicImageUrls.length === 0;
  const text = hasLocalOnlyImages
    ? "Remix.Camera generated a local bridge image, but Mattermost cannot fetch 127.0.0.1 URLs. Use productionImageUrl delivery or an incoming webhook from a public bridge."
    : publicImageUrls.length
      ? "Remix.Camera image ready."
      : result?.text || mattermostHelpText(options.characterName);
  return defaultInputForHost({
    response_type: options.responseType || "ephemeral",
    username: options.username,
    icon_url: options.iconUrl,
    text,
    attachments: publicImageUrls.map((imageUrl, index) => ({
      fallback: `Remix.Camera image ${index + 1}: ${imageUrl}`,
      title: `Remix.Camera image ${index + 1}`,
      title_link: imageUrl,
      image_url: imageUrl,
      color: "#D1FE17",
      text: index === 0 && result?.deleteAfterSeconds > 0 ? "Private snap. Mattermost cannot guarantee client-side disappearance after delivery." : undefined,
    })),
  });
}

export async function sendMattermostWebhook({ webhookUrl, payload, fetchImpl = globalThis.fetch }) {
  if (!webhookUrl) {
    throw new Error("Mattermost webhook URL is required.");
  }
  const response = await fetchImpl(webhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const text = await response.text().catch(() => "");
  if (!response.ok) {
    throw new Error(text || `Mattermost webhook failed with ${response.status}`);
  }
  return text ? { ok: true, text } : { ok: true };
}

export async function sendMattermostText({ webhookUrl, text, fetchImpl = globalThis.fetch }) {
  return sendMattermostWebhook({
    webhookUrl,
    payload: { text },
    fetchImpl,
  });
}

export async function sendMattermostRemixResult({ webhookUrl, result, fetchImpl = globalThis.fetch }) {
  const payload = mattermostPayloadForResult(result, { responseType: "in_channel" });
  if (!webhookUrl) {
    return [payload];
  }
  return [await sendMattermostWebhook({ webhookUrl, payload, fetchImpl })];
}

export function createRemixMattermostTool(options = {}) {
  const handlePayloadDetailed = async (payload, overrides = {}) => {
    const merged = { ...options, ...overrides };
    const receivedToken = payload?.token;
    if (!verifyMattermostToken({ expectedToken: merged.expectedToken || merged.token, receivedToken })) {
      return {
        handled: false,
        reason: "invalid-token",
        text: extractMattermostText(payload),
        parsed: null,
        result: null,
        responsePayload: null,
        sentMessages: [],
      };
    }

    const text = extractMattermostText(payload);
    const parsed = parseMattermostCommand(text);
    if (!parsed) {
      return {
        handled: false,
        reason: "unknown-command",
        text,
        parsed: null,
        result: null,
        responsePayload: null,
        sentMessages: [],
      };
    }

    const result = await runMattermostRemixCommand(parsed, merged);
    const responsePayload = mattermostPayloadForResult(result, merged);
    const sentMessages =
      merged.autoSend === false || !merged.webhookUrl
        ? []
        : await sendMattermostRemixResult({ ...merged, result });

    return {
      handled: true,
      teamId: payload?.team_id,
      channelId: payload?.channel_id,
      userId: payload?.user_id,
      text,
      parsed,
      result,
      responsePayload,
      sentMessages,
    };
  };

  return {
    helpText: () => mattermostHelpText(options.characterName),
    parseCommand: parseMattermostCommand,
    isCommand: isRemixMattermostCommand,
    shouldHandleSlashCommand: shouldHandleMattermostSlashCommand,
    shouldHandleWebhook: shouldHandleMattermostWebhook,
    buildInput: (parsed) => buildBridgeInputFromMattermost(parsed, options),
    run: (parsed, overrides = {}) => runMattermostRemixCommand(parsed, { ...options, ...overrides }),
    send: (result, sendOptions = {}) => sendMattermostRemixResult({ ...options, ...sendOptions, result }),
    handlePayloadDetailed,
    handleSlashCommandDetailed: handlePayloadDetailed,
    handleWebhookDetailed: handlePayloadDetailed,
    async handleSlashCommand(payload, overrides = {}) {
      const details = await handlePayloadDetailed(payload, overrides);
      return details.handled ? details.responsePayload : null;
    },
    async handleWebhook(payload, overrides = {}) {
      const details = await handlePayloadDetailed(payload, overrides);
      return details.handled ? details.responsePayload : null;
    },
  };
}
