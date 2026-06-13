import { automationToolResultForChat, runAutomationBridgeTool } from "../shared/automation-tool-runner.mjs";
import { commandHelpLines } from "../shared/bridge-client.mjs";

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

function commandFromToken(value = "") {
  return COMMANDS.get(String(value || "").replace(/^\//, "").toLowerCase()) || "";
}

function commandFromActivityName(value = "") {
  const normalized = String(value || "").toLowerCase().replace(/_/g, "-");
  if (normalized.includes("couples-vacation")) return "couples-vacation";
  if (normalized.includes("couple-photo")) return "couple-photo";
  if (normalized.includes("private-snap")) return "private-snap";
  if (normalized.includes("daily-life-snap")) return "daily-life-snap";
  if (normalized.includes("date-night")) return "date-night";
  if (normalized.includes("outfit-try-on")) return "outfit-try-on";
  if (normalized.includes("auto-selfie")) return "auto-selfie-from-chat";
  if (normalized.includes("selfie")) return "send-selfie";
  return "";
}

function actionFromText(value = "") {
  const normalized = String(value || "").toLowerCase();
  if (["dry-run", "dryrun", "preview"].includes(normalized)) return "dry-run";
  if (["generate", "send"].includes(normalized)) return "generate";
  return "";
}

function stripMentions(text = "") {
  return String(text || "")
    .replace(/<at>[^<]+<\/at>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseTextCommand(text = "") {
  const cleaned = stripMentions(text);
  if (!cleaned) return null;
  const [first, second, ...rest] = cleaned.split(/\s+/);
  const firstToken = String(first || "").replace(/^\//, "").toLowerCase();
  if (firstToken === "help" || firstToken === "start") return { type: "help" };

  const action = actionFromText(firstToken);
  if (action) {
    const command = commandFromToken(second) || "send-selfie";
    return {
      type: "image",
      action,
      command,
      prompt: rest.join(" ").trim(),
    };
  }

  const command = commandFromToken(firstToken);
  if (!command) return null;
  return {
    type: "image",
    action: "dry-run",
    command,
    prompt: [second, ...rest].join(" ").trim(),
  };
}

function valuePayload(activity = {}) {
  const value = activity.value && typeof activity.value === "object" ? activity.value : {};
  const channelData = activity.channelData && typeof activity.channelData === "object" ? activity.channelData : {};
  const remix = value.remixCamera && typeof value.remixCamera === "object" ? value.remixCamera : {};
  return {
    ...channelData.remixCamera,
    ...value,
    ...remix,
  };
}

export function botFrameworkHelpText(characterName = "Lily") {
  return [
    `${characterName} can add Remix.Camera companion images to any Bot Framework bot.`,
    "",
    "Preview first:",
    "preview selfie cozy couch with lamp light",
    "preview date rooftop dinner",
    "preview vacation Santorini sunset",
    "",
    "Generate only after confirmation:",
    "generate selfie yes cozy couch with lamp light",
    "generate couple yes cozy cabin weekend with me",
    "",
    "Direct commands like `selfie cafe mirror` are treated as previews and never spend credits.",
    "",
    "Bridge tools:",
    ...commandHelpLines().map((line) => `- ${line}`),
  ].join("\n");
}

export function botFrameworkInputFromActivity(activity = {}, options = {}) {
  const payload = valuePayload(activity);
  const parsed = parseTextCommand(activity.text || "");
  const command = firstString(payload.command, parsed?.command, commandFromActivityName(activity.name), options.command, "send-selfie");
  const action = firstString(payload.action, parsed?.action, options.action, "dry-run");
  const prompt = firstString(payload.prompt, payload.mood, payload.location, parsed?.prompt, activity.text);
  return {
    bridgeUrl: firstString(payload.bridgeUrl, options.bridgeUrl),
    command,
    action,
    yes: truthy(payload.yes) || /\byes\b/i.test(parsed?.prompt || ""),
    prompt,
    chatText: firstString(payload.chatText, prompt),
    characterName: firstString(payload.characterName, payload.character_name, options.characterName),
    profileId: firstString(payload.profileId, payload.profile_id, options.profileId),
    visualIdentity: firstString(payload.visualIdentity, payload.visual_identity, options.visualIdentity),
    sourceImageUrl: firstString(payload.sourceImageUrl, payload.source_image_url),
    userReferenceImageUrl: firstString(payload.userReferenceImageUrl, payload.user_reference_image_url),
    userConsent: firstString(payload.userConsent, payload.user_consent, /\byes\b/i.test(parsed?.prompt || "") ? "yes" : ""),
    userDescription: firstString(payload.userDescription, payload.user_description),
    outfit: firstString(payload.outfit),
    theme: firstString(payload.theme),
    matureContent: truthy(payload.matureContent || payload.mature_content),
    maxGenerations: payload.maxGenerations,
    snapTtlSeconds: payload.snapTtlSeconds,
  };
}

export function isRemixBotFrameworkActivity(activity = {}) {
  if (activity.type !== "message" && activity.type !== "invoke") return false;
  if (valuePayload(activity).command) return true;
  return parseTextCommand(activity.text || "") !== null || /remix.camera|remix_camera/i.test(activity.name || "");
}

export function botFrameworkActivitiesFromResult(result = {}, options = {}) {
  const text = result.text || botFrameworkHelpText(options.characterName);
  const imageUrls = Array.isArray(result.imageUrls) ? result.imageUrls : [];
  if (!imageUrls.length) {
    return [
      {
        type: "message",
        text,
        channelData: {
          remixCamera: {
            dryRun: result.dryRun === true,
            command: result.command || "send-selfie",
            action: result.action || "dry-run",
          },
        },
      },
    ];
  }

  return imageUrls.map((imageUrl, index) => ({
    type: "message",
    text: index === 0 ? text : "",
    attachments: [
      {
        contentType: "application/vnd.microsoft.card.hero",
        content: {
          title: "Remix.Camera companion image",
          subtitle: result.dryRun ? "Preview only" : "Generated image",
          text: index === 0 ? text : "",
          images: [{ url: imageUrl }],
        },
      },
    ],
    channelData: {
      remixCamera: {
        dryRun: result.dryRun === true,
        command: result.command || "send-selfie",
        action: result.action || "generate",
        imageUrl,
      },
    },
  }));
}

export async function runRemixCameraBotFrameworkActivity(activity = {}, options = {}) {
  const parsed = parseTextCommand(activity.text || "");
  if (parsed?.type === "help") {
    return {
      ok: true,
      handled: true,
      text: botFrameworkHelpText(options.characterName),
      activities: botFrameworkActivitiesFromResult({ text: botFrameworkHelpText(options.characterName), dryRun: true }, options),
    };
  }
  const input = botFrameworkInputFromActivity(activity, options);
  const result = automationToolResultForChat(await runAutomationBridgeTool(input, options));
  return {
    ok: true,
    handled: true,
    input,
    text: result.text,
    dryRun: result.dryRun,
    command: result.command,
    action: result.action,
    imageUrls: result.imageUrls,
    payload: result.payload,
    activities: botFrameworkActivitiesFromResult(result, options),
  };
}

export function createRemixBotFrameworkTurnHandler(options = {}) {
  return async function remixCameraBotFrameworkTurn(context, next) {
    const activity = context?.activity || {};
    if (!isRemixBotFrameworkActivity(activity)) {
      if (typeof next === "function") return next();
      return { handled: false };
    }
    const result = await runRemixCameraBotFrameworkActivity(activity, options);
    if (typeof context.sendActivities === "function") {
      await context.sendActivities(result.activities);
    } else if (typeof context.sendActivity === "function") {
      for (const outgoing of result.activities) {
        await context.sendActivity(outgoing);
      }
    }
    return result;
  };
}
