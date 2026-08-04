import {
  callBridgeCommand,
  defaultInputForHost,
  imageUrlsFromBridgePayload,
  summarizeBridgePayload,
} from "./bridge-client.mjs";
export {
  COMPANION_COMMANDS,
  USER_INCLUDED_COMMANDS,
  cleanString,
  companionHelpText,
  companionNonImageText,
  firstUrl,
  isExplicitCompanionImageRequest,
  isLocalBridgeUrl,
  isPublicHttpsUrl,
  normalizeSurfaceCommand,
  parseCompanionSurfaceCommand,
  parseNaturalCompanionImageRequest,
  withoutFirstUrl,
} from "../../shared/companion-command-parser.mjs";

import {
  USER_INCLUDED_COMMANDS,
  cleanString,
  companionHelpText,
  firstUrl,
  isPublicHttpsUrl,
  withoutFirstUrl,
} from "../../shared/companion-command-parser.mjs";

export function buildRecentChatText(lines = []) {
  return lines
    .map((line) => cleanString(line))
    .filter(Boolean)
    .slice(-12)
    .join("\n");
}

export function buildCompanionBridgeInput(parsed, options = {}) {
  const text = cleanString(parsed?.text);
  const contextualSourceImageUrl = parsed?.contextualSourceImage
    ? cleanString(options.lastGeneratedImageUrl || options.lastSourceImageUrl || options.lastImageUrl)
    : "";
  const sourceImageUrl = firstUrl(text) || contextualSourceImageUrl;
  const promptText = withoutFirstUrl(text);
  const recentChatText = cleanString(options.recentChatText);
  const chatText = buildRecentChatText([recentChatText, promptText]);
  const isCoupleCommand = ["couple-photo", "couples-vacation"].includes(parsed?.command);
  const input = {
    profileId: options.profileId,
    referenceImageKey: options.referenceImageKey,
    characterName: options.characterName,
    gender: options.gender,
    bio: options.bio,
    visualIdentity: options.visualIdentity,
    negativePrompt: options.negativePrompt,
    chatText,
    mood: promptText,
    location: promptText,
    outfit: parsed?.command === "outfit-try-on" ? promptText : options.outfit,
    sourceImageUrl,
    userReferenceImageUrl: isCoupleCommand ? sourceImageUrl : undefined,
    userReferenceImageKey: isCoupleCommand ? options.userReferenceImageKey : undefined,
    userDescription: options.userDescription,
    userConsent: parsed?.userConsent,
    theme: parsed?.command === "couples-vacation" ? promptText : undefined,
    matureContent: parsed?.command === "private-snap" ? true : options.matureContent,
    maxGenerations: parsed?.command === "couples-vacation" ? 3 : Number(options.maxGenerations || 1),
    idempotencyKey: options.idempotencyKey,
  };
  if (parsed?.action === "generate") {
    input.yes = true;
  }
  return defaultInputForHost(input);
}

export async function runCompanionBridgeCommand(parsed, options = {}) {
  if (!parsed || parsed.type === "help") {
    return {
      type: "help",
      text: companionHelpText(options.characterName, options),
      imageUrls: [],
    };
  }

  const input = buildCompanionBridgeInput(parsed, options);
  if (parsed.action === "generate" && USER_INCLUDED_COMMANDS.has(parsed.command) && input.userConsent !== "yes") {
    return {
      type: "text",
      command: parsed.command,
      input,
      text: "Say yes and clearly ask to appear in the photo before I generate a couple or vacation image with you.",
      imageUrls: [],
      deleteAfterSeconds: 0,
    };
  }
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
    text: payload?.dryRun ? "Image preview ready. No credits spent." : summarizeBridgePayload(payload),
    imageUrls: imageUrlsFromBridgePayload(payload),
    deleteAfterSeconds: 0,
  };
}

export function publicImageUrlsFromCompanionResult(result) {
  const payloadResults = Array.isArray(result?.payload?.results) ? result.payload.results : [];
  return payloadResults
    .map((item) => item?.productionImageUrl || item?.imageUrl)
    .concat(result?.imageUrls || [])
    .filter((url, index, list) => typeof url === "string" && list.indexOf(url) === index)
    .filter(isPublicHttpsUrl);
}

export function companionProgressText(characterName = "Lily", parsed = {}) {
  const command = parsed?.command || "";
  if (command === "couples-vacation") {
    return "Mmm, give me a minute. I want these to feel like they belong together.";
  }
  if (command === "couple-photo") {
    return "Mmm, give me a minute. I'm setting this up like a real photo of us.";
  }
  if (command === "private-snap") {
    return "Mmm. Give me a minute - I'll make it worth the wait.";
  }
  if (command === "outfit-try-on") {
    return "One sec, I'm putting the look together.";
  }
  return `${characterName} is making it now.`;
}
