import crypto from "node:crypto";
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

function timingSafeHexEqual(expected, received) {
  const expectedBuffer = Buffer.from(String(expected || ""), "utf8");
  const receivedBuffer = Buffer.from(String(received || ""), "utf8");
  return expectedBuffer.length === receivedBuffer.length && crypto.timingSafeEqual(expectedBuffer, receivedBuffer);
}

export function parseTidioSignatureHeader(header) {
  const parts = String(header || "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  const timestamp = parts.find((part) => part.startsWith("t="))?.slice(2) || "";
  const signatures = parts.filter((part) => part.startsWith("s=")).map((part) => part.slice(2));
  return { timestamp, signatures };
}

export function verifyTidioSignature({ body, header, secret }) {
  if (!secret || body === undefined || body === null || !header) {
    return false;
  }
  const { timestamp, signatures } = parseTidioSignatureHeader(header);
  if (!/^\d+$/.test(timestamp) || signatures.length === 0) {
    return false;
  }
  const payload = `${Buffer.isBuffer(body) ? body.toString("utf8") : String(body)}_${timestamp}`;
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return signatures.some((signature) => timingSafeHexEqual(expected, signature));
}

export function tidioHelpText(characterName = "Lily") {
  return webChatHelpText({
    hostName: "Tidio",
    characterName,
    extraLines: [
      "Tidio ticket replies support text content, so generated images are delivered as public Remix.Camera links.",
      "For web chat widgets, use tidioWidgetScriptForResult(...) to display the same text and links with tidioChatApi.messageFromOperator(...).",
    ],
  });
}

export function parseTidioCommand(text) {
  return parseWebChatCommand(text);
}

export function isRemixTidioCommand(text) {
  return parseTidioCommand(text) !== null;
}

export function extractTidioText(payload) {
  return String(
    payload?.text ||
      payload?.content ||
      payload?.message?.content ||
      payload?.data?.message?.content ||
      payload?.data?.content ||
      "",
  ).trim();
}

export function shouldHandleTidioWebhook(payload) {
  return isRemixTidioCommand(extractTidioText(payload));
}

export function buildBridgeInputFromTidio(parsed, options = {}) {
  return buildWebChatBridgeInput(parsed, options);
}

export async function runTidioRemixCommand(parsed, options = {}) {
  return runWebChatRemixCommand(parsed, {
    ...options,
    hostName: "Tidio",
    helpExtraLines: ["Tidio OpenAPI ticket replies are text-only; the adapter includes public image links in the operator reply."],
  });
}

export function tidioReplyTextForResult(result, options = {}) {
  const imageUrls = publicImageUrlsFromWebChatResult(result);
  const text = webChatTextForResult(result, { hostName: "Tidio", characterName: options.characterName });
  return [text, ...imageUrls].filter(Boolean).join("\n");
}

export function tidioTicketReplyPayload(result, options = {}) {
  return {
    author_type: options.authorType || "operator",
    content: tidioReplyTextForResult(result, options),
    operator_id: options.operatorId,
    message_type: options.messageType || "public",
  };
}

export async function sendTidioTicketReply({
  clientId,
  clientSecret,
  ticketId,
  result,
  operatorId,
  apiBaseUrl = "https://api.tidio.com",
  fetchImpl = globalThis.fetch,
}) {
  if (!clientId || !clientSecret) {
    throw new Error("Tidio OpenAPI clientId and clientSecret are required.");
  }
  if (!ticketId) {
    throw new Error("Tidio ticketId is required.");
  }
  const response = await fetchImpl(`${trimTrailingSlash(apiBaseUrl)}/tickets/${encodeURIComponent(ticketId)}/reply`, {
    method: "POST",
    headers: {
      "X-Tidio-Openapi-Client-Id": clientId,
      "X-Tidio-Openapi-Client-Secret": clientSecret,
      Accept: "application/json",
      "Content-Type": "application/json; version=1",
    },
    body: JSON.stringify(tidioTicketReplyPayload(result, { operatorId })),
  });
  const responsePayload = await parseJsonOrText(response);
  if (!response.ok) {
    throw new Error(responsePayload?.errors?.[0]?.message || responsePayload?.message || responsePayload?.text || `Tidio ticket reply failed with ${response.status}`);
  }
  return responsePayload;
}

export function tidioWidgetMessagesForResult(result, options = {}) {
  const text = webChatTextForResult(result, { hostName: "Tidio", characterName: options.characterName });
  return [text, ...publicImageUrlsFromWebChatResult(result)].filter(Boolean);
}

export function tidioWidgetScriptForResult(result, options = {}) {
  const messages = tidioWidgetMessagesForResult(result, options);
  const jsMessages = JSON.stringify(messages);
  return [
    "(function () {",
    `  const messages = ${jsMessages};`,
    "  function send() {",
    "    if (!window.tidioChatApi) return;",
    "    if (typeof window.tidioChatApi.open === 'function') window.tidioChatApi.open();",
    "    for (const message of messages) {",
    "      window.tidioChatApi.messageFromOperator(message);",
    "    }",
    "  }",
    "  if (window.tidioChatApi) send();",
    "  else document.addEventListener('tidioChat-ready', send, { once: true });",
    "}());",
  ].join("\n");
}

export function createRemixTidioTool(options = {}) {
  return {
    helpText: () => tidioHelpText(options.characterName),
    parseCommand: parseTidioCommand,
    verifySignature: verifyTidioSignature,
    async runCommand(text, overrides = {}) {
      const parsed = parseTidioCommand(text);
      return runTidioRemixCommand(parsed, {
        ...options,
        ...overrides,
      });
    },
    async handleWebhookDetailed(payload, overrides = {}) {
      const text = extractTidioText(payload);
      const parsed = parseTidioCommand(text);
      if (!parsed) {
        return { handled: false, reason: "not-remix-command" };
      }
      const result = await runTidioRemixCommand(parsed, {
        ...options,
        ...overrides,
      });
      return { handled: true, parsed, result };
    },
    tidioReplyTextForResult,
    tidioWidgetScriptForResult,
    sendTidioTicketReply,
  };
}
