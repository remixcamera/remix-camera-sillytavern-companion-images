const COMMAND_CHOICES = [
  "send-selfie",
  "auto-selfie-from-chat",
  "outfit-try-on",
  "couple-photo",
  "couples-vacation",
  "date-night",
  "daily-life-snap",
  "private-snap",
];

function truthy(value) {
  return value === true || value === "true" || value === "yes" || value === "1";
}

function bridgeAction(input = {}) {
  const requested = String(input.action || input.mode || "").toLowerCase();
  if (["dry-run", "dryrun", "preview"].includes(requested)) return "dry-run";
  if (requested === "generate" && !truthy(input.yes) && !truthy(input.confirm)) {
    throw new Error("Refusing to spend Remix.Camera credits without yes=true.");
  }
  if (requested === "generate") return "generate";
  return "dry-run";
}

function cleanObject(object) {
  return Object.fromEntries(
    Object.entries(object).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  );
}

function imageUrlsFromPayload(payload = {}) {
  return Array.isArray(payload.results)
    ? payload.results.map((item) => item.productionImageUrl || item.imageUrl).filter(Boolean)
    : [];
}

function summarize(payload = {}) {
  if (payload.markdown) return payload.markdown;
  if (payload.dryRun) {
    const template = payload.promptTemplate?.packTitle || payload.promptTemplate?.packId || "Remix.Camera template";
    return `Preview ready: ${template}\n\n${payload.prompt || ""}`.trim();
  }
  return payload.prompt || JSON.stringify(payload);
}

async function perform(z, bundle) {
  const input = bundle.inputData || {};
  const auth = bundle.authData || {};
  const bridgeUrl = String(input.bridgeUrl || auth.bridgeUrl || process.env.REMIX_BRIDGE_URL || "http://127.0.0.1:8787").replace(/\/+$/, "");
  const command = input.command || "send-selfie";
  const action = bridgeAction(input);
  const prompt = input.prompt || input.text || input.chatText || "";
  const body = cleanObject({
    profileId: input.profileId || auth.profileId,
    characterName: input.characterName || auth.characterName || "Lily",
    visualIdentity: input.visualIdentity,
    chatText: input.chatText || prompt,
    mood: input.mood || prompt,
    location: input.location || prompt,
    outfit: input.outfit,
    sourceImageUrl: input.sourceImageUrl,
    userReferenceImageUrl: input.userReferenceImageUrl,
    userConsent: input.userConsent,
    userDescription: input.userDescription,
    matureContent: input.matureContent === true || command === "private-snap" ? true : undefined,
    theme: input.theme,
    maxGenerations: input.maxGenerations,
    snapTtlSeconds: input.snapTtlSeconds,
    yes: action === "generate" ? true : undefined,
  });

  const response = await z.request({
    method: "POST",
    url: `${bridgeUrl}/v1/tools/${encodeURIComponent(command)}/${action}`,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });
  const payload = response.json || (response.content ? JSON.parse(response.content) : {});
  const imageUrls = imageUrlsFromPayload(payload);
  return {
    id: payload.generationId || payload.requestId || `${command}-${action}`,
    text: summarize(payload),
    dryRun: payload.dryRun === true,
    command,
    action,
    imageUrl: imageUrls[0] || "",
    imageUrls,
    payload,
  };
}

const companionImageCreate = {
  key: "companion_image",
  noun: "Companion Image",
  display: {
    label: "Preview or Generate Companion Image",
    description: "Preview or generate Remix.Camera companion images from an existing Zapier-powered bot workflow.",
  },
  operation: {
    inputFields: [
      { key: "bridgeUrl", label: "Bridge URL", type: "string", required: true, default: "http://127.0.0.1:8787" },
      { key: "command", label: "Image command", choices: COMMAND_CHOICES, required: true, default: "send-selfie" },
      { key: "action", label: "Action", choices: ["dry-run", "generate"], required: true, default: "dry-run" },
      { key: "yes", label: "Confirm generation", type: "boolean", required: false, default: false },
      { key: "prompt", label: "Prompt or chat context", type: "text", required: false },
      { key: "characterName", label: "Character name", type: "string", required: false, default: "Lily" },
      { key: "profileId", label: "Remix.Camera profile ID", type: "string", required: false },
      { key: "sourceImageUrl", label: "Source image URL", type: "string", required: false },
      { key: "userReferenceImageUrl", label: "User reference image URL", type: "string", required: false },
      { key: "userConsent", label: "User consent", type: "string", required: false },
      { key: "matureContent", label: "Mature content", type: "boolean", required: false, default: false },
    ],
    perform,
    sample: {
      id: "send-selfie-dry-run",
      text: "Preview ready: Excellent Lily Selfie",
      dryRun: true,
      command: "send-selfie",
      action: "dry-run",
      imageUrl: "",
      imageUrls: [],
    },
    outputFields: [
      { key: "text", label: "Chat response" },
      { key: "dryRun", label: "Dry run", type: "boolean" },
      { key: "imageUrl", label: "First image URL" },
      { key: "imageUrls", label: "Image URLs", list: true },
      { key: "command", label: "Command" },
      { key: "action", label: "Action" },
    ],
  },
};

module.exports = {
  version: "0.0.1",
  platformVersion: "18.0.0",
  authentication: {
    type: "custom",
    fields: [
      { key: "bridgeUrl", label: "Bridge URL", required: false, default: "http://127.0.0.1:8787" },
      { key: "profileId", label: "Remix.Camera profile ID", required: false },
      { key: "characterName", label: "Character name", required: false, default: "Lily" },
    ],
    test: (z, bundle) => z.request({ url: `${String(bundle.authData.bridgeUrl || "http://127.0.0.1:8787").replace(/\/+$/, "")}/health` }),
    connectionLabel: "{{bundle.authData.characterName}} Remix.Camera bridge",
  },
  creates: {
    [companionImageCreate.key]: companionImageCreate,
  },
  _test: {
    perform,
    bridgeAction,
  },
};

