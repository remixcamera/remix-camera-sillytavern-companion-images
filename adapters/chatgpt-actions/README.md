# ChatGPT Actions Adapter

This adapter turns the local Remix.Camera bridge into a Custom GPT Action. It is for a ChatGPT companion that already handles conversation and needs Remix.Camera image tools for selfies, outfit looks, couple photos, vacation sets, daily snaps, date photos, and private snaps.

Official OpenAI references:

- GPT Actions overview: https://developers.openai.com/api/docs/actions/introduction
- Getting started with GPT Actions: https://developers.openai.com/api/docs/actions/getting-started
- GPT Action authentication: https://developers.openai.com/api/docs/actions/authentication
- Production notes: https://developers.openai.com/api/docs/actions/production

## Routes

The bridge exposes a ChatGPT-specific schema:

```text
GET /chatgpt-actions/openapi.json
```

The schema points ChatGPT at namespaced action endpoints:

```text
GET  /chatgpt-actions/health
POST /chatgpt-actions/v1/tools/:command/dry-run
POST /chatgpt-actions/v1/tools/:command/generate
```

The OpenAPI document itself is public so it can be imported. The health and tool endpoints require:

```text
Authorization: Bearer $REMIX_ACTION_API_KEY
```

If `REMIX_ACTION_API_KEY` is not set, action calls return `428` and refuse to run. If the bearer token is wrong, action calls return `401`.

## Setup

1. Pair the bridge with Remix.Camera:

   ```bash
   npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=chatgpt-actions --no-start
   ```

2. Create a strong action key:

   ```bash
   openssl rand -hex 32
   ```

3. Expose the bridge over a public HTTPS URL with a tunnel or hosted wrapper, then start the bridge:

   ```bash
   REMIX_CONFIG_FILE=$HOME/.remix-camera/sillytavern-bridge.json \
   REMIX_ACTION_API_KEY=replace_with_strong_random_value \
   REMIX_ACTION_BASE_URL=https://your-public-bridge.example.com \
   node bridge/server.mjs
   ```

4. In the GPT editor, add an Action.

5. Import or paste:

   ```text
   https://your-public-bridge.example.com/chatgpt-actions/openapi.json
   ```

6. Set Authentication to API Key, set Auth Type to Bearer, and paste the same `REMIX_ACTION_API_KEY`.

7. Test `sendSelfieDryRun` first. Only call a generate action when the user explicitly asks for an image and the action input includes `yes: true`.

## Suggested Custom GPT Instructions

```text
You are a companion chat agent with Remix.Camera image tools.

Use the dry-run actions first when planning an image. Dry-runs never spend credits and return the selected Remix.Camera prompt template.

Call generate actions only when the user explicitly asks for the image to be generated or sent. For generate actions, include yes=true. For couple-photo and couples-vacation, include userConsent="yes" only when the user explicitly consents to appear in the image. If the user uploads or links their own reference photo for a couple image, pass it as userReferenceImageUrl when available.

For SFW images, let the bridge use its default Nano route. For mature private snaps, set matureContent=true or use privateSnap so the bridge routes to the mature model.

When an action returns images, show the markdown or results[].imageUrl. Do not invent image URLs or claim an image was generated before the action returns successfully.
```

## Production Notes

- Keep the bridge behind HTTPS.
- Use a strong `REMIX_ACTION_API_KEY`.
- Rotate the action key if the tunnel URL or GPT is shared outside the intended test group.
- Keep `generate` actions gated by `yes=true`; preview actions are the default safe path.
- The bridge response rewrites ChatGPT action image markdown to public Remix.Camera image URLs when available, not local `127.0.0.1` proxy URLs.
