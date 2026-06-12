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

function firstUrl(text) {
  return String(text || "").match(/https?:\/\/\S+/i)?.[0] || "";
}

function withoutFirstUrl(text) {
  const url = firstUrl(text);
  return url ? String(text || "").replace(url, "").trim() : String(text || "").trim();
}

function normalizeCommand(value) {
  return String(value || "")
    .replace(/^\//, "")
    .toLowerCase();
}

export function whatsappHelpText(characterName = "Lily") {
  return [
    `${characterName} can send Remix.Camera companion images in WhatsApp.`,
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
    "Couple and private commands require the word yes before spending credits.",
    "WhatsApp cannot force-delete delivered media; use WhatsApp disappearing messages for private chats.",
    "",
    "Bridge tools:",
    ...commandHelpLines().map((line) => `- ${line}`),
  ].join("\n");
}

export function parseWhatsAppCommand(text) {
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

export function buildBridgeInputFromWhatsApp(parsed, options = {}) {
  const text = parsed?.text || "";
  const lowerText = text.toLowerCase();
  const hasYes = /\byes\b/.test(lowerText);
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

export async function runWhatsAppRemixCommand(parsed, options = {}) {
  if (!parsed || parsed.type === "help") {
    return {
      type: "help",
      text: whatsappHelpText(options.characterName),
      imageUrls: [],
    };
  }

  if (parsed.action === "generate" && ["couple-photo", "couples-vacation", "private-snap"].includes(parsed.command)) {
    const hasConsent = /\byes\b/i.test(parsed.text || "");
    if (!hasConsent) {
      return {
        type: "text",
        text: `${parsed.command} needs explicit yes before spending credits. Send preview first, or send the command again with yes.`,
        imageUrls: [],
      };
    }
  }

  const input = buildBridgeInputFromWhatsApp(parsed, options);
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

async function whatsappJsonRequest({ accessToken, phoneNumberId, graphApiBaseUrl, path, body, fetchImpl = globalThis.fetch }) {
  const response = await fetchImpl(`${trimSlash(graphApiBaseUrl || DEFAULT_GRAPH_API_BASE_URL)}/${phoneNumberId}/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error) {
    throw new Error(payload?.error?.message || payload?.message || `WhatsApp ${path} failed with ${response.status}`);
  }
  return payload;
}

async function uploadWhatsAppMedia({
  accessToken,
  phoneNumberId,
  graphApiBaseUrl,
  imageUrl,
  fetchImpl = globalThis.fetch,
}) {
  const imageResponse = await fetchImpl(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch local bridge image: ${imageResponse.status}`);
  }
  const mimeType = imageResponse.headers.get("content-type") || "image/jpeg";
  const form = new FormData();
  form.set("messaging_product", "whatsapp");
  form.set("type", mimeType);
  form.set("file", new Blob([await imageResponse.arrayBuffer()], { type: mimeType }), "remix-camera.jpg");

  const response = await fetchImpl(`${trimSlash(graphApiBaseUrl || DEFAULT_GRAPH_API_BASE_URL)}/${phoneNumberId}/media`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: form,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.error || !payload?.id) {
    throw new Error(payload?.error?.message || payload?.message || `WhatsApp media upload failed with ${response.status}`);
  }
  return payload.id;
}

export async function sendWhatsAppText({
  accessToken,
  phoneNumberId,
  to,
  text,
  graphApiBaseUrl = DEFAULT_GRAPH_API_BASE_URL,
  fetchImpl = globalThis.fetch,
}) {
  return whatsappJsonRequest({
    accessToken,
    phoneNumberId,
    graphApiBaseUrl,
    fetchImpl,
    path: "messages",
    body: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: {
        preview_url: false,
        body: String(text || "").slice(0, 4096),
      },
    },
  });
}

export async function sendWhatsAppImage({
  accessToken,
  phoneNumberId,
  to,
  imageUrl,
  caption = "",
  graphApiBaseUrl = DEFAULT_GRAPH_API_BASE_URL,
  fetchImpl = globalThis.fetch,
}) {
  let image;
  if (/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])[:/]/i.test(imageUrl)) {
    const mediaId = await uploadWhatsAppMedia({
      accessToken,
      phoneNumberId,
      graphApiBaseUrl,
      imageUrl,
      fetchImpl,
    });
    image = { id: mediaId, caption: caption.slice(0, 1024) };
  } else {
    image = { link: imageUrl, caption: caption.slice(0, 1024) };
  }

  return whatsappJsonRequest({
    accessToken,
    phoneNumberId,
    graphApiBaseUrl,
    fetchImpl,
    path: "messages",
    body: {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "image",
      image,
    },
  });
}

export async function sendWhatsAppRemixResult({
  accessToken,
  phoneNumberId,
  to,
  result,
  graphApiBaseUrl = DEFAULT_GRAPH_API_BASE_URL,
  fetchImpl = globalThis.fetch,
}) {
  if (result.type === "help" || result.type === "text" || !result.imageUrls?.length) {
    return [
      await sendWhatsAppText({
        accessToken,
        phoneNumberId,
        to,
        text: result.text || whatsappHelpText(),
        graphApiBaseUrl,
        fetchImpl,
      }),
    ];
  }

  const sent = [];
  for (let index = 0; index < result.imageUrls.length; index += 1) {
    const caption = index === 0 ? "Remix.Camera" : "";
    sent.push(
      await sendWhatsAppImage({
        accessToken,
        phoneNumberId,
        to,
        imageUrl: result.imageUrls[index],
        caption,
        graphApiBaseUrl,
        fetchImpl,
      }),
    );
  }

  if (result.deleteAfterSeconds > 0) {
    sent.push(
      await sendWhatsAppText({
        accessToken,
        phoneNumberId,
        to,
        text: "Private snap sent. WhatsApp does not let bots force-delete delivered media; use disappearing messages in this chat for expiry.",
        graphApiBaseUrl,
        fetchImpl,
      }),
    );
  }

  return sent;
}

export function extractWhatsAppTextMessages(webhookPayload) {
  const entries = Array.isArray(webhookPayload?.entry) ? webhookPayload.entry : [];
  const messages = [];
  for (const entry of entries) {
    for (const change of entry?.changes || []) {
      for (const message of change?.value?.messages || []) {
        const text = message?.text?.body;
        const from = message?.from;
        if (typeof text === "string" && from) {
          messages.push({
            from,
            text,
            messageId: message.id || "",
            phoneNumberId: change?.value?.metadata?.phone_number_id || "",
          });
        }
      }
    }
  }
  return messages;
}

export function createRemixWhatsAppTool(options = {}) {
  return {
    helpText: () => whatsappHelpText(options.characterName),
    parseCommand: parseWhatsAppCommand,
    buildInput: (parsed) => buildBridgeInputFromWhatsApp(parsed, options),
    run: (parsed, overrides = {}) => runWhatsAppRemixCommand(parsed, { ...options, ...overrides }),
    send: (result, sendOptions = {}) => sendWhatsAppRemixResult({ ...options, ...sendOptions, result }),
    async handleText({ from, text }, overrides = {}) {
      const parsed = parseWhatsAppCommand(text);
      const result = await runWhatsAppRemixCommand(parsed, { ...options, ...overrides });
      await sendWhatsAppRemixResult({
        ...options,
        ...overrides,
        to: from,
        result,
      });
      return result;
    },
    async handleWebhook(webhookPayload, overrides = {}) {
      const messages = extractWhatsAppTextMessages(webhookPayload);
      const results = [];
      for (const message of messages) {
        results.push(await this.handleText(message, overrides));
      }
      return results;
    },
  };
}
