import { automationToolResultForChat, runAutomationBridgeTool } from "../shared/automation-tool-runner.mjs";

export async function runRemixCameraN8nTool(input = {}, options = {}) {
  return automationToolResultForChat(await runAutomationBridgeTool(input, options));
}

export const n8nCodeNodeSnippet = String.raw`
const bridgeUrl = ($json.bridgeUrl || $env.REMIX_BRIDGE_URL || 'http://127.0.0.1:8787').replace(/\/+$/, '');
const command = $json.command || 'send-selfie';
const requestedAction = String($json.action || $json.mode || '').toLowerCase();
if (requestedAction === 'generate' && $json.yes !== true && $json.confirm !== true) {
  throw new Error('Refusing to spend Remix.Camera credits without yes=true.');
}
const action = requestedAction === 'generate' || ($json.yes === true && $json.preview !== true && $json.dryRun !== true) ? 'generate' : 'dry-run';
const prompt = $json.prompt || $json.text || $json.chatText || '';
const body = Object.fromEntries(Object.entries({
  profileId: $json.profileId || $env.REMIX_PROFILE_ID,
  characterName: $json.characterName || $env.REMIX_CHARACTER_NAME || 'Remix Companion',
  visualIdentity: $json.visualIdentity || $env.REMIX_CHARACTER_VISUAL_IDENTITY,
  chatText: $json.chatText || prompt,
  mood: $json.mood || prompt,
  location: $json.location || prompt,
  outfit: $json.outfit,
  sourceImageUrl: $json.sourceImageUrl,
  userReferenceImageUrl: $json.userReferenceImageUrl,
  userConsent: $json.userConsent,
  userDescription: $json.userDescription,
  matureContent: $json.matureContent === true || command === 'private-snap' ? true : undefined,
  theme: $json.theme,
  maxGenerations: $json.maxGenerations,
  snapTtlSeconds: $json.snapTtlSeconds,
  yes: action === 'generate' ? true : undefined,
}).filter(([, value]) => value !== undefined && value !== null && value !== ''));
const response = await this.helpers.httpRequest({
  method: 'POST',
  url: bridgeUrl + '/v1/tools/' + encodeURIComponent(command) + '/' + action,
  headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
  body,
  json: true,
});
const imageUrls = Array.isArray(response.results)
  ? response.results.map((item) => item.imageUrl || item.productionImageUrl).filter(Boolean)
  : [];
const template = response.promptTemplate?.packTitle || response.promptTemplate?.packId || 'Remix.Camera template';
const text = response.dryRun
  ? 'Preview ready: ' + template + '\n\n' + (response.prompt || '')
  : response.markdown || response.prompt || JSON.stringify(response);
return [{ json: { text, imageUrls, payload: response, dryRun: response.dryRun === true, command, action } }];
`;
