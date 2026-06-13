import { COMPANION_COMMANDS, createCommandInputSchema } from "../../lib/companion-tools.mjs";
import {
  callBridgeCommand,
  defaultInputForHost,
  imageUrlsFromBridgePayload,
  summarizeBridgePayload,
} from "./bridge-client.mjs";

export function frameworkToolName(commandName, action = "dry-run") {
  const suffix = action === "generate" ? "generate" : "preview";
  return `remix_camera_${String(commandName).replace(/-/g, "_")}_${suffix}`;
}

export function createFrameworkJsonSchema(commandName, action = "dry-run") {
  const includeSpendGuard = action === "generate";
  const schema = createCommandInputSchema(commandName, {
    includeSpendGuard,
    requireSpendGuard: includeSpendGuard,
  });
  return {
    ...schema,
    properties: {
      prompt: {
        type: "string",
        description: "Natural-language companion image request. Used as chatText, mood, or location when those fields are omitted.",
      },
      text: {
        type: "string",
        description: "Alias for prompt for hosts that pass the current user message as text.",
      },
      ...schema.properties,
    },
  };
}

function zodFieldFromJson(z, definition, required) {
  let field;
  if (definition.enum && Array.isArray(definition.enum) && typeof z.enum === "function") {
    field = z.enum(definition.enum);
  } else if (definition.type === "boolean") {
    field = z.boolean();
  } else if (definition.type === "integer" || definition.type === "number") {
    field = z.number();
    if (definition.type === "integer" && typeof field.int === "function") field = field.int();
    if (typeof definition.minimum === "number" && typeof field.min === "function") field = field.min(definition.minimum);
    if (typeof definition.maximum === "number" && typeof field.max === "function") field = field.max(definition.maximum);
  } else {
    field = z.string();
    if (definition.format === "uri" && typeof field.url === "function") field = field.url();
  }
  if (definition.description && typeof field.describe === "function") {
    field = field.describe(definition.description);
  }
  return required || typeof field.optional !== "function" ? field : field.optional();
}

export function createFrameworkInputSchema({ z = null, commandName, action = "dry-run" }) {
  const jsonSchema = createFrameworkJsonSchema(commandName, action);
  if (!z) {
    return jsonSchema;
  }
  const required = new Set(jsonSchema.required || []);
  const shape = Object.fromEntries(
    Object.entries(jsonSchema.properties || {}).map(([key, definition]) => [
      key,
      zodFieldFromJson(z, definition, required.has(key)),
    ]),
  );
  const schema = z.object(shape);
  return typeof schema.strict === "function" ? schema.strict() : schema;
}

function firstText(input = {}) {
  return input.prompt || input.text || input.chatText || input.message || "";
}

export function buildFrameworkBridgeInput(input = {}, options = {}) {
  const prompt = firstText(input);
  const command = options.command || "send-selfie";
  const action = options.action || "dry-run";
  const body = {
    profileId: input.profileId || options.profileId || process.env.REMIX_PROFILE_ID,
    characterName: input.characterName || options.characterName || process.env.REMIX_CHARACTER_NAME || "Remix Companion",
    visualIdentity: input.visualIdentity || options.visualIdentity || process.env.REMIX_CHARACTER_VISUAL_IDENTITY,
    referenceImageKey: input.referenceImageKey,
    mood: input.mood || prompt,
    outfit: input.outfit,
    location: input.location || prompt,
    pose: input.pose,
    style: input.style,
    negativePrompt: input.negativePrompt,
    memory: input.memory,
    chatText: input.chatText || prompt,
    sourceImageUrl: input.sourceImageUrl,
    theme: input.theme,
    userConsent: input.userConsent,
    userDescription: input.userDescription,
    userReferenceImageKey: input.userReferenceImageKey,
    userReferenceImageUrl: input.userReferenceImageUrl,
    userReferenceImageDataUrl: input.userReferenceImageDataUrl,
    matureContent: input.matureContent === true || command === "private-snap" ? true : undefined,
    maxGenerations: input.maxGenerations,
    snapTtlSeconds: input.snapTtlSeconds,
    yes: action === "generate" ? true : undefined,
  };
  return defaultInputForHost(body);
}

export async function executeFrameworkBridgeTool({
  bridgeUrl,
  command,
  action = "dry-run",
  input = {},
  fetchImpl,
  profileId,
  characterName,
  visualIdentity,
}) {
  if (action === "generate" && input.yes !== true) {
    throw new Error("Refusing to spend Remix.Camera credits without yes=true.");
  }
  const payload = await callBridgeCommand({
    bridgeUrl,
    command,
    action,
    input: buildFrameworkBridgeInput(input, {
      command,
      action,
      profileId,
      characterName,
      visualIdentity,
    }),
    fetchImpl,
  });
  const imageUrls = imageUrlsFromBridgePayload(payload);
  return {
    command,
    action,
    dryRun: payload?.dryRun === true,
    text: summarizeBridgePayload(payload),
    markdown: payload?.markdown || null,
    imageUrls,
    payload,
  };
}

export function selectedFrameworkCommands(commands = null) {
  if (!commands) return COMPANION_COMMANDS;
  const requested = new Set(commands);
  const known = new Set(COMPANION_COMMANDS.map((command) => command.name));
  const unknown = [...requested].filter((command) => !known.has(command));
  if (unknown.length) {
    throw new Error(`Unknown Remix.Camera companion command: ${unknown.join(", ")}`);
  }
  return COMPANION_COMMANDS.filter((command) => requested.has(command.name));
}
