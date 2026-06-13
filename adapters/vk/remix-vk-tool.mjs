import {
  callBridgeCommand,
  commandHelpLines,
  defaultInputForHost,
  imageUrlsFromBridgePayload,
  summarizeBridgePayload,
} from "../shared/bridge-client.mjs";

const DEFAULT_VK_API_BASE_URL = "https://api.vk.com/method";
const DEFAULT_VK_API_VERSION = "5.131";

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

function isPublicHttpsUrl(url) {
  return /^https:\/\//i.test(String(url || "")) && !/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])[:/]/i.test(String(url || ""));
}

function publicImageUrlsFromResult(result) {
  const payloadResults = Array.isArray(result?.payload?.results) ? result.payload.results : [];
  const urls = payloadResults
    .map((item) => item?.productionImageUrl || item?.imageUrl)
    .concat(result?.imageUrls || [])
    .filter((url, index, list) => typeof url === "string" && list.indexOf(url) === index)
    .filter(isPublicHttpsUrl);
  return urls;
}

export function vkHelpText(characterName = "Lily") {
  return [
    `${characterName} can send Remix.Camera companion images in VK.`,
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
    "By default the adapter sends public Remix.Camera image links. Enable attachImages to upload the image to VK and send a photo attachment.",
    "",
    "Bridge tools:",
    ...commandHelpLines().map((line) => `- ${line}`),
  ].join("\n");
}

export function parseVkCommand(text) {
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

export function isRemixVkCommand(text) {
  return parseVkCommand(text) !== null;
}

export function shouldHandleVkMessage(message) {
  const text = typeof message?.text === "string" ? message.text : message?.message?.text;
  return isRemixVkCommand(text || "");
}

export function shouldHandleVkWebhook(webhookPayload) {
  return extractVkTextMessages(webhookPayload).some((message) => shouldHandleVkMessage(message));
}

export function buildBridgeInputFromVk(parsed, options = {}) {
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

export async function runVkRemixCommand(parsed, options = {}) {
  if (!parsed || parsed.type === "help") {
    return {
      type: "help",
      text: vkHelpText(options.characterName),
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

  const input = buildBridgeInputFromVk(parsed, options);
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

export function verifyVkCallbackSecret({ expectedSecret, receivedSecret }) {
  if (!expectedSecret) {
    return true;
  }
  return String(expectedSecret) === String(receivedSecret || "");
}

async function vkApiRequest({
  accessToken,
  vkApiBaseUrl = DEFAULT_VK_API_BASE_URL,
  apiVersion = DEFAULT_VK_API_VERSION,
  method,
  params = {},
  fetchImpl = globalThis.fetch,
}) {
  if (!accessToken) {
    throw new Error("VK access token is required.");
  }
  const body = new URLSearchParams();
  body.set("access_token", accessToken);
  body.set("v", apiVersion);
  for (const [key, value] of Object.entries(params || {})) {
    if (value !== undefined && value !== null && value !== "") {
      body.set(key, String(value));
    }
  }
  const response = await fetchImpl(`${trimSlash(vkApiBaseUrl)}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) {
    throw new Error(payload?.error?.error_msg || payload?.message || `VK ${method} failed with ${response.status}`);
  }
  return payload.response;
}

export async function sendVkMessage({
  accessToken,
  peerId,
  message,
  attachment,
  randomId = Date.now(),
  vkApiBaseUrl = DEFAULT_VK_API_BASE_URL,
  apiVersion = DEFAULT_VK_API_VERSION,
  fetchImpl = globalThis.fetch,
}) {
  return vkApiRequest({
    accessToken,
    vkApiBaseUrl,
    apiVersion,
    method: "messages.send",
    fetchImpl,
    params: {
      peer_id: peerId,
      random_id: randomId,
      message: String(message || "").slice(0, 9000),
      attachment,
    },
  });
}

export async function sendVkText(options) {
  return sendVkMessage(options);
}

export function vkPhotoAttachmentFromSavedPhoto(photo) {
  const ownerId = photo?.owner_id ?? photo?.ownerId;
  const id = photo?.id;
  const accessKey = photo?.access_key ?? photo?.accessKey;
  if (ownerId === undefined || ownerId === null || id === undefined || id === null) {
    throw new Error("VK saved photo response did not include owner_id and id.");
  }
  return `photo${ownerId}_${id}${accessKey ? `_${accessKey}` : ""}`;
}

export async function uploadVkMessagePhoto({
  accessToken,
  peerId,
  imageUrl,
  vkApiBaseUrl = DEFAULT_VK_API_BASE_URL,
  apiVersion = DEFAULT_VK_API_VERSION,
  uploadFieldName = "photo",
  fetchImpl = globalThis.fetch,
}) {
  if (!isPublicHttpsUrl(imageUrl)) {
    throw new Error("VK photo upload requires a public HTTPS image URL.");
  }
  const uploadServer = await vkApiRequest({
    accessToken,
    vkApiBaseUrl,
    apiVersion,
    method: "photos.getMessagesUploadServer",
    fetchImpl,
    params: { peer_id: peerId },
  });
  const uploadUrl = uploadServer?.upload_url;
  if (!uploadUrl) {
    throw new Error("VK photos.getMessagesUploadServer did not return upload_url.");
  }

  const imageResponse = await fetchImpl(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Could not fetch Remix.Camera image for VK upload: ${imageResponse.status}`);
  }
  const imageBlob = await imageResponse.blob();
  const form = new FormData();
  form.set(uploadFieldName, imageBlob, "remix-camera.jpg");
  const uploadResponse = await fetchImpl(uploadUrl, {
    method: "POST",
    body: form,
  });
  const uploadPayload = await uploadResponse.json().catch(() => ({}));
  if (!uploadResponse.ok || uploadPayload?.error) {
    throw new Error(uploadPayload?.error || uploadPayload?.error_msg || `VK photo upload failed with ${uploadResponse.status}`);
  }
  if (!uploadPayload.server || !uploadPayload.photo || !uploadPayload.hash) {
    throw new Error("VK photo upload response did not include server, photo, and hash. Send the public image link instead, or set the platform-specific upload field if VK changed the upload contract.");
  }

  const savedPhotos = await vkApiRequest({
    accessToken,
    vkApiBaseUrl,
    apiVersion,
    method: "photos.saveMessagesPhoto",
    fetchImpl,
    params: {
      server: uploadPayload.server,
      photo: uploadPayload.photo,
      hash: uploadPayload.hash,
    },
  });
  const savedPhoto = Array.isArray(savedPhotos) ? savedPhotos[0] : savedPhotos;
  return {
    uploadServer,
    uploadPayload,
    savedPhoto,
    attachment: vkPhotoAttachmentFromSavedPhoto(savedPhoto),
  };
}

export async function sendVkPhotoAttachment({
  accessToken,
  peerId,
  imageUrl,
  message = "Remix.Camera",
  randomId = Date.now(),
  vkApiBaseUrl = DEFAULT_VK_API_BASE_URL,
  apiVersion = DEFAULT_VK_API_VERSION,
  uploadFieldName = "photo",
  fetchImpl = globalThis.fetch,
}) {
  const uploaded = await uploadVkMessagePhoto({
    accessToken,
    peerId,
    imageUrl,
    vkApiBaseUrl,
    apiVersion,
    uploadFieldName,
    fetchImpl,
  });
  const response = await sendVkMessage({
    accessToken,
    peerId,
    message,
    attachment: uploaded.attachment,
    randomId,
    vkApiBaseUrl,
    apiVersion,
    fetchImpl,
  });
  return { ...uploaded, response };
}

export function vkMessagesForResult(result, options = {}) {
  if (result?.type === "help" || result?.type === "text" || !result?.imageUrls?.length) {
    return [{ type: "text", text: result?.text || vkHelpText(options.characterName) }];
  }

  const publicUrls = publicImageUrlsFromResult(result);
  if (!publicUrls.length) {
    return [
      {
        type: "text",
        text: "Remix.Camera generated an image, but VK delivery needs either productionImageUrl or an uploaded VK photo attachment. Return productionImageUrl before sending to VK.",
      },
    ];
  }

  const messages = publicUrls.map((url, index) => ({
    type: options.attachImages ? "photo" : "text",
    text: index === 0 ? `Remix.Camera\n${url}` : url,
    imageUrl: url,
  }));
  if (result?.deleteAfterSeconds > 0) {
    messages.push({
      type: "text",
      text: "Private snap sent. VK bots cannot force-delete delivered media; use VK chat retention controls for sensitive media.",
    });
  }
  return messages;
}

export async function sendVkRemixResult({
  accessToken,
  peerId,
  result,
  randomIdBase = Date.now(),
  attachImages = false,
  fallbackToLink = true,
  vkApiBaseUrl = DEFAULT_VK_API_BASE_URL,
  apiVersion = DEFAULT_VK_API_VERSION,
  uploadFieldName = "photo",
  fetchImpl = globalThis.fetch,
}) {
  const messages = vkMessagesForResult(result, { attachImages });
  const sent = [];
  for (const [index, message] of messages.entries()) {
    const randomId = Number(randomIdBase) + index;
    if (message.type === "photo") {
      try {
        sent.push(
          await sendVkPhotoAttachment({
            accessToken,
            peerId,
            imageUrl: message.imageUrl,
            message: message.text.replace(message.imageUrl, "").trim() || "Remix.Camera",
            randomId,
            vkApiBaseUrl,
            apiVersion,
            uploadFieldName,
            fetchImpl,
          }),
        );
      } catch (error) {
        if (!fallbackToLink) {
          throw error;
        }
        sent.push(
          await sendVkText({
            accessToken,
            peerId,
            message: message.text,
            randomId,
            vkApiBaseUrl,
            apiVersion,
            fetchImpl,
          }),
        );
      }
    } else {
      sent.push(
        await sendVkText({
          accessToken,
          peerId,
          message: message.text,
          randomId,
          vkApiBaseUrl,
          apiVersion,
          fetchImpl,
        }),
      );
    }
  }
  return sent;
}

export function extractVkTextMessages(webhookPayload) {
  if (webhookPayload?.type !== "message_new") {
    return [];
  }
  const message = webhookPayload?.object?.message || webhookPayload?.object || {};
  const text = typeof message.text === "string" ? message.text : "";
  const peerId = message.peer_id ?? message.peerId;
  if (!text || peerId === undefined || peerId === null) {
    return [];
  }
  return [
    {
      peerId,
      fromId: message.from_id ?? message.fromId ?? null,
      conversationMessageId: message.conversation_message_id ?? message.conversationMessageId ?? null,
      text,
      raw: message,
    },
  ];
}

export function createRemixVkTool(options = {}) {
  const handleTextMessageDetailed = async (message, overrides = {}) => {
    const text = typeof message?.text === "string" ? message.text : message?.message?.text || "";
    const parsed = parseVkCommand(text);
    if (!parsed) {
      return {
        handled: false,
        reason: "unknown-command",
        peerId: message?.peerId || message?.peer_id,
        text,
        parsed: null,
        result: null,
        sentMessages: [],
      };
    }

    const merged = { ...options, ...overrides };
    const peerId = message?.peerId || message?.peer_id || merged.peerId;
    const result = await runVkRemixCommand(parsed, merged);
    const sentMessages =
      merged.autoSend === false || !merged.accessToken || !peerId
        ? []
        : await sendVkRemixResult({
            ...merged,
            peerId,
            result,
          });

    return {
      handled: true,
      peerId,
      fromId: message?.fromId || message?.from_id || null,
      text,
      parsed,
      result,
      sentMessages,
    };
  };

  const handleWebhookDetailed = async (webhookPayload, overrides = {}) => {
    const merged = { ...options, ...overrides };
    if (!verifyVkCallbackSecret({ expectedSecret: merged.callbackSecret, receivedSecret: webhookPayload?.secret })) {
      return [
        {
          handled: false,
          reason: "invalid-callback-secret",
          peerId: null,
          text: "",
          parsed: null,
          result: null,
          sentMessages: [],
        },
      ];
    }
    const messages = extractVkTextMessages(webhookPayload);
    const results = [];
    for (const message of messages) {
      results.push(await handleTextMessageDetailed(message, merged));
    }
    return results;
  };

  return {
    helpText: () => vkHelpText(options.characterName),
    parseCommand: parseVkCommand,
    isCommand: isRemixVkCommand,
    shouldHandleMessage: shouldHandleVkMessage,
    shouldHandleWebhook: shouldHandleVkWebhook,
    buildInput: (parsed) => buildBridgeInputFromVk(parsed, options),
    run: (parsed, overrides = {}) => runVkRemixCommand(parsed, { ...options, ...overrides }),
    send: (result, sendOptions = {}) => sendVkRemixResult({ ...options, ...sendOptions, result }),
    handleTextMessageDetailed,
    async handleTextMessage(message, overrides = {}) {
      const details = await handleTextMessageDetailed(message, overrides);
      return details.handled ? details.result : null;
    },
    handleWebhookDetailed,
    async handleWebhook(webhookPayload, overrides = {}) {
      const details = await handleWebhookDetailed(webhookPayload, overrides);
      return details.filter((item) => item.handled).map((item) => item.result);
    },
  };
}
