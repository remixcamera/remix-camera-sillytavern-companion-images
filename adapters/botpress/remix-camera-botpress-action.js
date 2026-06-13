export async function remixCameraBotpressAction(input = {}, options = {}) {
  const bridgeUrl = String(options.bridgeUrl || process.env.REMIX_BRIDGE_URL || "http://127.0.0.1:8787").replace(/\/+$/, "");
  const command = input.command || "send-selfie";
  const confirmed = input.yes === true || input.confirm === true;
  const action = confirmed && input.preview !== true && input.dryRun !== true ? "generate" : "dry-run";
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const body = {
    profileId: input.profileId || options.profileId || process.env.REMIX_PROFILE_ID,
    characterName: input.characterName || options.characterName || process.env.REMIX_CHARACTER_NAME || "Remix Companion",
    visualIdentity: input.visualIdentity || options.visualIdentity || process.env.REMIX_CHARACTER_VISUAL_IDENTITY,
    chatText: input.chatText || input.prompt || input.text,
    mood: input.mood || input.prompt || input.text,
    location: input.location || input.prompt || input.text,
    outfit: input.outfit,
    sourceImageUrl: input.sourceImageUrl,
    userReferenceImageUrl: input.userReferenceImageUrl,
    userConsent: input.userConsent,
    matureContent: input.matureContent,
    theme: input.theme,
    maxGenerations: input.maxGenerations,
    snapTtlSeconds: input.snapTtlSeconds,
    yes: action === "generate" ? true : undefined,
  };

  const response = await fetchImpl(`${bridgeUrl}/v1/tools/${encodeURIComponent(command)}/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined && value !== ""))),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || payload?.message || `Remix.Camera bridge failed with ${response.status}`);
  }
  return {
    text: payload.markdown || payload.prompt || "Remix.Camera image request completed.",
    imageUrls: Array.isArray(payload.results)
      ? payload.results.map((result) => result.imageUrl || result.productionImageUrl).filter(Boolean)
      : [],
    payload,
  };
}

export const botpressExecuteCodeSnippet = String.raw`
const bridgeUrl = workflow.REMIX_BRIDGE_URL || 'http://127.0.0.1:8787';
const command = workflow.remixCommand || 'send-selfie';
const confirmed = workflow.yes === true || workflow.confirm === true;
const action = confirmed && workflow.preview !== true && workflow.dryRun !== true ? 'generate' : 'dry-run';
const prompt = workflow.remixPrompt || event.preview || event.payload?.text || event.text || '';
const body = {
  characterName: workflow.characterName || 'Remix Companion',
  chatText: prompt,
  mood: prompt,
  location: prompt,
  yes: action === 'generate' ? true : undefined
};
const res = await axios.post(bridgeUrl + '/v1/tools/' + command + '/' + action, body);
workflow.remixCameraText = res.data.markdown || res.data.prompt || JSON.stringify(res.data);
workflow.remixCameraImageUrls = Array.isArray(res.data.results)
  ? res.data.results.map((item) => item.imageUrl || item.productionImageUrl).filter(Boolean)
  : [];
`;
