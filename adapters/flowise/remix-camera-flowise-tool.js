export async function remixCameraFlowiseTool(input = {}, options = {}) {
  const bridgeUrl = String(options.bridgeUrl || process.env.REMIX_BRIDGE_URL || "http://127.0.0.1:8787").replace(/\/+$/, "");
  const command = input.command || input.tool || "send-selfie";
  const action = input.preview === true || input.dryRun === true ? "dry-run" : "generate";
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
    yes: action === "generate" ? input.yes === true || input.confirm === true : undefined,
  };

  const response = await fetch(`${bridgeUrl}/v1/tools/${encodeURIComponent(command)}/${action}`, {
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
  return payload.markdown || payload.prompt || JSON.stringify(payload);
}

export const flowiseCustomToolSnippet = String.raw`
const bridgeUrl = $vars.REMIX_BRIDGE_URL || 'http://127.0.0.1:8787';
const command = $command || 'send-selfie';
const action = $preview === true ? 'dry-run' : 'generate';
const body = {
  characterName: $characterName || 'Remix Companion',
  chatText: $prompt,
  mood: $prompt,
  location: $prompt,
  yes: action === 'generate' ? $yes === true : undefined
};
const res = await fetch(bridgeUrl + '/v1/tools/' + command + '/' + action, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
});
const data = await res.json();
if (!res.ok || data.ok === false) throw new Error(data.error || 'Remix.Camera bridge failed');
return data.markdown || data.prompt || JSON.stringify(data);
`;
