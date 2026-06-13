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

function stripTeamsMentions(text) {
  return String(text || "")
    .replace(/<at>[^<]+<\/at>/gi, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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

export function teamsHelpText(characterName = "Lily") {
  return [
    `${characterName} can send Remix.Camera companion images in Teams chats.`,
    "",
    "Message the bot with:",
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
    "Teams media attachments should use public HTTPS contentUrl values for reliable display.",
    "",
    "Bridge tools:",
    ...commandHelpLines().map((line) => `- ${line}`),
  ].join("\n");
}

export function parseTeamsCommand(text) {
  const cleaned = stripTeamsMentions(text);
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

export function isRemixTeamsCommand(text) {
  return parseTeamsCommand(text) !== null;
}

export function shouldHandleTeamsActivity(activity) {
  return activity?.type === "message" && isRemixTeamsCommand(activity?.text || "");
}

export function buildBridgeInputFromTeams(parsed, options = {}) {
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

export async function runTeamsRemixCommand(parsed, options = {}) {
  if (!parsed || parsed.type === "help") {
    return {
      type: "help",
      text: teamsHelpText(options.characterName),
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

  const input = buildBridgeInputFromTeams(parsed, options);
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

export function teamsActivitiesFromRemixResult(result, options = {}) {
  if (result?.type === "help" || result?.type === "text" || !result?.imageUrls?.length) {
    return [
      {
        type: "message",
        text: result?.text || teamsHelpText(options.characterName),
      },
    ];
  }

  const publicUrls = publicImageUrlsFromResult(result);
  if (!publicUrls.length) {
    return [
      {
        type: "message",
        text: "Remix.Camera generated a local bridge image, but Teams image attachments should use a public HTTPS contentUrl. Use the productionImageUrl returned by the bridge or expose the image through a private HTTPS file proxy.",
      },
    ];
  }

  const activities = publicUrls.map((imageUrl, index) => ({
    type: "message",
    text: index === 0 ? "Remix.Camera" : "",
    attachments: [
      {
        contentType: "image/jpeg",
        contentUrl: imageUrl,
        name: `remix-camera-${index + 1}.jpg`,
      },
    ],
  }));
  if (result?.deleteAfterSeconds > 0) {
    activities.push({
      type: "message",
      text: "Private snap sent. Teams bots cannot force-delete delivered media; use tenant retention or message deletion controls for sensitive media.",
    });
  }
  return activities;
}

export async function sendTeamsRemixResult({ context, result, characterName }) {
  if (!context || typeof context.sendActivity !== "function") {
    throw new Error("Teams context with sendActivity(activity) is required.");
  }
  const sent = [];
  for (const activity of teamsActivitiesFromRemixResult(result, { characterName })) {
    sent.push(await context.sendActivity(activity));
  }
  return sent;
}

export function createRemixTeamsTool(options = {}) {
  const handleActivityDetailed = async (activity, overrides = {}) => {
    const parsed = parseTeamsCommand(activity?.text || "");
    if (!parsed) {
      return {
        handled: false,
        reason: "unknown-command",
        activityId: activity?.id,
        conversationId: activity?.conversation?.id,
        text: activity?.text || "",
        parsed: null,
        result: null,
        sentMessages: [],
      };
    }

    const merged = { ...options, ...overrides };
    const result = await runTeamsRemixCommand(parsed, merged);
    const sentMessages =
      merged.autoSend === false || !merged.context
        ? []
        : await sendTeamsRemixResult({
            context: merged.context,
            result,
            characterName: merged.characterName,
          });

    return {
      handled: true,
      activityId: activity?.id,
      conversationId: activity?.conversation?.id,
      text: activity?.text || "",
      parsed,
      result,
      sentMessages,
    };
  };

  const handleTurnDetailed = async (context, overrides = {}) => {
    const activity = context?.activity || {};
    return handleActivityDetailed(activity, { ...overrides, context });
  };

  return {
    helpText: () => teamsHelpText(options.characterName),
    parseCommand: parseTeamsCommand,
    isCommand: isRemixTeamsCommand,
    shouldHandleActivity: shouldHandleTeamsActivity,
    buildInput: (parsed) => buildBridgeInputFromTeams(parsed, options),
    run: (parsed, overrides = {}) => runTeamsRemixCommand(parsed, { ...options, ...overrides }),
    activities: (result, activityOptions = {}) => teamsActivitiesFromRemixResult(result, { ...options, ...activityOptions }),
    send: (result, sendOptions = {}) => sendTeamsRemixResult({ ...options, ...sendOptions, result }),
    handleActivityDetailed,
    async handleActivity(activity, overrides = {}) {
      const details = await handleActivityDetailed(activity, overrides);
      return details.handled ? details.result : null;
    },
    handleTurnDetailed,
    async handleTurn(context, overrides = {}) {
      const details = await handleTurnDetailed(context, overrides);
      return details.handled ? details.result : null;
    },
  };
}

export function createRemixTeamsMessageHandler(options = {}) {
  const tool = createRemixTeamsTool(options);
  return async function remixCameraTeamsMessageHandler(context, next) {
    if (!tool.shouldHandleActivity(context?.activity || {})) {
      return typeof next === "function" ? next() : undefined;
    }
    const details = await tool.handleTurnDetailed(context);
    if (typeof options.onHandled === "function") {
      await options.onHandled(context, details);
    }
    return details;
  };
}
