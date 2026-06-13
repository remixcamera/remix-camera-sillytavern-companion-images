const VALID_COMMANDS = new Set([
  "send-selfie",
  "auto-selfie-from-chat",
  "outfit-try-on",
  "couple-photo",
  "couples-vacation",
  "date-night",
  "daily-life-snap",
  "private-snap",
]);

const COMMAND_ALIASES = new Map([
  ["selfie", "send-selfie"],
  ["auto-selfie", "auto-selfie-from-chat"],
  ["auto_selfie", "auto-selfie-from-chat"],
  ["outfit", "outfit-try-on"],
  ["couple", "couple-photo"],
  ["vacation", "couples-vacation"],
  ["date", "date-night"],
  ["daily", "daily-life-snap"],
  ["snap", "private-snap"],
  ["private", "private-snap"],
]);

function normalizeCommand(value) {
  const raw = String(value || "send-selfie").trim().toLowerCase().replace(/_/g, "-");
  const command = COMMAND_ALIASES.get(raw) || raw;
  return VALID_COMMANDS.has(command) ? command : "send-selfie";
}

function cleanBody(body) {
  return Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined && value !== null && value !== ""));
}

function previewText(payload) {
  const template = payload?.promptTemplate?.packTitle || payload?.promptTemplate?.packId || "Remix.Camera template";
  return ["Preview ready: " + template, payload?.prompt || "", "Call again with yes=true to spend one generation."].filter(Boolean).join("\n\n");
}

async function callBridge(input = {}, runtimeArgs = {}) {
  const bridgeUrl = String(input.bridgeUrl || runtimeArgs.REMIX_BRIDGE_URL || "http://127.0.0.1:8787").replace(/\/+$/, "");
  const command = normalizeCommand(input.command || input.tool);
  const confirmed = input.yes === true || input.confirm === true;
  const action = confirmed && input.preview !== true && input.dryRun !== true ? "generate" : "dry-run";
  const prompt = input.prompt || input.text || input.chatText || "";
  const body = cleanBody({
    profileId: input.profileId || runtimeArgs.REMIX_PROFILE_ID,
    characterName: input.characterName || runtimeArgs.REMIX_CHARACTER_NAME || "Remix Companion",
    visualIdentity: input.visualIdentity || runtimeArgs.REMIX_CHARACTER_VISUAL_IDENTITY,
    chatText: input.chatText || prompt,
    mood: input.mood || prompt,
    location: input.location || prompt,
    outfit: input.outfit,
    sourceImageUrl: input.sourceImageUrl,
    userReferenceImageUrl: input.userReferenceImageUrl,
    userReferenceImageKey: input.userReferenceImageKey,
    userConsent: input.userConsent,
    userDescription: input.userDescription,
    matureContent: input.matureContent === true || command === "private-snap" ? true : undefined,
    theme: input.theme,
    maxGenerations: input.maxGenerations,
    snapTtlSeconds: input.snapTtlSeconds,
    yes: action === "generate" ? true : undefined,
  });

  const response = await fetch(`${bridgeUrl}/v1/tools/${encodeURIComponent(command)}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || payload?.message || `Remix.Camera bridge failed with ${response.status}`);
  }
  if (payload?.dryRun) {
    return previewText(payload);
  }
  return payload?.markdown || payload?.prompt || JSON.stringify(payload);
}

module.exports.runtime = {
  handler: async function (input = {}) {
    try {
      return await callBridge(input, this.runtimeArgs || {});
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (this.introspect) {
        this.introspect(`Remix.Camera Companion Images failed: ${message}`);
      }
      if (this.logger) {
        this.logger(`Remix.Camera Companion Images failed: ${message}`);
      }
      return `Remix.Camera failed: ${message}`;
    }
  },
  _callBridge: callBridge,
};
