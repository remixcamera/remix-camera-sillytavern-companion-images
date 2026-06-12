import crypto from "node:crypto";
import {
  callBridgeCommand,
  commandHelpLines,
  defaultInputForHost,
  imageUrlsFromBridgePayload,
  summarizeBridgePayload,
} from "../shared/bridge-client.mjs";

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

function isLocalBridgeUrl(imageUrl) {
  return /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])[:/]/i.test(String(imageUrl || ""));
}

export function slackHelpText(characterName = "Lily") {
  return [
    `${characterName} can send Remix.Camera companion images in Slack.`,
    "",
    "Use a slash command such as:",
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

export function parseSlackCommand(text) {
  const cleaned = String(text || "").trim();
  if (!cleaned || cleaned === "help" || cleaned === "start") {
    return { type: "help" };
  }
  const [rawCommand, ...restParts] = cleaned.split(/\s+/);
  const commandName = normalizeCommand(rawCommand);
  const rest = restParts.join(" ").trim();

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

export function buildBridgeInputFromSlack(parsed, options = {}) {
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

export async function runSlackRemixCommand(parsed, options = {}) {
  if (!parsed || parsed.type === "help") {
    return {
      type: "help",
      text: slackHelpText(options.characterName),
      imageUrls: [],
    };
  }

  if (parsed.action === "generate" && ["couple-photo", "couples-vacation", "private-snap"].includes(parsed.command)) {
    if (!/\byes\b/i.test(parsed.text || "")) {
      return {
        type: "text",
        text: `${parsed.command} needs explicit yes before spending credits. Use preview first, or send the command again with yes.`,
        imageUrls: [],
      };
    }
  }

  const input = buildBridgeInputFromSlack(parsed, options);
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

export function verifySlackSignature({
  signingSecret,
  timestamp,
  signature,
  body,
  now = Date.now(),
  toleranceSeconds = 300,
}) {
  if (!signingSecret || !timestamp || !signature || body === undefined || body === null) {
    return false;
  }
  const timestampSeconds = Number(timestamp);
  if (!Number.isFinite(timestampSeconds)) {
    return false;
  }
  if (Math.abs(now / 1000 - timestampSeconds) > toleranceSeconds) {
    return false;
  }
  const bodyBuffer = Buffer.isBuffer(body) ? body : Buffer.from(String(body), "utf8");
  const base = Buffer.concat([Buffer.from(`v0:${timestamp}:`, "utf8"), bodyBuffer]);
  const expected = `v0=${crypto.createHmac("sha256", signingSecret).update(base).digest("hex")}`;
  const received = Buffer.from(String(signature), "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  return received.length === expectedBuffer.length && crypto.timingSafeEqual(received, expectedBuffer);
}

function slackImageBlocks(imageUrls) {
  return imageUrls.map((imageUrl, index) => ({
    type: "image",
    image_url: imageUrl,
    alt_text: `Remix.Camera image ${index + 1}`,
  }));
}

export function slackMessagePayload(result, options = {}) {
  const imageUrls = Array.isArray(result?.imageUrls) ? result.imageUrls : [];
  const publicImageUrls = imageUrls.filter((url) => !isLocalBridgeUrl(url));
  const text = result?.imageUrls?.length ? "Remix.Camera image ready." : result?.text || slackHelpText(options.characterName);
  return defaultInputForHost({
    response_type: options.responseType || "ephemeral",
    text,
    blocks: publicImageUrls.length ? slackImageBlocks(publicImageUrls) : undefined,
  });
}

async function postSlackJson({ url, body, fetchImpl = globalThis.fetch }) {
  const response = await fetchImpl(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || payload?.message || `Slack request failed with ${response.status}`);
  }
  return Object.keys(payload).length ? payload : { ok: true };
}

async function slackApiRequest({ botToken, method, body, fetchImpl = globalThis.fetch }) {
  if (!botToken) {
    throw new Error("SLACK_BOT_TOKEN is required for Slack Web API calls.");
  }
  const response = await fetchImpl(`https://slack.com/api/${method}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${botToken}`,
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body || {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || payload?.message || `Slack ${method} failed with ${response.status}`);
  }
  return payload;
}

export async function postSlackResponseUrl({ responseUrl, payload, fetchImpl = globalThis.fetch }) {
  if (!responseUrl) {
    throw new Error("Slack response_url is required.");
  }
  return postSlackJson({ url: responseUrl, body: payload, fetchImpl });
}

export async function sendSlackMessage({ botToken, channelId, text, blocks = [], fetchImpl = globalThis.fetch }) {
  if (!channelId) {
    throw new Error("Slack channel_id is required.");
  }
  return slackApiRequest({
    botToken,
    method: "chat.postMessage",
    body: defaultInputForHost({ channel: channelId, text, blocks: blocks.length ? blocks : undefined }),
    fetchImpl,
  });
}

export async function uploadSlackImage({
  botToken,
  channelId,
  imageUrl,
  title = "Remix.Camera image",
  initialComment = "Remix.Camera",
  fetchImpl = globalThis.fetch,
}) {
  if (!channelId) {
    throw new Error("Slack channel_id is required for file upload.");
  }
  const imageResponse = await fetchImpl(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to fetch local bridge image: ${imageResponse.status}`);
  }
  const mimeType = imageResponse.headers.get("content-type") || "image/jpeg";
  const bytes = await imageResponse.arrayBuffer();
  const filename = mimeType.includes("png") ? "remix-camera.png" : "remix-camera.jpg";
  const uploadStart = await slackApiRequest({
    botToken,
    method: "files.getUploadURLExternal",
    body: {
      filename,
      length: bytes.byteLength,
    },
    fetchImpl,
  });
  if (!uploadStart.upload_url || !uploadStart.file_id) {
    throw new Error("Slack did not return an upload_url and file_id.");
  }

  const uploadResponse = await fetchImpl(uploadStart.upload_url, {
    method: "POST",
    headers: {
      "Content-Type": mimeType,
    },
    body: bytes,
  });
  if (!uploadResponse.ok) {
    throw new Error(`Slack file upload failed with ${uploadResponse.status}`);
  }

  return slackApiRequest({
    botToken,
    method: "files.completeUploadExternal",
    body: {
      channel_id: channelId,
      initial_comment: initialComment,
      files: [{ id: uploadStart.file_id, title }],
    },
    fetchImpl,
  });
}

export async function sendSlackRemixResult({
  responseUrl,
  botToken,
  channelId,
  result,
  fetchImpl = globalThis.fetch,
}) {
  const imageUrls = Array.isArray(result?.imageUrls) ? result.imageUrls : [];
  const publicImageUrls = imageUrls.filter((url) => !isLocalBridgeUrl(url));
  const localImageUrls = imageUrls.filter(isLocalBridgeUrl);
  const sent = [];

  if (!imageUrls.length) {
    const payload = slackMessagePayload(result);
    if (responseUrl) {
      sent.push(await postSlackResponseUrl({ responseUrl, payload, fetchImpl }));
    } else if (botToken && channelId) {
      sent.push(await sendSlackMessage({ botToken, channelId, text: payload.text, blocks: payload.blocks || [], fetchImpl }));
    } else {
      sent.push(payload);
    }
    return sent;
  }

  if (publicImageUrls.length) {
    const payload = slackMessagePayload({ ...result, imageUrls: publicImageUrls });
    if (responseUrl) {
      sent.push(await postSlackResponseUrl({ responseUrl, payload, fetchImpl }));
    } else if (botToken && channelId) {
      sent.push(await sendSlackMessage({ botToken, channelId, text: payload.text, blocks: payload.blocks || [], fetchImpl }));
    } else {
      sent.push(payload);
    }
  }

  if (localImageUrls.length) {
    if (!botToken || !channelId) {
      const payload = {
        response_type: "ephemeral",
        text: "Remix.Camera generated a local bridge image, but Slack cannot fetch 127.0.0.1 URLs. Set SLACK_BOT_TOKEN and keep channel_id from the slash command so the adapter can upload the image file.",
      };
      if (responseUrl) {
        sent.push(await postSlackResponseUrl({ responseUrl, payload, fetchImpl }));
      } else {
        sent.push(payload);
      }
      return sent;
    }
    for (let index = 0; index < localImageUrls.length; index += 1) {
      sent.push(
        await uploadSlackImage({
          botToken,
          channelId,
          imageUrl: localImageUrls[index],
          title: `Remix.Camera image ${index + 1}`,
          initialComment: index === 0 ? "Remix.Camera" : "",
          fetchImpl,
        }),
      );
    }
    if (result?.deleteAfterSeconds > 0 && responseUrl) {
      sent.push(
        await postSlackResponseUrl({
          responseUrl,
          payload: {
            response_type: "ephemeral",
            text: "Private snap sent. Slack cannot guarantee automatic deletion after delivery; use Slack retention and delete controls for sensitive media.",
          },
          fetchImpl,
        }),
      );
    }
  }

  return sent;
}

export function createRemixSlackTool(options = {}) {
  return {
    helpText: () => slackHelpText(options.characterName),
    parseCommand: parseSlackCommand,
    buildInput: (parsed) => buildBridgeInputFromSlack(parsed, options),
    run: (parsed, overrides = {}) => runSlackRemixCommand(parsed, { ...options, ...overrides }),
    send: (result, sendOptions = {}) => sendSlackRemixResult({ ...options, ...sendOptions, result }),
    async handleSlashCommand(payload, overrides = {}) {
      const parsed = parseSlackCommand(payload?.text || "");
      const result = await runSlackRemixCommand(parsed, { ...options, ...overrides });
      await sendSlackRemixResult({
        ...options,
        ...overrides,
        responseUrl: payload?.response_url || overrides.responseUrl,
        channelId: payload?.channel_id || overrides.channelId || options.channelId,
        result,
      });
      return result;
    },
  };
}
