import {
  callBridgeCommand,
  commandHelpLines,
  defaultInputForHost,
  imageUrlsFromBridgePayload,
  summarizeBridgePayload,
} from "../shared/bridge-client.mjs";

const DEFAULT_TWILIO_API_BASE_URL = "https://api.twilio.com/2010-04-01";

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

function isPublicHttpsUrl(url) {
  return /^https:\/\//i.test(String(url || "")) && !/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])[:/]/i.test(String(url || ""));
}

function publicImageUrlsFromResult(result) {
  const payloadResults = Array.isArray(result?.payload?.results) ? result.payload.results : [];
  const urls = payloadResults
    .map((item) => item?.productionImageUrl || item?.imageUrl)
    .filter(isPublicHttpsUrl);
  if (urls.length) {
    return urls;
  }
  return (result?.imageUrls || []).filter(isPublicHttpsUrl);
}

export function twilioHelpText(characterName = "Lily") {
  return [
    `${characterName} can send Remix.Camera companion images over SMS/MMS.`,
    "",
    "Text one of:",
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
    "MMS media must be reachable through public HTTPS MediaUrl values.",
    "",
    "Bridge tools:",
    ...commandHelpLines().map((line) => `- ${line}`),
  ].join("\n");
}

export function parseTwilioCommand(text) {
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

export function isRemixTwilioCommand(text) {
  return parseTwilioCommand(text) !== null;
}

export function shouldHandleTwilioMessage(message) {
  return isRemixTwilioCommand(message?.Body || message?.body || message?.text || "");
}

export function buildBridgeInputFromTwilio(parsed, options = {}) {
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

export async function runTwilioRemixCommand(parsed, options = {}) {
  if (!parsed || parsed.type === "help") {
    return {
      type: "help",
      text: twilioHelpText(options.characterName),
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

  const input = buildBridgeInputFromTwilio(parsed, options);
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

function twilioAuthHeader(accountSid, authToken) {
  return `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`;
}

async function twilioMessagesRequest({
  accountSid,
  authToken,
  from,
  to,
  body,
  mediaUrls = [],
  messagingServiceSid,
  apiBaseUrl = DEFAULT_TWILIO_API_BASE_URL,
  fetchImpl = globalThis.fetch,
}) {
  const form = new URLSearchParams();
  form.set("To", to);
  form.set("Body", String(body || "").slice(0, 1600));
  if (messagingServiceSid) {
    form.set("MessagingServiceSid", messagingServiceSid);
  } else {
    form.set("From", from);
  }
  for (const mediaUrl of mediaUrls) {
    form.append("MediaUrl", mediaUrl);
  }

  const response = await fetchImpl(`${trimSlash(apiBaseUrl)}/Accounts/${accountSid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: twilioAuthHeader(accountSid, authToken),
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form.toString(),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.code) {
    throw new Error(payload?.message || `Twilio Messages API failed with ${response.status}`);
  }
  return payload;
}

export async function sendTwilioText({
  accountSid,
  authToken,
  from,
  to,
  text,
  messagingServiceSid,
  apiBaseUrl = DEFAULT_TWILIO_API_BASE_URL,
  fetchImpl = globalThis.fetch,
}) {
  return twilioMessagesRequest({
    accountSid,
    authToken,
    from,
    to,
    body: text,
    messagingServiceSid,
    apiBaseUrl,
    fetchImpl,
  });
}

export async function sendTwilioMms({
  accountSid,
  authToken,
  from,
  to,
  text = "Remix.Camera",
  mediaUrls,
  messagingServiceSid,
  apiBaseUrl = DEFAULT_TWILIO_API_BASE_URL,
  fetchImpl = globalThis.fetch,
}) {
  return twilioMessagesRequest({
    accountSid,
    authToken,
    from,
    to,
    body: text,
    mediaUrls,
    messagingServiceSid,
    apiBaseUrl,
    fetchImpl,
  });
}

export async function sendTwilioRemixResult({
  accountSid,
  authToken,
  from,
  to,
  result,
  messagingServiceSid,
  apiBaseUrl = DEFAULT_TWILIO_API_BASE_URL,
  fetchImpl = globalThis.fetch,
}) {
  if (result?.type === "help" || result?.type === "text" || !result?.imageUrls?.length) {
    return [
      await sendTwilioText({
        accountSid,
        authToken,
        from,
        to,
        text: result?.text || twilioHelpText(),
        messagingServiceSid,
        apiBaseUrl,
        fetchImpl,
      }),
    ];
  }

  const publicUrls = publicImageUrlsFromResult(result);
  if (!publicUrls.length) {
    return [
      await sendTwilioText({
        accountSid,
        authToken,
        from,
        to,
        text: "Remix.Camera generated a local bridge image, but Twilio MMS requires public HTTPS MediaUrl values. Use the productionImageUrl returned by the bridge or expose the image through a private HTTPS file proxy.",
        messagingServiceSid,
        apiBaseUrl,
        fetchImpl,
      }),
    ];
  }

  const sent = [
    await sendTwilioMms({
      accountSid,
      authToken,
      from,
      to,
      mediaUrls: publicUrls.slice(0, 10),
      messagingServiceSid,
      apiBaseUrl,
      fetchImpl,
    }),
  ];
  if (result?.deleteAfterSeconds > 0) {
    sent.push(
      await sendTwilioText({
        accountSid,
        authToken,
        from,
        to,
        text: "Private snap sent. SMS/MMS cannot force-delete delivered media; use carrier/device deletion controls for sensitive media.",
        messagingServiceSid,
        apiBaseUrl,
        fetchImpl,
      }),
    );
  }
  return sent;
}

export function extractTwilioInboundMessage(input) {
  if (!input) {
    return null;
  }
  if (input instanceof URLSearchParams) {
    return Object.fromEntries(input.entries());
  }
  if (typeof input === "string") {
    return Object.fromEntries(new URLSearchParams(input).entries());
  }
  return input;
}

export function createRemixTwilioMmsTool(options = {}) {
  const handleInboundDetailed = async (input, overrides = {}) => {
    const message = extractTwilioInboundMessage(input) || {};
    const text = message.Body || message.body || message.text || "";
    const parsed = parseTwilioCommand(text);
    if (!parsed) {
      return {
        handled: false,
        reason: "unknown-command",
        from: message.From || message.from,
        to: message.To || message.to,
        messageSid: message.MessageSid || message.messageSid,
        text,
        parsed: null,
        result: null,
        sentMessages: [],
      };
    }

    const merged = { ...options, ...overrides };
    const to = message.From || message.from || merged.to;
    const from = message.To || message.to || merged.from;
    const result = await runTwilioRemixCommand(parsed, merged);
    const sentMessages =
      merged.autoSend === false || !merged.accountSid || !merged.authToken || !from || !to
        ? []
        : await sendTwilioRemixResult({
            ...merged,
            from,
            to,
            result,
          });

    return {
      handled: true,
      from: message.From || message.from,
      to,
      sendingFrom: from,
      messageSid: message.MessageSid || message.messageSid,
      text,
      parsed,
      result,
      sentMessages,
    };
  };

  return {
    helpText: () => twilioHelpText(options.characterName),
    parseCommand: parseTwilioCommand,
    isCommand: isRemixTwilioCommand,
    shouldHandleMessage: shouldHandleTwilioMessage,
    buildInput: (parsed) => buildBridgeInputFromTwilio(parsed, options),
    run: (parsed, overrides = {}) => runTwilioRemixCommand(parsed, { ...options, ...overrides }),
    send: (result, sendOptions = {}) => sendTwilioRemixResult({ ...options, ...sendOptions, result }),
    handleInboundDetailed,
    async handleInbound(input, overrides = {}) {
      const details = await handleInboundDetailed(input, overrides);
      return details.handled ? details.result : null;
    },
  };
}
