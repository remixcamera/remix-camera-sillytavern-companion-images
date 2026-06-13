import {
  callBridgeCommand,
  defaultInputForHost,
  imageUrlsFromBridgePayload,
  summarizeBridgePayload,
} from "./bridge-client.mjs";

export const DEFAULT_AUTOMATION_COMMAND = "send-selfie";

function firstText(input = {}) {
  return input.prompt || input.text || input.chatText || input.message || input.caption || "";
}

export function automationBridgeAction(input = {}) {
  const requested = String(input.action || input.mode || "").toLowerCase();
  if (["dry-run", "dryrun", "preview"].includes(requested)) return "dry-run";
  if (requested === "generate" && input.yes !== true && input.confirm !== true) {
    throw new Error("Refusing to spend Remix.Camera credits without yes=true.");
  }
  if (requested === "generate") return "generate";
  if (input.yes === true || input.confirm === true) return input.preview === true || input.dryRun === true ? "dry-run" : "generate";
  return "dry-run";
}

export function buildAutomationBridgeInput(input = {}, options = {}) {
  const prompt = firstText(input);
  const command = input.command || options.command || DEFAULT_AUTOMATION_COMMAND;
  const action = options.action || automationBridgeAction(input);
  return defaultInputForHost({
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
  });
}

export async function runAutomationBridgeTool(input = {}, options = {}) {
  const command = input.command || options.command || DEFAULT_AUTOMATION_COMMAND;
  const action = automationBridgeAction(input);
  const payload = await callBridgeCommand({
    bridgeUrl: input.bridgeUrl || options.bridgeUrl,
    command,
    action,
    input: buildAutomationBridgeInput(input, {
      ...options,
      command,
      action,
    }),
    fetchImpl: options.fetchImpl,
  });
  return {
    ok: true,
    command,
    action,
    dryRun: payload?.dryRun === true,
    text: summarizeBridgePayload(payload),
    imageUrls: imageUrlsFromBridgePayload(payload),
    payload,
  };
}

export function automationToolResultForChat(result = {}) {
  return {
    text: result.text || "Remix.Camera image request completed.",
    imageUrls: Array.isArray(result.imageUrls) ? result.imageUrls : [],
    payload: result.payload || null,
    dryRun: result.dryRun === true,
    command: result.command || DEFAULT_AUTOMATION_COMMAND,
    action: result.action || "dry-run",
  };
}
