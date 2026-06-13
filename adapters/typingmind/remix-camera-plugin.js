async function remix_camera_companion_image(params = {}, userSettings = {}, resources = {}) {
  const bridgeUrl = String(params.bridgeUrl || userSettings.bridgeUrl || "http://127.0.0.1:8787").replace(/\/+$/, "");
  const command = String(params.command || "send-selfie").trim();
  const confirmed = params.yes === true || params.confirm === true;
  const action = confirmed && params.preview !== true && params.dryRun !== true ? "generate" : "dry-run";
  const prompt = params.prompt || params.text || params.chatText || resources?.userMessage?.text || "";
  const attachments = Array.isArray(resources?.userMessage?.attachments) ? resources.userMessage.attachments : [];
  const firstImageUrl = attachments.find((item) => /^image\//i.test(item?.type || "") && item?.url)?.url || "";
  const body = Object.fromEntries(
    Object.entries({
      profileId: params.profileId || userSettings.profileId,
      characterName: params.characterName || userSettings.characterName || "Remix Companion",
      visualIdentity: params.visualIdentity || userSettings.visualIdentity,
      chatText: params.chatText || prompt,
      mood: params.mood || prompt,
      location: params.location || prompt,
      outfit: params.outfit,
      sourceImageUrl: params.sourceImageUrl || (command === "outfit-try-on" ? firstImageUrl : undefined),
      userReferenceImageUrl: params.userReferenceImageUrl || (command === "couple-photo" || command === "couples-vacation" ? firstImageUrl : undefined),
      userConsent: params.userConsent,
      userDescription: params.userDescription,
      matureContent: params.matureContent === true || command === "private-snap" ? true : undefined,
      theme: params.theme,
      maxGenerations: params.maxGenerations,
      snapTtlSeconds: params.snapTtlSeconds,
      yes: action === "generate" ? true : undefined,
    }).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  );

  const response = await fetch(`${bridgeUrl}/v1/tools/${encodeURIComponent(command)}/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    throw new Error(payload?.error || payload?.message || `Remix.Camera bridge failed with ${response.status}`);
  }
  if (payload.dryRun) {
    const template = payload?.promptTemplate?.packTitle || payload?.promptTemplate?.packId || "Remix.Camera template";
    return `Preview ready: ${template}\n\n${payload.prompt || ""}\n\nCall again with yes=true to spend one generation.`;
  }
  return payload.markdown || payload.prompt || JSON.stringify(payload);
}
