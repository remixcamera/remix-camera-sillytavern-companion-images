export const COMPANION_COMMANDS = new Map([
  ["selfie", "send-selfie"],
  ["generate-selfie", "send-selfie"],
  ["auto_selfie", "auto-selfie-from-chat"],
  ["auto-selfie", "auto-selfie-from-chat"],
  ["scene", "auto-selfie-from-chat"],
  ["outfit", "outfit-try-on"],
  ["try-on", "outfit-try-on"],
  ["tryon", "outfit-try-on"],
  ["couple", "couple-photo"],
  ["together", "couple-photo"],
  ["vacation", "couples-vacation"],
  ["trip", "couples-vacation"],
  ["date", "date-night"],
  ["date-night", "date-night"],
  ["daily", "daily-life-snap"],
  ["snap", "private-snap"],
  ["private", "private-snap"],
]);

export const WRAPPER_COMMANDS = new Set(["remix", "photo", "image"]);
export const USER_INCLUDED_COMMANDS = new Set(["couple-photo", "couples-vacation"]);

const UNDRESS_IMAGE_REQUEST_PATTERN =
  /\b(undress|strip|take (it|that|this|them|those|everything) off|take off (it|that|this|them|those|everything)|remove (it|that|this|them|those|your clothes|the clothes)|lose (it|that|this|them|those|the clothes|the outfit|the lingerie))\b/;

export function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeSurfaceCommand(value) {
  return String(value || "")
    .replace(/^\//, "")
    .replace(/^!/, "")
    .replace(/@[^@\s]+$/, "")
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

function includesAny(haystack, patterns) {
  return patterns.some((pattern) => pattern.test(haystack));
}

export function companionHelpText(characterName = "Lily", options = {}) {
  const preview = options.previewExample || "preview send me a bath selfie";
  return [
    `I'm ${characterName}. Ask me for photos naturally, the same way you would in SillyTavern.`,
    "",
    "Try: send me a bath selfie, show me your outfit, send a photo of us at dinner, or make a vacation set of us together.",
    `Use ${preview} if you want to check the image prompt without spending credits.`,
  ].join("\n");
}

export function companionNonImageText(characterName = "Lily") {
  return `${characterName} is connected for photos here. Ask naturally for a selfie, outfit, date photo, daily snap, couple photo, vacation set, or private snap.`;
}

export function isExplicitCompanionImageRequest(text) {
  const lower = String(text || "").toLowerCase();
  const hasImageNoun = includesAny(lower, [
    /\b(selfie|photo|picture|pic|image|snap|shot|portrait|nude|nudes)\b/,
    /\b(vacation set|photo set|snap set)\b/,
  ]);
  const hasImageVerb = includesAny(lower, [
    /\b(send|show|take|make|create|generate|share|give)\b/,
    /\bwhat (do you|you) look like\b/,
  ]);
  const hasSpecificVisualIntent = includesAny(lower, [
    /\b(make|create|generate) .*\b(selfie|photo|picture|pic|image|snap|shot|portrait|vacation set|photo set|snap set)\b/,
    /\b(vacation set|photo set|snap set)\b/,
    /\bwhat (do you|you) look like\b/,
    /\bshow me .*\b(outfit|wearing|dress|bikini|lingerie|room|couch|kitchen|bath|bedroom|restaurant|date|vacation)\b/,
    /\bwearing\b/,
    /\btry (this )?on\b/,
    UNDRESS_IMAGE_REQUEST_PATTERN,
  ]);
  return (hasImageNoun && hasImageVerb) || hasSpecificVisualIntent;
}

export function isContextualUndressImageRequest(text) {
  return UNDRESS_IMAGE_REQUEST_PATTERN.test(String(text || "").toLowerCase());
}

export function inferCompanionCommand(text) {
  const lower = String(text || "").toLowerCase();
  const hasUrl = Boolean(firstUrl(text));
  const wantsTogether = includesAny(lower, [
    /\bwith me\b/,
    /\bus together\b/,
    /\bof us\b/,
    /\bcouple\b/,
    /\btogether\b/,
    /\byou and me\b/,
    /\binclude me\b/,
    /\bmy photo\b/,
  ]);
  const wantsVacation = includesAny(lower, [
    /\b(vacation|holiday|trip|weekend getaway|resort|beach trip|amalfi|paris|tokyo)\b/,
  ]);
  const wantsPrivate = includesAny(lower, [
    /\b(nsfw|nude|naked|topless|lingerie|underwear|sexy|risque|private snap|spicy|erotic|adult)\b/,
    UNDRESS_IMAGE_REQUEST_PATTERN,
  ]);
  const wantsOutfit = includesAny(lower, [
    /\b(outfit|wearing|try (this )?on|dress|sundress|bikini|jacket|shirt|skirt|heels|lingerie)\b/,
  ]);
  const wantsDate = includesAny(lower, [/\b(date night|dinner date|restaurant|cocktail bar|drinks|romantic dinner)\b/]);
  const wantsDaily = includesAny(lower, [/\b(morning|coffee|couch|kitchen|bedroom|bath|daily|right now|what are you doing)\b/]);

  if (wantsVacation && wantsTogether) {
    return "couples-vacation";
  }
  if (wantsTogether) {
    return "couple-photo";
  }
  if (wantsPrivate) {
    return "private-snap";
  }
  if (wantsOutfit && (hasUrl || /\b(try|outfit|wearing|wear|dress|sundress|bikini|jacket|shirt|skirt|heels)\b/.test(lower))) {
    return "outfit-try-on";
  }
  if (wantsDate) {
    return "date-night";
  }
  if (wantsDaily && !/\bselfie\b/.test(lower)) {
    return "daily-life-snap";
  }
  return "send-selfie";
}

export function consentForCommand(command, text = "") {
  if (!USER_INCLUDED_COMMANDS.has(command)) {
    return undefined;
  }
  const lower = String(text || "").toLowerCase();
  return includesAny(lower, [
    /\byes\b/,
    /\bi consent\b/,
    /\bconsent(ed|ing)?\b/,
    /\bconfirmed\b/,
    /\bi asked to be (in|included)\b/,
    /\binclude me,? yes\b/,
    /\byes,? include me\b/,
  ])
    ? "yes"
    : undefined;
}

export function parseNaturalCompanionImageRequest(text, action = "generate") {
  const cleaned = cleanString(text);
  if (!cleaned || !isExplicitCompanionImageRequest(cleaned)) {
    return null;
  }
  const command = inferCompanionCommand(cleaned);
  const parsed = {
    type: "image",
    action,
    command,
    text: cleaned,
    natural: true,
    userConsent: consentForCommand(command, cleaned),
  };
  if (isContextualUndressImageRequest(cleaned)) {
    parsed.contextualSourceImage = true;
  }
  return parsed;
}

export function parseCompanionSurfaceCommand(text) {
  const cleaned = cleanString(text);
  if (!cleaned) {
    return null;
  }

  const [rawCommand, ...restParts] = cleaned.split(/\s+/);
  const commandName = normalizeSurfaceCommand(rawCommand);
  const rest = restParts.join(" ").trim();

  if (commandName === "help" || commandName === "start") {
    return { type: "help" };
  }

  if (WRAPPER_COMMANDS.has(commandName)) {
    const [nestedCommand, ...nestedRest] = rest.split(/\s+/);
    const explicitCommand = COMPANION_COMMANDS.get(normalizeSurfaceCommand(nestedCommand));
    if (explicitCommand) {
      const nestedText = nestedRest.join(" ").trim();
      return {
        type: "image",
        action: "generate",
        command: explicitCommand,
        text: nestedText,
        userConsent: consentForCommand(explicitCommand, nestedText),
      };
    }
    return parseNaturalCompanionImageRequest(rest, "generate");
  }

  if (commandName === "preview") {
    const [requested, ...previewParts] = rest.split(/\s+/);
    const explicitCommand = COMPANION_COMMANDS.get(normalizeSurfaceCommand(requested));
    if (explicitCommand) {
      const previewText = previewParts.join(" ").trim();
      return {
        type: "image",
        action: "dry-run",
        command: explicitCommand,
        text: previewText,
        userConsent: consentForCommand(explicitCommand, previewText),
      };
    }
    return parseNaturalCompanionImageRequest(rest, "dry-run") || {
      type: "image",
      action: "dry-run",
      command: "send-selfie",
      text: rest,
      natural: true,
    };
  }

  const command = COMPANION_COMMANDS.get(commandName);
  if (command) {
    return {
      type: "image",
      action: "generate",
      command,
      text: rest,
      userConsent: consentForCommand(command, rest),
    };
  }

  return parseNaturalCompanionImageRequest(cleaned, "generate");
}
