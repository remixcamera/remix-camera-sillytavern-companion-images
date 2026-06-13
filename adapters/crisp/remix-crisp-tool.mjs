import {
  buildWebChatBridgeInput,
  parseWebChatCommand,
  publicImageUrlsFromWebChatResult,
  runWebChatRemixCommand,
  webChatHelpText,
  webChatTextForResult,
} from "../shared/web-chat-tool-runner.mjs";

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

function basicAuth(tokenId, tokenKey) {
  return `Basic ${Buffer.from(`${tokenId}:${tokenKey}`, "utf8").toString("base64")}`;
}

async function parseJsonOrText(response) {
  const text = await response.text().catch(() => "");
  if (!text) {
    return {};
  }
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

function crispConversationMessageUrl({ apiBaseUrl = "https://api.crisp.chat/v1", websiteId, sessionId }) {
  if (!websiteId) {
    throw new Error("Crisp websiteId is required.");
  }
  if (!sessionId) {
    throw new Error("Crisp sessionId is required.");
  }
  return `${trimTrailingSlash(apiBaseUrl)}/website/${encodeURIComponent(websiteId)}/conversation/${encodeURIComponent(sessionId)}/message`;
}

export function crispHelpText(characterName = "Lily") {
  return webChatHelpText({
    hostName: "Crisp",
    characterName,
    extraLines: ["Crisp delivery sends operator text messages and type=file messages with public image URLs."],
  });
}

export function parseCrispCommand(text) {
  return parseWebChatCommand(text);
}

export function isRemixCrispCommand(text) {
  return parseCrispCommand(text) !== null;
}

export function extractCrispText(payload) {
  const content = payload?.content ?? payload?.message?.content ?? payload?.data?.content;
  return typeof content === "string" ? content.trim() : String(payload?.text || payload?.message?.text || "").trim();
}

export function shouldHandleCrispWebhook(payload) {
  return isRemixCrispCommand(extractCrispText(payload));
}

export function buildBridgeInputFromCrisp(parsed, options = {}) {
  return buildWebChatBridgeInput(parsed, options);
}

export async function runCrispRemixCommand(parsed, options = {}) {
  return runWebChatRemixCommand(parsed, {
    ...options,
    hostName: "Crisp",
    helpExtraLines: ["Crisp file messages use content.url with public productionImageUrl values."],
  });
}

export function crispTextMessagePayload(text, options = {}) {
  return {
    type: "text",
    from: options.from || "operator",
    origin: options.origin || "chat",
    content: text,
  };
}

export function crispFileMessagePayload(imageUrl, options = {}) {
  return {
    type: "file",
    from: options.from || "operator",
    origin: options.origin || "chat",
    content: {
      name: options.fileName || "remix-camera.jpg",
      url: imageUrl,
      type: options.contentType || "image/jpeg",
    },
  };
}

export function crispMessagesForResult(result, options = {}) {
  const imageUrls = publicImageUrlsFromWebChatResult(result);
  const text = webChatTextForResult(result, { hostName: "Crisp", characterName: options.characterName });
  return [
    crispTextMessagePayload(text, options),
    ...imageUrls.map((imageUrl, index) =>
      crispFileMessagePayload(imageUrl, {
        ...options,
        fileName: options.fileName || `remix-camera-${index + 1}.jpg`,
      }),
    ),
  ];
}

export async function sendCrispMessage({
  tokenId,
  tokenKey,
  websiteId,
  sessionId,
  payload,
  apiBaseUrl,
  tier = "website",
  fetchImpl = globalThis.fetch,
}) {
  if (!tokenId || !tokenKey) {
    throw new Error("Crisp tokenId and tokenKey are required.");
  }
  const response = await fetchImpl(crispConversationMessageUrl({ apiBaseUrl, websiteId, sessionId }), {
    method: "POST",
    headers: {
      Authorization: basicAuth(tokenId, tokenKey),
      "X-Crisp-Tier": tier,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload || {}),
  });
  const responsePayload = await parseJsonOrText(response);
  if (!response.ok || responsePayload?.error === true) {
    throw new Error(responsePayload?.reason || responsePayload?.message || responsePayload?.text || `Crisp message failed with ${response.status}`);
  }
  return responsePayload;
}

export async function sendCrispText({
  tokenId,
  tokenKey,
  websiteId,
  sessionId,
  text,
  apiBaseUrl,
  tier,
  fetchImpl = globalThis.fetch,
}) {
  return sendCrispMessage({
    tokenId,
    tokenKey,
    websiteId,
    sessionId,
    apiBaseUrl,
    tier,
    fetchImpl,
    payload: crispTextMessagePayload(text),
  });
}

export async function sendCrispRemixResult({
  tokenId,
  tokenKey,
  websiteId,
  sessionId,
  result,
  apiBaseUrl,
  tier,
  fetchImpl = globalThis.fetch,
}) {
  const sent = [];
  for (const payload of crispMessagesForResult(result)) {
    sent.push(
      await sendCrispMessage({
        tokenId,
        tokenKey,
        websiteId,
        sessionId,
        apiBaseUrl,
        tier,
        fetchImpl,
        payload,
      }),
    );
  }
  return sent;
}

export function createRemixCrispTool(options = {}) {
  return {
    helpText: () => crispHelpText(options.characterName),
    parseCommand: parseCrispCommand,
    async runCommand(text, overrides = {}) {
      const parsed = parseCrispCommand(text);
      return runCrispRemixCommand(parsed, {
        ...options,
        ...overrides,
      });
    },
    async handleWebhookDetailed(payload, overrides = {}) {
      const text = extractCrispText(payload);
      const parsed = parseCrispCommand(text);
      if (!parsed) {
        return { handled: false, reason: "not-remix-command" };
      }
      const result = await runCrispRemixCommand(parsed, {
        ...options,
        ...overrides,
      });
      return { handled: true, parsed, result };
    },
    crispMessagesForResult,
    sendCrispRemixResult,
  };
}
