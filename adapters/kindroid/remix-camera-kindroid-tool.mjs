import { automationToolResultForChat, runAutomationBridgeTool } from "../shared/automation-tool-runner.mjs";

export const KINDROID_API_BASE_URL = "https://api.kindroid.ai/v1";

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

function normalizeBaseUrl(value = KINDROID_API_BASE_URL) {
  return String(value || KINDROID_API_BASE_URL).replace(/\/+$/, "");
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

function kindroidText(payload) {
  if (typeof payload === "string") return payload;
  return firstString(payload?.text, payload?.message, payload?.response, payload?.reply, payload?.content);
}

export function kindroidRequesterFromConversation(conversation = []) {
  const last = Array.isArray(conversation) ? conversation[conversation.length - 1] : null;
  const username = firstString(last?.username, last?.name, "kindroid-user");
  return Buffer.from(encodeURIComponent(username)).toString("base64").replace(/[^a-zA-Z0-9]/g, "").slice(0, 32);
}

export function kindroidInputFromTurn(input = {}, options = {}) {
  const conversation = Array.isArray(input.conversation) ? input.conversation : [];
  const lastConversationText = firstString(conversation.at(-1)?.text);
  const userMessage = firstString(input.userMessage, input.message, input.messageText, input.prompt, input.chatText, lastConversationText);
  const mode = firstString(input.kindroidMode, input.mode, input.shareCode ? "discord-bot" : "", input.groupId ? "group" : "", "single");
  const command = firstString(input.command, commandFromText(userMessage), options.command, "send-selfie");
  const action = firstString(input.action, actionFromText(userMessage), options.action, "dry-run");
  return {
    apiBaseUrl: normalizeBaseUrl(input.apiBaseUrl || input.kindroidApiBaseUrl || options.kindroidApiBaseUrl || process.env.KINDROID_API_BASE_URL),
    apiKey: firstString(input.apiKey, input.kindroidApiKey, options.kindroidApiKey, process.env.KINDROID_API_KEY),
    aiId: firstString(input.aiId, input.ai_id, options.aiId, process.env.KINDROID_AI_ID),
    groupId: firstString(input.groupId, input.group_id, options.groupId, process.env.KINDROID_GROUP_ID),
    shareCode: firstString(input.shareCode, input.share_code, options.shareCode, process.env.KINDROID_SHARE_CODE),
    requester: firstString(input.requester, input.kindroidRequester, options.requester, kindroidRequesterFromConversation(conversation)),
    callKindroid: truthy(input.callKindroid ?? options.callKindroid),
    mode,
    enableFilter: input.enableFilter === false || input.enable_filter === false ? false : true,
    advanceGroupTurn: input.advanceGroupTurn === false ? false : true,
    conversation,
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

async function requestKindroid(pathname, { apiBaseUrl, apiKey, body, requester, fetchImpl }) {
  if (!apiKey) {
    throw new Error("KINDROID_API_KEY is required when callKindroid=true.");
  }
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json, text/plain",
  };
  if (requester) {
    headers["X-Kindroid-Requester"] = requester;
  }
  const response = await fetchImpl(`${normalizeBaseUrl(apiBaseUrl)}${pathname}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body || {}),
  });
  const payload = await readResponsePayload(response);
  if (!response.ok) {
    const message = payload?.error?.message || payload?.error || `Kindroid request failed with ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export async function callKindroidTurn(input = {}, options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") {
    throw new Error("A fetch implementation is required.");
  }
  const parsed = kindroidInputFromTurn(input, options);

  if (parsed.mode === "discord-bot") {
    if (!parsed.shareCode) {
      throw new Error("shareCode is required for Kindroid discord-bot mode.");
    }
    const conversation = parsed.conversation.length
      ? parsed.conversation
      : [{ username: "User", text: parsed.userMessage, timestamp: new Date().toISOString() }];
    const payload = await requestKindroid("/discord-bot", {
      apiBaseUrl: parsed.apiBaseUrl,
      apiKey: parsed.apiKey,
      requester: parsed.requester || kindroidRequesterFromConversation(conversation),
      body: {
        share_code: parsed.shareCode,
        enable_filter: parsed.enableFilter,
        conversation,
      },
      fetchImpl,
    });
    return {
      mode: "discord-bot",
      payload,
      text: kindroidText(payload),
    };
  }

  if (parsed.mode === "group") {
    if (!parsed.groupId) {
      throw new Error("groupId is required for Kindroid group mode.");
    }
    if (!parsed.userMessage) {
      throw new Error("userMessage is required for Kindroid group mode.");
    }
    const userMessagePayload = await requestKindroid("/groupchats-user-message", {
      apiBaseUrl: parsed.apiBaseUrl,
      apiKey: parsed.apiKey,
      body: {
        group_id: parsed.groupId,
        message: parsed.userMessage,
      },
      fetchImpl,
    });
    if (!parsed.advanceGroupTurn) {
      return {
        mode: "group",
        userMessagePayload,
        payload: null,
        text: "",
      };
    }
    const turnPayload = await requestKindroid("/groupchats-get-turn", {
      apiBaseUrl: parsed.apiBaseUrl,
      apiKey: parsed.apiKey,
      body: {
        group_id: parsed.groupId,
      },
      fetchImpl,
    });
    const aiId = firstString(turnPayload?.ai_id, turnPayload?.aiId, parsed.aiId);
    if (!aiId) {
      return {
        mode: "group",
        userMessagePayload,
        turnPayload,
        payload: turnPayload,
        text: "",
      };
    }
    const payload = await requestKindroid("/groupchats-ai-response", {
      apiBaseUrl: parsed.apiBaseUrl,
      apiKey: parsed.apiKey,
      body: {
        group_id: parsed.groupId,
        ai_id: aiId,
      },
      fetchImpl,
    });
    return {
      mode: "group",
      userMessagePayload,
      turnPayload,
      payload,
      text: kindroidText(payload),
    };
  }

  if (!parsed.aiId) {
    throw new Error("aiId is required for Kindroid single mode.");
  }
  if (!parsed.userMessage) {
    throw new Error("userMessage is required for Kindroid single mode.");
  }
  const payload = await requestKindroid("/send-message", {
    apiBaseUrl: parsed.apiBaseUrl,
    apiKey: parsed.apiKey,
    body: {
      ai_id: parsed.aiId,
      message: parsed.userMessage,
      stream: false,
    },
    fetchImpl,
  });
  return {
    mode: "single",
    payload,
    text: kindroidText(payload),
  };
}

export function kindroidMessagesFromResult(result = {}, options = {}) {
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

export async function runRemixCameraKindroidTurn(input = {}, options = {}) {
  const parsed = kindroidInputFromTurn(input, options);
  const kindroid = parsed.callKindroid ? await callKindroidTurn(parsed, options) : null;
  const remixInput = {
    ...parsed,
    chatText: firstString(parsed.chatText, kindroid?.text),
    prompt: firstString(parsed.prompt, kindroid?.text),
  };
  const remixResult = automationToolResultForChat(await runAutomationBridgeTool(remixInput, options));
  const messages = kindroidMessagesFromResult(
    {
      ...remixResult,
      companionText: kindroid?.text || "",
    },
    options,
  );
  return {
    ok: true,
    host: "kindroid",
    nativeMediaSupport: false,
    mediaDelivery: "external-bot-sidecar",
    note: "Kindroid's public API and official Discord bot endpoint return text; send returned Remix.Camera image payloads from your wrapping bot.",
    kindroid,
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
