import { automationToolResultForChat, runAutomationBridgeTool } from "../shared/automation-tool-runner.mjs";

export const NOMI_API_BASE_URL = "https://api.nomi.ai/v1";

const COMMANDS = new Map([
  ["selfie", "send-selfie"],
  ["send-selfie", "send-selfie"],
  ["auto", "auto-selfie-from-chat"],
  ["auto-selfie", "auto-selfie-from-chat"],
  ["outfit", "outfit-try-on"],
  ["try-on", "outfit-try-on"],
  ["couple", "couple-photo"],
  ["couples", "couples-vacation"],
  ["vacation", "couples-vacation"],
  ["date", "date-night"],
  ["daily", "daily-life-snap"],
  ["snap", "private-snap"],
  ["private", "private-snap"],
]);

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function truthy(value) {
  return value === true || ["true", "yes", "y", "1", "confirm"].includes(String(value || "").trim().toLowerCase());
}

function normalizeBaseUrl(value = NOMI_API_BASE_URL) {
  return String(value || NOMI_API_BASE_URL).replace(/\/+$/, "");
}

function commandFromText(text = "") {
  const normalized = String(text || "").toLowerCase();
  for (const [token, command] of COMMANDS) {
    if (new RegExp(`\\b${token.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}\\b`, "i").test(normalized)) {
      return command;
    }
  }
  if (/\b(photo|pic|picture|image)\b/i.test(normalized)) return "send-selfie";
  return "";
}

function actionFromText(text = "") {
  const normalized = String(text || "").toLowerCase();
  if (/\b(preview|dry[- ]?run|draft)\b/.test(normalized)) return "dry-run";
  return "";
}

function nomiReplyText(payload) {
  if (typeof payload === "string") return payload;
  return firstString(
    payload?.replyMessage?.text,
    payload?.message?.text,
    payload?.text,
    payload?.reply,
    payload?.content,
  );
}

export function nomiInputFromTurn(input = {}, options = {}) {
  const userMessage = firstString(input.userMessage, input.messageText, input.message, input.prompt, input.chatText);
  const command = firstString(input.command, commandFromText(userMessage), options.command, "send-selfie");
  const action = firstString(input.action, actionFromText(userMessage), options.action, "dry-run");
  return {
    apiBaseUrl: normalizeBaseUrl(input.apiBaseUrl || input.nomiApiBaseUrl || options.nomiApiBaseUrl || process.env.NOMI_API_BASE_URL),
    apiKey: firstString(input.apiKey, input.nomiApiKey, options.nomiApiKey, process.env.NOMI_API_KEY),
    nomiUuid: firstString(input.nomiUuid, input.nomiId, options.nomiUuid, process.env.NOMI_UUID),
    roomUuid: firstString(input.roomUuid, input.roomId, options.roomUuid, process.env.NOMI_ROOM_UUID),
    requestNomiUuid: firstString(input.requestNomiUuid, options.requestNomiUuid, process.env.NOMI_REQUEST_NOMI_UUID),
    callNomi: truthy(input.callNomi ?? options.callNomi),
    userMessage,
    bridgeUrl: firstString(input.bridgeUrl, options.bridgeUrl),
    command,
    action,
    yes: truthy(input.yes ?? input.confirm ?? options.yes),
    prompt: firstString(input.prompt, input.mood, input.location, userMessage),
    chatText: firstString(input.chatText, userMessage),
    characterName: firstString(input.characterName, input.character_name, options.characterName, "Lily"),
    profileId: firstString(input.profileId, input.profile_id, options.profileId),
    visualIdentity: firstString(input.visualIdentity, input.visual_identity, options.visualIdentity),
    sourceImageUrl: firstString(input.sourceImageUrl, input.source_image_url),
    userReferenceImageUrl: firstString(input.userReferenceImageUrl, input.user_reference_image_url),
    userReferenceImageDataUrl: firstString(input.userReferenceImageDataUrl),
    userReferenceImageKey: firstString(input.userReferenceImageKey),
    userConsent: firstString(input.userConsent, input.user_consent),
    userDescription: firstString(input.userDescription, input.user_description),
    outfit: firstString(input.outfit),
    theme: firstString(input.theme),
    matureContent: truthy(input.matureContent ?? input.mature_content),
    maxGenerations: input.maxGenerations,
    snapTtlSeconds: input.snapTtlSeconds,
  };
}

async function readResponsePayload(response) {
  const contentType = response.headers?.get?.("content-type") || "";
  if (/json/i.test(contentType)) {
    return response.json().catch(() => ({}));
  }
  return response.text().catch(() => "");
}

async function requestNomi(pathname, { apiBaseUrl, apiKey, body, fetchImpl }) {
  if (!apiKey) {
    throw new Error("NOMI_API_KEY is required when callNomi=true.");
  }
  const response = await fetchImpl(`${normalizeBaseUrl(apiBaseUrl)}${pathname}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body || {}),
  });
  const payload = await readResponsePayload(response);
  if (!response.ok) {
    const message = payload?.error?.message || payload?.error || `Nomi request failed with ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export async function callNomiChat(input = {}, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("A fetch implementation is required.");
  }
  const parsed = nomiInputFromTurn(input, options);
  if (!parsed.userMessage) {
    throw new Error("userMessage is required when callNomi=true.");
  }

  if (parsed.roomUuid && parsed.requestNomiUuid) {
    const userMessagePayload = await requestNomi(`/rooms/${encodeURIComponent(parsed.roomUuid)}/chat`, {
      apiBaseUrl: parsed.apiBaseUrl,
      apiKey: parsed.apiKey,
      body: { messageText: parsed.userMessage },
      fetchImpl,
    });
    const requestPayload = await requestNomi(`/rooms/${encodeURIComponent(parsed.roomUuid)}/chat/request`, {
      apiBaseUrl: parsed.apiBaseUrl,
      apiKey: parsed.apiKey,
      body: { nomiUuid: parsed.requestNomiUuid },
      fetchImpl,
    });
    return {
      mode: "room",
      userMessagePayload,
      payload: requestPayload,
      text: nomiReplyText(requestPayload),
    };
  }

  if (parsed.roomUuid) {
    const payload = await requestNomi(`/rooms/${encodeURIComponent(parsed.roomUuid)}/chat`, {
      apiBaseUrl: parsed.apiBaseUrl,
      apiKey: parsed.apiKey,
      body: { messageText: parsed.userMessage },
      fetchImpl,
    });
    return {
      mode: "room",
      payload,
      text: nomiReplyText(payload),
    };
  }

  if (!parsed.nomiUuid) {
    throw new Error("nomiUuid or roomUuid is required when callNomi=true.");
  }
  const payload = await requestNomi(`/nomis/${encodeURIComponent(parsed.nomiUuid)}/chat`, {
    apiBaseUrl: parsed.apiBaseUrl,
    apiKey: parsed.apiKey,
    body: { messageText: parsed.userMessage },
    fetchImpl,
  });
  return {
    mode: "nomi",
    payload,
    text: nomiReplyText(payload),
  };
}

export function nomiMessagesFromResult(result = {}, options = {}) {
  const messages = [];
  const companionText = firstString(options.companionText, result.companionText);
  if (companionText) {
    messages.push({
      type: "text",
      text: companionText,
    });
  }
  if (result.text) {
    messages.push({
      type: result.dryRun ? "preview" : "text",
      text: result.text,
    });
  }
  for (const imageUrl of result.imageUrls || []) {
    messages.push({
      type: "image",
      imageUrl,
      text: "Remix.Camera companion image",
    });
  }
  return messages;
}

export async function runRemixCameraNomiTurn(input = {}, options = {}) {
  const parsed = nomiInputFromTurn(input, options);
  const nomi = parsed.callNomi ? await callNomiChat(parsed, options) : null;
  const remixInput = {
    ...parsed,
    chatText: firstString(parsed.chatText, nomi?.text),
    prompt: firstString(parsed.prompt, nomi?.text),
  };
  const remixResult = automationToolResultForChat(await runAutomationBridgeTool(remixInput, options));
  const messages = nomiMessagesFromResult(
    {
      ...remixResult,
      companionText: nomi?.text || "",
    },
    options,
  );
  return {
    ok: true,
    host: "nomi",
    nativeMediaSupport: false,
    mediaDelivery: "external-bot-sidecar",
    note: "Nomi's public API chat endpoints are text/JSON surfaces; send returned image payloads from your wrapping bot.",
    nomi,
    text: messages.map((message) => message.text || message.imageUrl).filter(Boolean).join("\n\n"),
    messages,
    dryRun: remixResult.dryRun,
    command: remixResult.command,
    action: remixResult.action,
    imageUrls: remixResult.imageUrls,
    payload: remixResult.payload,
    input: parsed,
  };
}
