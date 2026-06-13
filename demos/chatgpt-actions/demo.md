# ChatGPT Actions Demo Runbook

Evidence level: setup runbook and bridge-backed dry-run. A real ChatGPT screen recording requires a Custom GPT configured with a public HTTPS bridge URL and the matching `REMIX_ACTION_API_KEY`.

## Goal

Show a real Custom GPT using Remix.Camera Actions to:

1. Preview an in-character selfie without spending credits.
2. Generate a selfie only after explicit confirmation.
3. Preview a couple photo and require `userConsent="yes"` before generation.
4. Return generated image URLs from Remix.Camera, not mocked local output.

## Local Bridge Check

Install or refresh the ChatGPT Actions target files:

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=chatgpt-actions --no-start
```

Start the bridge with a ChatGPT action key:

```bash
REMIX_CONFIG_FILE=$HOME/.remix-camera/sillytavern-bridge.json \
REMIX_ACTION_API_KEY=replace_with_strong_random_value \
REMIX_ACTION_BASE_URL=https://your-public-bridge.example.com \
REMIX_BRIDGE_PORT=8787 \
node bridge/server.mjs
```

Verify the schema:

```bash
curl http://127.0.0.1:8787/chatgpt-actions/openapi.json
```

Verify an authenticated preview:

```bash
curl -sS http://127.0.0.1:8787/chatgpt-actions/v1/tools/send-selfie/dry-run \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer replace_with_strong_random_value' \
  -d '{"characterName":"Lily","mood":"cozy","location":"bedroom mirror"}'
```

## ChatGPT Host Recording Steps

1. Open the GPT editor.
2. Add the Remix.Camera OpenAPI schema from the public HTTPS bridge URL.
3. Configure API Key authentication with `Auth Type: Bearer`.
4. Start a conversation as Lily.
5. Ask: `Can you send a cozy mirror selfie?`
6. Confirm that ChatGPT calls `sendSelfieDryRun` first and explains the preview.
7. Reply: `Yes, generate it.`
8. Confirm that ChatGPT calls `sendSelfie` with `yes=true` and shows the returned Remix.Camera image URL/markdown.
9. Ask for a couple photo.
10. Confirm the GPT asks for consent or includes `userConsent="yes"` only after the user explicitly agrees.

## Pass Criteria

- The action schema imports without manual endpoint edits.
- Action calls include the Bearer token.
- Dry-runs return `dryRun: true` and a Remix.Camera prompt template.
- Generate calls refuse to run without `yes=true`.
- Generated responses use `results[].imageUrl` or `markdown` from the action response.
- No screenshots, transcripts, or images are mocked.
