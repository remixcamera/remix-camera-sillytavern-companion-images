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

export function intercomHelpText(characterName = "Lily") {
  return webChatHelpText({
    hostName: "Intercom",
    characterName,
    extraLines: ["Intercom delivery uses the Conversations Reply API with attachment_urls for public image URLs."],
  });
}

export function parseIntercomCommand(text) {
  return parseWebChatCommand(text);
}

export function isRemixIntercomCommand(text) {
  return parseIntercomCommand(text) !== null;
}

export function extractIntercomText(payload) {
  return String(
    payload?.text ||
      payload?.body ||
      payload?.message?.body ||
      payload?.conversation_part?.body ||
      payload?.item?.conversation_message?.body ||
      "",
  )
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function shouldHandleIntercomWebhook(payload) {
  return isRemixIntercomCommand(extractIntercomText(payload));
}

export function buildBridgeInputFromIntercom(parsed, options = {}) {
  return buildWebChatBridgeInput(parsed, options);
}

export async function runIntercomRemixCommand(parsed, options = {}) {
  return runWebChatRemixCommand(parsed, {
    ...options,
    hostName: "Intercom",
    helpExtraLines: ["Intercom delivery uses attachment_urls, so generated media must be available through productionImageUrl."],
  });
}

export function intercomReplyPayloadForResult(result, options = {}) {
  const imageUrls = publicImageUrlsFromWebChatResult(result).slice(0, 10);
  const body = webChatTextForResult(result, { hostName: "Intercom", characterName: options.characterName });
  return {
    message_type: options.messageType || "comment",
    type: "admin",
    admin_id: options.adminId,
    body: imageUrls.length ? body : result?.text || body,
    attachment_urls: imageUrls.length ? imageUrls : undefined,
  };
}

export async function sendIntercomReply({
  accessToken,
  conversationId,
  adminId,
  body,
  apiBaseUrl = "https://api.intercom.io",
  intercomVersion,
  fetchImpl = globalThis.fetch,
}) {
  if (!accessToken) {
    throw new Error("Intercom access token is required.");
  }
  if (!conversationId) {
    throw new Error("Intercom conversationId is required.");
  }
  const payload = {
    ...(body || {}),
    ...(adminId ? { admin_id: adminId } : {}),
  };
  if (!payload.admin_id) {
    throw new Error("Intercom adminId is required for admin replies.");
  }
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  if (intercomVersion) {
    headers["Intercom-Version"] = intercomVersion;
  }
  const response = await fetchImpl(`${trimTrailingSlash(apiBaseUrl)}/conversations/${encodeURIComponent(conversationId)}/reply`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });
  const responsePayload = await parseJsonOrText(response);
  if (!response.ok) {
    throw new Error(responsePayload?.error?.message || responsePayload?.message || responsePayload?.text || `Intercom reply failed with ${response.status}`);
  }
  return responsePayload;
}

export async function sendIntercomText({
  accessToken,
  conversationId,
  adminId,
  text,
  apiBaseUrl,
  intercomVersion,
  fetchImpl = globalThis.fetch,
}) {
  return sendIntercomReply({
    accessToken,
    conversationId,
    adminId,
    apiBaseUrl,
    intercomVersion,
    fetchImpl,
    body: {
      message_type: "comment",
      type: "admin",
      body: text,
    },
  });
}

export async function sendIntercomRemixResult({
  accessToken,
  conversationId,
  adminId,
  result,
  apiBaseUrl,
  intercomVersion,
  fetchImpl = globalThis.fetch,
}) {
  return sendIntercomReply({
    accessToken,
    conversationId,
    adminId,
    apiBaseUrl,
    intercomVersion,
    fetchImpl,
    body: intercomReplyPayloadForResult(result, { adminId }),
  });
}

export function createRemixIntercomTool(options = {}) {
  return {
    helpText: () => intercomHelpText(options.characterName),
    parseCommand: parseIntercomCommand,
    async runCommand(text, overrides = {}) {
      const parsed = parseIntercomCommand(text);
      return runIntercomRemixCommand(parsed, {
        ...options,
        ...overrides,
      });
    },
    async handleWebhookDetailed(payload, overrides = {}) {
      const text = extractIntercomText(payload);
      const parsed = parseIntercomCommand(text);
      if (!parsed) {
        return { handled: false, reason: "not-remix-command" };
      }
      const result = await runIntercomRemixCommand(parsed, {
        ...options,
        ...overrides,
      });
      return { handled: true, parsed, result };
    },
    intercomReplyPayloadForResult,
    sendIntercomRemixResult,
  };
}
