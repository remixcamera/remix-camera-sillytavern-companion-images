import {
  callBridgeCommand,
  commandHelpLines,
  defaultInputForHost,
  imageUrlsFromBridgePayload,
  summarizeBridgePayload,
} from "./bridge-client.mjs";

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

export function normalizeWebChatCommand(value) {
  return String(value || "")
    .replace(/^\//, "")
    .replace(/^!/, "")
    .toLowerCase();
}

export function firstUrl(text) {
  return String(text || "").match(/https?:\/\/\S+/i)?.[0] || "";
}

export function withoutFirstUrl(text) {
  const url = firstUrl(text);
  return url ? String(text || "").replace(url, "").trim() : String(text || "").trim();
}

export function isLocalBridgeUrl(imageUrl) {
  return /^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])[:/]/i.test(String(imageUrl || ""));
}

export function isPublicHttpsUrl(imageUrl) {
  return /^https:\/\//i.test(String(imageUrl || "")) && !isLocalBridgeUrl(imageUrl);
}

export function publicImageUrlsFromWebChatResult(result) {
  const payloadResults = Array.isArray(result?.payload?.results) ? result.payload.results : [];
  return payloadResults
    .map((item) => item?.productionImageUrl || item?.imageUrl)
    .concat(result?.imageUrls || [])
    .filter((url, index, list) => typeof url === "string" && list.indexOf(url) === index)
    .filter(isPublicHttpsUrl);
}

export function webChatResultHasLocalOnlyImages(result) {
  const imageUrls = Array.isArray(result?.imageUrls) ? result.imageUrls : [];
  return imageUrls.length > 0 && publicImageUrlsFromWebChatResult(result).length === 0;
}

export function webChatHelpText({ hostName, characterName = "Lily", extraLines = [] } = {}) {
  return [
    `${characterName} can send Remix.Camera companion images in ${hostName || "this chat"}.`,
    "",
    "Use a command such as:",
    "selfie cafe mirror selfie",
    "date quiet restaurant booth",
    "daily morning coffee on the couch",
    "outfit https://example.com/outfit.jpg red sundress",
    "couple yes coffee shop booth with me",
    "vacation yes Amalfi coast weekend",
    "snap yes warm bedroom mirror snap",
    "preview selfie cozy couch with lamp light",
    "",
    "Couple, vacation, and private snap commands require the word yes before spending credits. Preview never spends credits.",
    "Image delivery uses public Remix.Camera productionImageUrl values; local 127.0.0.1 bridge URLs are not posted as broken host images.",
    ...extraLines,
    "",
    "Bridge tools:",
    ...commandHelpLines().map((line) => `- ${line}`),
  ].join("\n");
}

export function parseWebChatCommand(text) {
  const cleaned = String(text || "").trim();
  if (!cleaned) {
    return null;
  }
  const [rawCommand, ...restParts] = cleaned.split(/\s+/);
  const commandName = normalizeWebChatCommand(rawCommand);
  const rest = restParts.join(" ").trim();

  if (commandName === "help" || commandName === "start") {
    return { type: "help" };
  }

  if (commandName === "preview") {
    const [requested, ...previewParts] = rest.split(/\s+/);
    const command = COMMANDS.get(normalizeWebChatCommand(requested)) || "send-selfie";
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

export function buildWebChatBridgeInput(parsed, options = {}) {
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

export async function runWebChatRemixCommand(parsed, options = {}) {
  const hostName = options.hostName || "this chat";
  if (!parsed || parsed.type === "help") {
    return {
      type: "help",
      text: webChatHelpText({
        hostName,
        characterName: options.characterName,
        extraLines: options.helpExtraLines || [],
      }),
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

  const input = buildWebChatBridgeInput(parsed, options);
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

export function webChatTextForResult(result, options = {}) {
  const hostName = options.hostName || "this chat";
  if (webChatResultHasLocalOnlyImages(result)) {
    return `Remix.Camera generated a local bridge image, but ${hostName} cannot fetch 127.0.0.1 URLs. Use productionImageUrl delivery or a public bridge.`;
  }
  if (publicImageUrlsFromWebChatResult(result).length) {
    const warning =
      result?.deleteAfterSeconds > 0
        ? "\n\nPrivate snap. This host cannot guarantee client-side disappearance after delivery."
        : "";
    return `Remix.Camera image ready.${warning}`;
  }
  return result?.text || webChatHelpText({ hostName, characterName: options.characterName });
}
