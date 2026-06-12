import crypto from "node:crypto";
import {
  callBridgeCommand,
  commandHelpLines,
  defaultInputForHost,
  imageUrlsFromBridgePayload,
  summarizeBridgePayload,
} from "../shared/bridge-client.mjs";

const DEFAULT_GRAPH_API_BASE_URL = "https://graph.facebook.com/v25.0";

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

export function messengerHelpText(characterName = "Lily") {
  return [
    `${characterName} can send Remix.Camera companion images in Messenger.`,
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

export function parseMessengerCommand(text) {
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

export function buildBridgeInputFromMessenger(parsed, options = {}) {
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

export async function runMessengerRemixCommand(parsed, options = {}) {
  if (!parsed || parsed.type === "help") {
    return {
      type: "help",
      text: messengerHelpText(options.characterName),
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

  const input = buildBridgeInputFromMessenger(parsed, options);
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

export function verifyMessengerSignature({ appSecret, signature, body }) {
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

async function messengerJsonRequest({
  pageAccessToken,
  graphApiBaseUrl = DEFAULT_GRAPH_API_BASE_URL,
  pageId = "me",
  body,
  fetchImpl = globalThis.fetch,
}) {
  const url = new URL(`${trimSlash(graphApiBaseUrl)}/${pageId}/messages`);
  url.searchParams.set("access_token", pageAccessToken);
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) {
    throw new Error(payload?.error?.message || payload?.message || `Messenger Send API failed with ${response.status}`);
  }
  return payload;
}

export async function sendMessengerText({
  pageAccessToken,
  recipientId,
  text,
  graphApiBaseUrl = DEFAULT_GRAPH_API_BASE_URL,
  pageId = "me",
  fetchImpl = globalThis.fetch,
}) {
  return messengerJsonRequest({
    pageAccessToken,
    graphApiBaseUrl,
    pageId,
    fetchImpl,
    body: {
      recipient: { id: recipientId },
      message: { text: String(text || "").slice(0, 2000) },
    },
  });
}

export async function sendMessengerImage({
  pageAccessToken,
  recipientId,
  imageUrl,
  graphApiBaseUrl = DEFAULT_GRAPH_API_BASE_URL,
  pageId = "me",
  fetchImpl = globalThis.fetch,
}) {
  return messengerJsonRequest({
    pageAccessToken,
    graphApiBaseUrl,
    pageId,
    fetchImpl,
    body: {
      recipient: { id: recipientId },
      message: {
        attachment: {
          type: "image",
          payload: {
            url: imageUrl,
            is_reusable: true,
          },
        },
      },
    },
  });
}

export async function sendMessengerRemixResult({
  pageAccessToken,
  recipientId,
  result,
  graphApiBaseUrl = DEFAULT_GRAPH_API_BASE_URL,
  pageId = "me",
  fetchImpl = globalThis.fetch,
}) {
  if (result?.type === "help" || result?.type === "text" || !result?.imageUrls?.length) {
    return [
      await sendMessengerText({
        pageAccessToken,
        recipientId,
        text: result?.text || messengerHelpText(),
        graphApiBaseUrl,
        pageId,
        fetchImpl,
      }),
    ];
  }

  const publicUrls = publicImageUrlsFromResult(result);
  if (!publicUrls.length) {
    return [
      await sendMessengerText({
        pageAccessToken,
        recipientId,
        text: "Remix.Camera generated a local bridge image, but Messenger image attachments require a public HTTPS image URL. Use the productionImageUrl returned by the bridge or expose the image through a private HTTPS file proxy.",
        graphApiBaseUrl,
        pageId,
        fetchImpl,
      }),
    ];
  }

  const sent = [];
  for (const imageUrl of publicUrls) {
    sent.push(
      await sendMessengerImage({
        pageAccessToken,
        recipientId,
        imageUrl,
        graphApiBaseUrl,
        pageId,
        fetchImpl,
      }),
    );
  }
  if (result?.deleteAfterSeconds > 0) {
    sent.push(
      await sendMessengerText({
        pageAccessToken,
        recipientId,
        text: "Private snap sent. Messenger does not let bots force-delete delivered media; use chat deletion/retention controls for sensitive media.",
        graphApiBaseUrl,
        pageId,
        fetchImpl,
      }),
    );
  }
  return sent;
}

export function extractMessengerTextMessages(webhookPayload) {
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
  }
  return messages;
}

export function createRemixMessengerTool(options = {}) {
  return {
    helpText: () => messengerHelpText(options.characterName),
    parseCommand: parseMessengerCommand,
    buildInput: (parsed) => buildBridgeInputFromMessenger(parsed, options),
    run: (parsed, overrides = {}) => runMessengerRemixCommand(parsed, { ...options, ...overrides }),
    send: (result, sendOptions = {}) => sendMessengerRemixResult({ ...options, ...sendOptions, result }),
    async handleTextMessage(message, overrides = {}) {
      const parsed = parseMessengerCommand(message?.text || "");
      const result = await runMessengerRemixCommand(parsed, { ...options, ...overrides });
      await sendMessengerRemixResult({
        ...options,
        ...overrides,
        recipientId: message?.senderId,
        result,
      });
      return result;
    },
    async handleWebhook(webhookPayload, overrides = {}) {
      const messages = extractMessengerTextMessages(webhookPayload);
      const results = [];
      for (const message of messages) {
        results.push(await this.handleTextMessage(message, overrides));
      }
      return results;
    },
  };
}
