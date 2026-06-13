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

function basicAuth(keyId, secret) {
  return `Basic ${Buffer.from(`${keyId}:${secret}`, "utf8").toString("base64")}`;
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

function zendeskApiBaseUrl({ subdomain, apiBaseUrl }) {
  if (apiBaseUrl) {
    return trimTrailingSlash(apiBaseUrl);
  }
  if (!subdomain) {
    throw new Error("Zendesk subdomain or apiBaseUrl is required.");
  }
  return `https://${subdomain}.zendesk.com`;
}

function zendeskConversationMessagesUrl({ subdomain, appId, conversationId, apiBaseUrl }) {
  if (!appId) {
    throw new Error("Zendesk Sunshine Conversations appId is required.");
  }
  if (!conversationId) {
    throw new Error("Zendesk Sunshine Conversations conversationId is required.");
  }
  return `${zendeskApiBaseUrl({ subdomain, apiBaseUrl })}/sc/v2/apps/${encodeURIComponent(appId)}/conversations/${encodeURIComponent(conversationId)}/messages`;
}

export function zendeskHelpText(characterName = "Lily") {
  return webChatHelpText({
    hostName: "Zendesk Sunshine Conversations",
    characterName,
    extraLines: ["Zendesk delivery sends a business text message, then one content.type=image message per public Remix.Camera image URL."],
  });
}

export function parseZendeskCommand(text) {
  return parseWebChatCommand(text);
}

export function isRemixZendeskCommand(text) {
  return parseZendeskCommand(text) !== null;
}

export function extractZendeskText(payload) {
  return String(
    payload?.text ||
      payload?.message?.content?.text ||
      payload?.content?.text ||
      payload?.events?.[0]?.message?.content?.text ||
      payload?.messages?.[0]?.content?.text ||
      "",
  ).trim();
}

export function shouldHandleZendeskWebhook(payload) {
  return isRemixZendeskCommand(extractZendeskText(payload));
}

export function buildBridgeInputFromZendesk(parsed, options = {}) {
  return buildWebChatBridgeInput(parsed, options);
}

export async function runZendeskRemixCommand(parsed, options = {}) {
  return runWebChatRemixCommand(parsed, {
    ...options,
    hostName: "Zendesk Sunshine Conversations",
    helpExtraLines: ["Zendesk image messages use content.type=image and content.mediaUrl with public productionImageUrl values."],
  });
}

export function zendeskTextMessagePayload(text, options = {}) {
  return {
    author: { type: options.authorType || "business" },
    content: {
      type: "text",
      text,
    },
  };
}

export function zendeskImageMessagePayload(imageUrl, options = {}) {
  return {
    author: { type: options.authorType || "business" },
    content: {
      type: "image",
      mediaUrl: imageUrl,
    },
  };
}

export function zendeskMessagesForResult(result, options = {}) {
  const imageUrls = publicImageUrlsFromWebChatResult(result);
  const text = webChatTextForResult(result, {
    hostName: "Zendesk Sunshine Conversations",
    characterName: options.characterName,
  });
  return [
    zendeskTextMessagePayload(text, options),
    ...imageUrls.map((imageUrl) => zendeskImageMessagePayload(imageUrl, options)),
  ];
}

export async function sendZendeskMessage({
  subdomain,
  appId,
  conversationId,
  keyId,
  secret,
  payload,
  apiBaseUrl,
  fetchImpl = globalThis.fetch,
}) {
  if (!keyId || !secret) {
    throw new Error("Zendesk Sunshine Conversations keyId and secret are required.");
  }
  const response = await fetchImpl(zendeskConversationMessagesUrl({ subdomain, appId, conversationId, apiBaseUrl }), {
    method: "POST",
    headers: {
      Authorization: basicAuth(keyId, secret),
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload || {}),
  });
  const responsePayload = await parseJsonOrText(response);
  if (!response.ok) {
    throw new Error(responsePayload?.errors?.[0]?.title || responsePayload?.message || responsePayload?.text || `Zendesk message failed with ${response.status}`);
  }
  return responsePayload;
}

export async function sendZendeskText({
  subdomain,
  appId,
  conversationId,
  keyId,
  secret,
  text,
  apiBaseUrl,
  fetchImpl = globalThis.fetch,
}) {
  return sendZendeskMessage({
    subdomain,
    appId,
    conversationId,
    keyId,
    secret,
    apiBaseUrl,
    fetchImpl,
    payload: zendeskTextMessagePayload(text),
  });
}

export async function sendZendeskRemixResult({
  subdomain,
  appId,
  conversationId,
  keyId,
  secret,
  result,
  apiBaseUrl,
  fetchImpl = globalThis.fetch,
}) {
  const sent = [];
  for (const payload of zendeskMessagesForResult(result)) {
    sent.push(
      await sendZendeskMessage({
        subdomain,
        appId,
        conversationId,
        keyId,
        secret,
        apiBaseUrl,
        fetchImpl,
        payload,
      }),
    );
  }
  return sent;
}

export function createRemixZendeskTool(options = {}) {
  return {
    helpText: () => zendeskHelpText(options.characterName),
    parseCommand: parseZendeskCommand,
    async runCommand(text, overrides = {}) {
      const parsed = parseZendeskCommand(text);
      return runZendeskRemixCommand(parsed, {
        ...options,
        ...overrides,
      });
    },
    async handleWebhookDetailed(payload, overrides = {}) {
      const text = extractZendeskText(payload);
      const parsed = parseZendeskCommand(text);
      if (!parsed) {
        return { handled: false, reason: "not-remix-command" };
      }
      const result = await runZendeskRemixCommand(parsed, {
        ...options,
        ...overrides,
      });
      return { handled: true, parsed, result };
    },
    zendeskMessagesForResult,
    sendZendeskRemixResult,
  };
}
