import {
  callBridgeCommand,
  commandHelpLines,
  defaultInputForHost,
  imageUrlsFromBridgePayload,
  summarizeBridgePayload,
} from "../shared/bridge-client.mjs";

const DEFAULT_HOMESERVER_URL = "https://matrix.org";

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

function commandText(text) {
  return String(text || "")
    .trim()
    .replace(/^(!lily|\/lily)\b/i, "")
    .trim();
}

function transactionId(prefix = "remix") {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function matrixHelpText(characterName = "Lily") {
  return [
    `${characterName} can send Remix.Camera companion images in Matrix.`,
    "",
    "Send one of these in a direct room, or prefix with !lily in a shared room:",
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

export function parseMatrixCommand(text) {
  const cleaned = commandText(text);
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

export function isRemixMatrixCommand(text) {
  return parseMatrixCommand(text) !== null;
}

export function shouldHandleMatrixTextEvent(event, options = {}) {
  const text = typeof event?.text === "string" ? event.text : event?.content?.body;
  if (!text) {
    return false;
  }
  if (options.ownUserId && event?.sender === options.ownUserId) {
    return false;
  }
  if (options.requirePrefix && !/^(!lily|\/lily)\b/i.test(text)) {
    return false;
  }
  return isRemixMatrixCommand(text);
}

export function shouldHandleMatrixSync(syncPayload, options = {}) {
  return extractMatrixTextEvents(syncPayload, options).some((event) => shouldHandleMatrixTextEvent(event, options));
}

export function buildBridgeInputFromMatrix(parsed, options = {}) {
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

export async function runMatrixRemixCommand(parsed, options = {}) {
  if (!parsed || parsed.type === "help") {
    return {
      type: "help",
      text: matrixHelpText(options.characterName),
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

  const input = buildBridgeInputFromMatrix(parsed, options);
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

async function matrixJsonRequest({
  homeserverUrl = DEFAULT_HOMESERVER_URL,
  accessToken,
  method = "GET",
  path,
  body,
  fetchImpl = globalThis.fetch,
}) {
  const response = await fetchImpl(`${trimSlash(homeserverUrl)}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.errcode) {
    throw new Error(payload?.error || payload?.errcode || `Matrix ${path} failed with ${response.status}`);
  }
  return payload;
}

export async function sendMatrixText({
  homeserverUrl = DEFAULT_HOMESERVER_URL,
  accessToken,
  roomId,
  text,
  fetchImpl = globalThis.fetch,
}) {
  return matrixJsonRequest({
    homeserverUrl,
    accessToken,
    fetchImpl,
    method: "PUT",
    path: `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${transactionId("text")}`,
    body: {
      msgtype: "m.text",
      body: String(text || ""),
    },
  });
}

export async function uploadMatrixMedia({
  homeserverUrl = DEFAULT_HOMESERVER_URL,
  accessToken,
  imageUrl,
  fetchImpl = globalThis.fetch,
}) {
  const imageResponse = await fetchImpl(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch image for Matrix upload: ${imageResponse.status}`);
  }
  const mimeType = imageResponse.headers.get("content-type") || "image/jpeg";
  const filename = mimeType.includes("png") ? "remix-camera.png" : "remix-camera.jpg";
  const bytes = await imageResponse.arrayBuffer();
  const uploadUrl = new URL(`${trimSlash(homeserverUrl)}/_matrix/media/v3/upload`);
  uploadUrl.searchParams.set("filename", filename);
  const response = await fetchImpl(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": mimeType,
    },
    body: bytes,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.errcode || !payload?.content_uri) {
    throw new Error(payload?.error || payload?.errcode || `Matrix media upload failed with ${response.status}`);
  }
  return {
    contentUri: payload.content_uri,
    mimeType,
    size: bytes.byteLength,
  };
}

export async function sendMatrixImage({
  homeserverUrl = DEFAULT_HOMESERVER_URL,
  accessToken,
  roomId,
  imageUrl,
  body = "Remix.Camera image",
  fetchImpl = globalThis.fetch,
}) {
  const upload = await uploadMatrixMedia({ homeserverUrl, accessToken, imageUrl, fetchImpl });
  return matrixJsonRequest({
    homeserverUrl,
    accessToken,
    fetchImpl,
    method: "PUT",
    path: `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${transactionId("image")}`,
    body: {
      msgtype: "m.image",
      body,
      url: upload.contentUri,
      info: {
        mimetype: upload.mimeType,
        size: upload.size,
      },
    },
  });
}

export async function sendMatrixRemixResult({
  homeserverUrl = DEFAULT_HOMESERVER_URL,
  accessToken,
  roomId,
  result,
  fetchImpl = globalThis.fetch,
}) {
  if (result?.type === "help" || result?.type === "text" || !result?.imageUrls?.length) {
    return [await sendMatrixText({ homeserverUrl, accessToken, roomId, text: result?.text || matrixHelpText(), fetchImpl })];
  }

  const sent = [];
  for (let index = 0; index < result.imageUrls.length; index += 1) {
    sent.push(
      await sendMatrixImage({
        homeserverUrl,
        accessToken,
        roomId,
        imageUrl: result.imageUrls[index],
        body: `Remix.Camera image ${index + 1}`,
        fetchImpl,
      }),
    );
  }
  if (result?.deleteAfterSeconds > 0) {
    sent.push(
      await sendMatrixText({
        homeserverUrl,
        accessToken,
        roomId,
        text: "Private snap sent. Matrix bots cannot guarantee deletion across all clients/servers; use room retention and redaction controls for sensitive media.",
        fetchImpl,
      }),
    );
  }
  return sent;
}

export function extractMatrixTextEvents(syncPayload, options = {}) {
  const rooms = syncPayload?.rooms?.join || {};
  const events = [];
  for (const [roomId, room] of Object.entries(rooms)) {
    for (const event of room?.timeline?.events || []) {
      const body = event?.content?.body;
      if (event?.type !== "m.room.message" || event?.content?.msgtype !== "m.text" || typeof body !== "string") {
        continue;
      }
      if (options.ownUserId && event.sender === options.ownUserId) {
        continue;
      }
      if (options.requirePrefix && !/^(!lily|\/lily)\b/i.test(body)) {
        continue;
      }
      events.push({
        roomId,
        eventId: event.event_id || "",
        sender: event.sender || "",
        text: body,
      });
    }
  }
  return events;
}

export async function matrixWhoAmI({ homeserverUrl = DEFAULT_HOMESERVER_URL, accessToken, fetchImpl = globalThis.fetch }) {
  return matrixJsonRequest({
    homeserverUrl,
    accessToken,
    fetchImpl,
    path: "/_matrix/client/v3/account/whoami",
  });
}

export async function matrixSync({
  homeserverUrl = DEFAULT_HOMESERVER_URL,
  accessToken,
  since = "",
  timeoutMs = 30000,
  fetchImpl = globalThis.fetch,
}) {
  const url = new URL(`${trimSlash(homeserverUrl)}/_matrix/client/v3/sync`);
  url.searchParams.set("timeout", String(timeoutMs));
  if (since) {
    url.searchParams.set("since", since);
  }
  const response = await fetchImpl(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.errcode) {
    throw new Error(payload?.error || payload?.errcode || `Matrix sync failed with ${response.status}`);
  }
  return payload;
}

export function createRemixMatrixTool(options = {}) {
  const handleTextEventDetailed = async (event, overrides = {}) => {
    const text = typeof event?.text === "string" ? event.text : event?.content?.body || "";
    const merged = { ...options, ...overrides };
    if (merged.ownUserId && event?.sender === merged.ownUserId) {
      return {
        handled: false,
        reason: "own-message",
        roomId: event?.roomId,
        eventId: event?.eventId || event?.event_id,
        sender: event?.sender,
        text,
        parsed: null,
        result: null,
        sentMessages: [],
      };
    }
    if (merged.requirePrefix && !/^(!lily|\/lily)\b/i.test(text)) {
      return {
        handled: false,
        reason: "missing-prefix",
        roomId: event?.roomId,
        eventId: event?.eventId || event?.event_id,
        sender: event?.sender,
        text,
        parsed: null,
        result: null,
        sentMessages: [],
      };
    }
    const parsed = parseMatrixCommand(text);
    if (!parsed) {
      return {
        handled: false,
        reason: "unknown-command",
        roomId: event?.roomId,
        eventId: event?.eventId || event?.event_id,
        sender: event?.sender,
        text,
        parsed: null,
        result: null,
        sentMessages: [],
      };
    }

    const roomId = event?.roomId || merged.roomId;
    const result = await runMatrixRemixCommand(parsed, merged);
    const sentMessages =
      merged.autoSend === false || !merged.accessToken || !roomId
        ? []
        : await sendMatrixRemixResult({
            ...merged,
            roomId,
            result,
          });

    return {
      handled: true,
      roomId,
      eventId: event?.eventId || event?.event_id,
      sender: event?.sender,
      text,
      parsed,
      result,
      sentMessages,
    };
  };

  const handleSyncDetailed = async (syncPayload, overrides = {}) => {
    const events = extractMatrixTextEvents(syncPayload, {
      ownUserId: overrides.ownUserId || options.ownUserId,
      requirePrefix: overrides.requirePrefix ?? options.requirePrefix,
    });
    const results = [];
    for (const event of events) {
      results.push(await handleTextEventDetailed(event, overrides));
    }
    return results;
  };

  return {
    helpText: () => matrixHelpText(options.characterName),
    parseCommand: parseMatrixCommand,
    isCommand: isRemixMatrixCommand,
    shouldHandleTextEvent: (event, overrides = {}) =>
      shouldHandleMatrixTextEvent(event, {
        ownUserId: overrides.ownUserId || options.ownUserId,
        requirePrefix: overrides.requirePrefix ?? options.requirePrefix,
      }),
    shouldHandleSync: (syncPayload, overrides = {}) =>
      shouldHandleMatrixSync(syncPayload, {
        ownUserId: overrides.ownUserId || options.ownUserId,
        requirePrefix: overrides.requirePrefix ?? options.requirePrefix,
      }),
    buildInput: (parsed) => buildBridgeInputFromMatrix(parsed, options),
    run: (parsed, overrides = {}) => runMatrixRemixCommand(parsed, { ...options, ...overrides }),
    send: (result, sendOptions = {}) => sendMatrixRemixResult({ ...options, ...sendOptions, result }),
    handleTextEventDetailed,
    async handleTextEvent(event, overrides = {}) {
      const details = await handleTextEventDetailed(event, overrides);
      return details.handled ? details.result : null;
    },
    handleSyncDetailed,
    async handleSync(syncPayload, overrides = {}) {
      const details = await handleSyncDetailed(syncPayload, overrides);
      return details.filter((item) => item.handled).map((item) => item.result);
    },
  };
}
