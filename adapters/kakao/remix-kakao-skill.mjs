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
    .replace(/^!/, "")
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
    .concat(result?.imageUrls || [])
    .filter((url, index, list) => typeof url === "string" && list.indexOf(url) === index)
    .filter(isPublicHttpsUrl);
  return urls;
}

export function kakaoHelpText(characterName = "Lily") {
  return [
    `${characterName} can return Remix.Camera companion images from a KakaoTalk chatbot skill.`,
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
    "Couple and private commands require the word yes before spending credits. Preview never spends credits.",
    "Kakao simpleImage outputs require public image URLs, so local bridge image URLs are not returned as images.",
    "",
    "Bridge tools:",
    ...commandHelpLines().map((line) => `- ${line}`),
  ].join("\n");
}

export function parseKakaoCommand(text) {
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

export function extractKakaoUtterance(skillPayload) {
  return (
    skillPayload?.userRequest?.utterance ||
    skillPayload?.action?.params?.utterance ||
    skillPayload?.action?.params?.prompt ||
    skillPayload?.action?.detailParams?.prompt?.origin ||
    ""
  );
}

export function shouldHandleKakaoSkill(skillPayload) {
  return parseKakaoCommand(extractKakaoUtterance(skillPayload)) !== null;
}

export function buildBridgeInputFromKakao(parsed, options = {}) {
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

export async function runKakaoRemixCommand(parsed, options = {}) {
  if (!parsed || parsed.type === "help") {
    return {
      type: "help",
      text: kakaoHelpText(options.characterName),
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

  const input = buildBridgeInputFromKakao(parsed, options);
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

export function kakaoSkillTextResponse(text, options = {}) {
  const quickReplies = Array.isArray(options.quickReplies) ? options.quickReplies : [];
  return {
    version: "2.0",
    template: {
      outputs: [
        {
          simpleText: {
            text: String(text || "").slice(0, 1000),
          },
        },
      ],
      quickReplies,
    },
  };
}

export function kakaoSkillImageResponse(imageUrls, options = {}) {
  const altText = options.altText || "Remix.Camera companion image";
  const outputs = imageUrls.slice(0, 3).map((imageUrl, index) => ({
    simpleImage: {
      imageUrl,
      altText: index === 0 ? altText : `${altText} ${index + 1}`,
    },
  }));
  if (options.note && outputs.length < 3) {
    outputs.push({
      simpleText: {
        text: String(options.note).slice(0, 1000),
      },
    });
  }
  return {
    version: "2.0",
    template: {
      outputs,
      quickReplies: Array.isArray(options.quickReplies) ? options.quickReplies : [],
    },
  };
}

export function kakaoSkillResponseForResult(result, options = {}) {
  if (result?.type === "help" || result?.type === "text" || !result?.imageUrls?.length) {
    return kakaoSkillTextResponse(result?.text || kakaoHelpText(options.characterName), options);
  }

  const publicUrls = publicImageUrlsFromResult(result);
  if (!publicUrls.length) {
    return kakaoSkillTextResponse(
      "Remix.Camera generated an image, but Kakao simpleImage outputs require a public HTTPS image URL. Return productionImageUrl or proxy the file through a stable image URL before sending.",
      options,
    );
  }

  return kakaoSkillImageResponse(publicUrls, {
    ...options,
    note:
      result?.deleteAfterSeconds > 0
        ? "Private snap sent. KakaoTalk bots cannot force-delete delivered media; use chat retention controls for sensitive media."
        : options.note,
  });
}

export async function runKakaoRemixSkill(skillPayload, options = {}) {
  const text = typeof skillPayload === "string" ? skillPayload : extractKakaoUtterance(skillPayload);
  const parsed = parseKakaoCommand(text);
  const result = await runKakaoRemixCommand(parsed, options);
  return {
    handled: Boolean(parsed),
    text,
    parsed,
    result,
    response: kakaoSkillResponseForResult(result, options),
  };
}

export function createRemixKakaoSkill(options = {}) {
  const handleSkillDetailed = async (skillPayload, overrides = {}) => {
    const text = extractKakaoUtterance(skillPayload);
    const parsed = parseKakaoCommand(text);
    if (!parsed) {
      return {
        handled: false,
        reason: "unknown-command",
        text,
        parsed: null,
        result: null,
        response: kakaoSkillTextResponse(kakaoHelpText(options.characterName), options),
      };
    }
    const merged = { ...options, ...overrides };
    const result = await runKakaoRemixCommand(parsed, merged);
    return {
      handled: true,
      text,
      parsed,
      result,
      response: kakaoSkillResponseForResult(result, merged),
    };
  };

  return {
    helpText: () => kakaoHelpText(options.characterName),
    parseCommand: parseKakaoCommand,
    shouldHandleSkill: shouldHandleKakaoSkill,
    buildInput: (parsed) => buildBridgeInputFromKakao(parsed, options),
    run: (parsed, overrides = {}) => runKakaoRemixCommand(parsed, { ...options, ...overrides }),
    responseForResult: (result, responseOptions = {}) => kakaoSkillResponseForResult(result, { ...options, ...responseOptions }),
    handleSkillDetailed,
    async handleSkill(skillPayload, overrides = {}) {
      return (await handleSkillDetailed(skillPayload, overrides)).response;
    },
  };
}
