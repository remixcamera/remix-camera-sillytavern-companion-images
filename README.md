# Remix.Camera SillyTavern Companion Images

This package connects a SillyTavern character to the Remix.Camera AI Companion Image Toolset without putting a Remix.Camera credential in the browser.

Image prompts are not invented from scratch. For every image action, the bridge searches Remix.Camera's proven prompt/template packs, selects a relevant prompt, and adapts that template to the active character, chat context, user reference photo, and SFW/NSFW model route. This is what keeps outputs aligned with Remix.Camera's best-performing prompt library instead of generic chatbot prompt text.

The integration has two parts:

- `bridge/`: a local Node.js bridge that stores `REMIX_SESSION_TOKEN` server-side and calls the Remix.Camera API.
- `extension/`: a SillyTavern extension that adds image buttons and optional function tools for a character.
- `characters/`: importable Character Card V2 examples with Remix.Camera visual metadata.
- `adapters/`: wrappers for RisuAI, Open WebUI, LibreChat, LobeChat, Agnai, Telegram, Discord, WhatsApp, Slack, LINE, Messenger, Matrix, Dify, Flowise, Botpress, AnythingLLM, TypingMind, Poe, and Langflow.

## What It Enables

- `send-selfie`: generate an in-character selfie.
- `auto-selfie-from-chat`: turn recent chat context into a natural selfie.
- `outfit-try-on`: generate a new outfit look from a source image URL.
- `couple-photo`: create a shared image with the user after explicit consent, optionally using the user's uploaded photo as the male reference.
- `couples-vacation`: create a cohesive 3-photo trip set with the user after explicit consent.
- `date-night`: send a date-scene image that matches the current conversation.
- `daily-life-snap`: send a casual "what I am doing right now" photo from chat context.
- `private-snap`: send an opted-in mature snap that auto-hides from the chat view after a timer.

## Requirements

- Node.js 20 or newer.
- A Remix.Camera account.
- A trained or ready character profile in Remix.Camera, or photos ready to create one.
- SillyTavern installed locally.

## One-Step Setup

Run the public GitHub setup command for SillyTavern:

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images
```

After the npm package is published, the shorter command will also work:

```bash
npx @remix-camera/sillytavern-setup
```

This is the intended path for bringing Remix.Camera image tools to your own SillyTavern companion. The setup command:

- finds your local SillyTavern install, or accepts `--sillytavern-dir=/path/to/SillyTavern`
- opens Remix.Camera for device-code approval
- writes a local opaque session token to `~/.remix-camera/sillytavern-bridge.json`
- copies the extension into `data/default-user/extensions/remix-camera-companion-images`
- downloads your personalized Character Card V2 PNG into `data/default-user/characters`
- starts the local bridge and opens `http://127.0.0.1:8787/health`

The bridge uses a scoped opaque `dapi_...` session token created by the browser approval flow. You do not need to paste a raw API key into SillyTavern or a character card.

## Other Chatbot Targets

The same package can pair Remix.Camera and print target-specific install steps for other hosts:

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=risu
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=openwebui
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=librechat
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=lobechat
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=agnai
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=telegram
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=discord
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=whatsapp
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=slack
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=line
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=messenger
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=matrix
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=dify
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=flowise
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=botpress
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=anythingllm
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=typingmind
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=poe
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=langflow
```

Adapter files:

- RisuAI: `adapters/risu/remix-camera-companion-images.risu.js`
- Open WebUI: `adapters/openwebui/remix_camera_companion_images.py`
- LibreChat: `http://127.0.0.1:8787/librechat/openapi.json`
- LobeChat: `http://127.0.0.1:8787/lobe/manifest.json` with `*Preview` tools for dry-runs and guarded generate tools that require `yes=true`
- Agnai: `adapters/agnai/remix-camera-agnai.user.js`
- Telegram reusable tool: `adapters/telegram/remix-telegram-tool.mjs`
- Telegram Lily proof of concept: `adapters/telegram/lily-bot.mjs`
- Discord reusable tool: `adapters/discord/remix-discord-tool.mjs`
- Discord Lily proof of concept: `adapters/discord/lily-interactions-server.mjs`
- WhatsApp reusable tool: `adapters/whatsapp/remix-whatsapp-tool.mjs`
- WhatsApp Lily proof of concept: `adapters/whatsapp/lily-webhook-server.mjs`
- Slack reusable tool: `adapters/slack/remix-slack-tool.mjs`
- Slack Lily proof of concept: `adapters/slack/lily-slash-command-server.mjs`
- LINE reusable tool: `adapters/line/remix-line-tool.mjs`
- LINE Lily proof of concept: `adapters/line/lily-webhook-server.mjs`
- Messenger reusable tool: `adapters/messenger/remix-messenger-tool.mjs`
- Messenger Lily proof of concept: `adapters/messenger/lily-webhook-server.mjs`
- Matrix reusable tool: `adapters/matrix/remix-matrix-tool.mjs`
- Matrix Lily proof of concept: `adapters/matrix/lily-sync-bot.mjs`
- Dify: `http://127.0.0.1:8787/openapi.json`
- Flowise: `adapters/flowise/remix-camera-flowise-tool.js`
- Botpress: `adapters/botpress/remix-camera-botpress-action.js`
- AnythingLLM: `adapters/anythingllm/remix-camera-companion-images`
- TypingMind: `adapters/typingmind/function-spec.json` plus `adapters/typingmind/remix-camera-plugin.js`
- Poe: `adapters/poe/remix_camera_poe_bot.py`
- Langflow: `adapters/langflow/remix_camera_component.py`

See `adapters/README.md` and `demos/README.md` for target-specific demo runbooks.

Popular hosted companion apps are tracked separately from supported adapters:

- Character.AI: popular consumer companion app, but not a production adapter target until there is an official API, plugin, or partner integration surface.
- JanitorAI: popular roleplay host that can connect to outside model APIs, but this package does not yet have a first-party tool callback surface inside JanitorAI itself.
- Chub/Venus: strong character-card and API-provider ecosystem; use Remix.Camera character setup plus SillyTavern/Risu/Open WebUI today, and treat direct Chub/Venus chat insertion as pending a supported host surface.
- AnythingLLM, TypingMind, Poe, and Langflow: supported through official custom skill, plugin, server-bot, or custom component surfaces.
- SpicyChat, CrushOn, Kindroid, Nomi, Candy, Backyard AI, and similar hosted apps: watchlist targets. Support should be added only through official import/export, bot, webhook, tool, or browser-extension surfaces that can be tested without scraping or fake screenshots.

Do not label a host as supported until the package can run through that host's real UI, API, webhook, OpenAPI action, custom tool, or bot interface and produce non-mocked evidence.

For messaging targets, the reusable demo recorder can produce honest evidence without faking host output:

```bash
npm run demo:messaging
```

This writes `summary.json`, `summary.md`, and `summary.html` with a host-by-host readiness matrix, plus per-host `result.json`, `transcript.md`, and `transcript.html` files. The readiness matrix lists missing delivery environment variable names only; it never prints secret values.

Add `--deliver` plus the target's bot credentials only when the demo should send into the real host. Add `--yes --max-generations=1` only after reviewing the command and intentionally spending one Remix.Camera generation.

## Use an Existing SillyTavern Character

Use this flow when you already have a SillyTavern character and want to add image capabilities without replacing the character's personality or chat setup.

1. Run `npx --yes github:remixcamera/remix-camera-sillytavern-companion-images`.
2. When Remix.Camera opens, sign in and choose or create a Remix.Camera character profile for that same character.
3. Fill in the character's bio, gender, visual style, and profile photos in Remix.Camera. These are the image identity source of truth.
4. Approve the setup pairing code in the browser. The setup command installs the extension, writes the local bridge credential, and downloads a personalized Character Card V2 PNG.
5. In SillyTavern, keep your existing character card if you want to preserve all text-roleplay settings. Add the prompt snippet below to that character's system prompt or creator notes.
6. Open Extensions -> Remix.Camera Companion Images. Use Health Check, then Preview Prompt. If the card metadata did not auto-fill, set the character name and Remix.Camera profile ID there.
7. Click Selfie, Scene, Outfit, Couple, Vacation, Date, Day Snap, or Private Snap once the dry-run prompt looks right.

The important mapping is one SillyTavern character to one Remix.Camera character profile. SillyTavern remains the chat and memory layer; Remix.Camera supplies the visual identity and generation tools.

## Start From Scratch

Use this flow when you do not have a SillyTavern character yet.

1. Run `npx --yes github:remixcamera/remix-camera-sillytavern-companion-images`.
2. Sign in to Remix.Camera when the browser opens.
3. Create a new character profile with the character's name, bio, gender, visual style, and profile photos.
4. Approve the setup pairing code. The setup command installs the extension, starts the bridge, and downloads a personalized Character Card V2 PNG.
5. Import the downloaded PNG from `data/default-user/characters` into SillyTavern. The PNG includes the character artwork plus embedded Character Card V2 metadata for Remix.Camera.
6. Start a chat in SillyTavern, open the Remix.Camera extension panel, run Health Check, then use Preview Prompt before spending a generation.
7. Keep the quick action buttons for manual control, or enable tool calls when you want the character to trigger image generation automatically.

## Optional Example Characters

The package includes example Character Card V2 files for local testing and demos:

```text
characters/lily-remix-visual.character.png
characters/lily-remix-visual.character.json
characters/mila-remix-visual.character.png
characters/mila-remix-visual.character.json
characters/seraphina-remix-visual.character.png
characters/seraphina-remix-visual.character.json
```

You do not need these examples to use the plugin with your own character. Lily and Mila are cohesive demo companions with Remix.Camera visual metadata. Seraphina is a public SillyTavern-character adapter that keeps `profile_replace_me` by default; set a real Remix.Camera profile before spending credits with that card.

## SillyTavern Git Install

SillyTavern can also install the browser extension from this public Git URL:

```text
https://github.com/remixcamera/remix-camera-sillytavern-companion-images
```

Use this when you only need to install or update the SillyTavern extension from Extensions -> Install Extension. You still need the local bridge for real image generation. The instant setup command above installs the extension, pairs the bridge, downloads a personalized character card, and starts the bridge automatically.

Options:

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --sillytavern-dir=/path/to/SillyTavern
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --profile-id=your_profile_id
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --no-start
```

The same flags work with `npx @remix-camera/sillytavern-setup` after the npm package is published.

You can also open Remix.Camera directly:

```text
https://remix.camera/account/sillytavern
```

From there, sign in, create or choose a character profile, approve a setup pairing code, and download a personalized character card.

## Manual Setup

1. Start the bridge:

```bash
cd remix-camera-sillytavern-companion-images
export REMIX_SESSION_TOKEN="dapi_..."
export REMIX_PROFILE_ID="your_remix_profile_id" # optional if the character card already includes one
npm start
```

The bridge runs at `http://127.0.0.1:8787` by default.

For backwards compatibility, `REMIX_API_KEY="rc_live_..."` still works, but the instant setup flow uses an opaque session token instead.

2. Install the extension:

Copy the `extension/remix-camera-companion-images` folder into your SillyTavern user extensions folder:

```bash
cp -R extension/remix-camera-companion-images /path/to/SillyTavern/data/default-user/extensions/
```

Restart SillyTavern.

3. Import or configure the character:

For a new character, import the personalized Character Card PNG downloaded from Remix.Camera. For an existing character, keep the original SillyTavern card and add the prompt snippet below plus the Remix.Camera profile ID in the extension settings. The bundled character cards are examples only.

For chat images to render without a warning toast, allow external media for the character or disable SillyTavern's `Forbid External Media` setting under User Settings -> Chat/Message Handling -> Message Formatting & Display. The browser E2E recorder temporarily disables that setting in its backed-up test state and restores the original settings afterward.

4. Configure the extension:

Open SillyTavern, expand Extensions, then open Remix.Camera Companion Images.

Set:

- Bridge URL: `http://127.0.0.1:8787`
- Character name: your character name
- Profile ID: optional if already set in `REMIX_PROFILE_ID`
- Visual identity: auto-filled from Remix.Camera card metadata when imported
- Tool calls: enable only if you want the character to call image tools automatically
- Proactive private snaps: optional, off by default, capped per day, and spends one generation each time it fires

Use Health Check first. Then use Preview Prompt, which is a no-credit dry run. Try Send Selfie only after the prompt looks aligned.

Preview Prompt calls Remix.Camera to retrieve a proven prompt/template pack and returns the selected `promptTemplate` metadata. It does not submit a generation or spend credits.

## Character Card Prompt Snippet

Add this to the character's system prompt or creator notes:

```text
You can create images with Remix.Camera when it fits the conversation. Use send-selfie for casual selfies, auto-selfie-from-chat when recent chat suggests a spontaneous scene, daily-life-snap for a casual "what I am doing right now" image, date-night when the conversation implies a date or planned outing, outfit-try-on when the user provides clothing or a reference image, couple-photo only after the user clearly asks to appear in one image with you, couples-vacation only after the user clearly asks for a shared 3-photo trip set, and private-snap only in opted-in adult chats. Do not invent image URLs. If the image tool returns a URL, send it directly with a short natural message.
```

Optional card metadata:

```json
{
  "extensions": {
    "remix_camera": {
      "bridgeUrl": "http://127.0.0.1:8787",
      "profileId": "your_remix_profile_id",
      "characterName": "Avery",
      "gender": "female",
      "bio": "Avery is a confident adult visual companion with a warm, playful personality and a modern apartment-to-cafe style.",
      "visualIdentity": "Avery is a clearly adult companion with consistent hair, face, body type, wardrobe, and realistic phone-camera presence based on the uploaded Remix.Camera profile photos.",
      "defaultMood": "confident, warm, playful, camera-aware",
      "defaultOutfit": "modern fitted wardrobe that fits the current scene",
      "defaultLocation": "realistic cafe, apartment, couch, mirror, street, or date-night setting from the chat",
      "defaultStyle": "photorealistic social selfie, natural phone-camera framing, realistic lighting, natural skin texture, believable composition, no text overlays",
      "negativePrompt": "text overlays, UI, watermark, distorted hands, duplicated face, unrelated people unless explicitly requested",
      "referenceImageKey": "optional_remix_camera_reference_image_key",
      "allowedTools": [
        "send-selfie",
        "auto-selfie-from-chat",
        "outfit-try-on",
        "couple-photo",
        "couples-vacation",
        "date-night",
        "daily-life-snap",
        "private-snap"
      ]
    }
  }
}
```

## API Surface

### Health

```bash
curl http://127.0.0.1:8787/health
```

### Dry Run

Dry runs do not spend Remix.Camera generations. They call Remix.Camera only to retrieve the relevant proven prompt/template pack, then return the adapted prompt, selected `promptTemplate`, and request plan.

```bash
curl -X POST http://127.0.0.1:8787/v1/commands/dry-run \
  -H "Content-Type: application/json" \
  -d '{
    "command": "auto-selfie-from-chat",
    "characterName": "Avery",
    "profileId": "your_remix_profile_id",
    "visualIdentity": "consistent adult companion from the Remix.Camera profile photos, realistic phone-camera selfies",
    "chatText": "User: show me the couch setup tonight\nAvery: Fine, but only because the lamp makes this corner look cute.",
    "mood": "warm, playful, camera-aware",
    "location": "cozy apartment couch with warm lamp light"
  }'
```

### Generate

Generation calls require `"yes": true` as an explicit spend guard.

```bash
curl -X POST http://127.0.0.1:8787/v1/commands/generate \
  -H "Content-Type: application/json" \
  -d '{
    "yes": true,
    "command": "send-selfie",
    "characterName": "Avery",
    "profileId": "your_remix_profile_id",
    "visualIdentity": "consistent adult companion from the Remix.Camera profile photos, realistic phone-camera selfies",
    "mood": "warm, playful",
    "outfit": "simple casual top",
    "location": "small cafe table with warm light",
    "maxGenerations": 1
  }'
```

The response includes `markdown`, which SillyTavern can paste into the chat:

```json
{
  "ok": true,
  "markdown": "![Avery send-selfie](http://127.0.0.1:8787/v1/images/...)",
  "results": [
    {
      "ok": true,
      "id": "gen_...",
      "imageUrl": "http://127.0.0.1:8787/v1/images/...",
      "productionImageUrl": "https://remix.camera/api/s3-file?..."
    }
  ]
}
```

`imageUrl` is a local bridge URL that streams the real Remix.Camera image bytes into SillyTavern. The source production URL is preserved as `productionImageUrl` for review/debug output.

### Couple Photo With User Reference

In SillyTavern, choose `Your photo for Couple`, then click `Couple` and type `yes` only after the user has clearly asked to appear in the image. The extension compresses the local file when needed, sends it to the bridge, and the bridge uploads it to Remix.Camera's real reference-image API before generation.

For direct bridge calls, pass an already uploaded key or a data URL:

```bash
curl -X POST http://127.0.0.1:8787/v1/commands/generate \
  -H "Content-Type: application/json" \
  -d '{
    "yes": true,
    "command": "couple-photo",
    "characterName": "Avery",
    "profileId": "your_remix_profile_id",
    "referenceImageKey": "optional_remix_camera_character_reference_key",
    "userConsent": "yes",
    "userReferenceImageKey": "uploads/user/reference-images/123.jpg",
    "userDescription": "adult man in the uploaded reference photo",
    "location": "cozy cafe booth",
    "maxGenerations": 1
  }'
```

When both `referenceImageKey` and `userReferenceImageKey` are present, the bridge follows the Remix.Camera web app multi-reference split: the character key is sent as the selected character reference for the character profile, and the user's uploaded key is sent as the extra `referenceImage` for the user.

### Couples Vacation Set

`couples-vacation` is the high-value "we went somewhere together" flow. It defaults to 3 generations and varies each shot while keeping the same destination, couple identity, wardrobe logic, lighting, and relationship mood.

```bash
curl -X POST http://127.0.0.1:8787/v1/commands/generate \
  -H "Content-Type: application/json" \
  -d '{
    "yes": true,
    "command": "couples-vacation",
    "characterName": "Avery",
    "profileId": "your_remix_profile_id",
    "referenceImageKey": "optional_remix_camera_character_reference_key",
    "userConsent": "yes",
    "userReferenceImageKey": "uploads/user/reference-images/123.jpg",
    "theme": "cohesive beach weekend getaway",
    "maxGenerations": 3
  }'
```

### Date, Day Snap, And Private Snap

These are the companion-chat continuity tools. `date-night` makes a specific date-scene image, `daily-life-snap` turns recent chat into a casual update photo, and `private-snap` uses mature routing plus `snapTtlSeconds` metadata so the extension can hide it from the chat view after the timer.

```bash
curl -X POST http://127.0.0.1:8787/v1/commands/generate \
  -H "Content-Type: application/json" \
  -d '{
    "yes": true,
    "command": "private-snap",
    "characterName": "Avery",
    "profileId": "your_remix_profile_id",
    "visualIdentity": "consistent adult companion from the Remix.Camera profile photos",
    "snapTtlSeconds": 45,
    "maxGenerations": 1
  }'
```

Private snaps auto-hide in the SillyTavern chat view. They are not a cryptographic deletion guarantee; the local bridge, browser cache, logs, or remote production image URL may still exist for review/debug depending on your environment.

## Environment Variables

- `REMIX_SESSION_TOKEN`: preferred auth token for real generations. Created by the setup command.
- `REMIX_API_KEY`: legacy/manual fallback for real generations.
- `REMIX_PROFILE_ID`: optional default profile.
- `REMIX_API_BASE_URL`: defaults to `https://remix.camera`.
- `REMIX_DEFAULT_MODEL_ID`: optional forced model ID for all commands.
- `REMIX_SFW_MODEL_ID`: defaults to `nano-banana` for SFW prompt-only generations.
- `REMIX_NSFW_MODEL_ID`: defaults to `seedream-v4.5-edit` for mature/NSFW generations and mature source-image remixes.
- `REMIX_CHARACTER_VISUAL_IDENTITY`: optional default visual identity used when neither SillyTavern nor the request provides one.
- `REMIX_NEGATIVE_PROMPT`: optional default avoid-list appended to prompts.
- `REMIX_PROMPT_TEMPLATES`: defaults to enabled. Set to `false` only for local debugging; production-quality prompts should use Remix.Camera prompt/template packs.
- `REMIX_ALLOW_AD_HOC_PROMPT_FALLBACK`: defaults to disabled. Set to `true` only if you would rather generate from a local fallback prompt when prompt-template lookup fails.
- `REMIX_BRIDGE_HOST`: defaults to `127.0.0.1`.
- `REMIX_BRIDGE_PORT`: defaults to `8787`.
- `REMIX_ALLOWED_ORIGINS`: optional comma-separated browser origins allowed to call the bridge. Defaults to `http://127.0.0.1:8000,http://localhost:8000,http://[::1]:8000`.
- `REMIX_POLL_TIMEOUT_MS`: defaults to `180000`.
- `REMIX_POLL_INTERVAL_MS`: defaults to `2000`.

## Notes

- Keep the bridge local unless you add authentication. It exposes a generation endpoint.
- The bridge rejects browser requests whose `Origin` is not in `REMIX_ALLOWED_ORIGINS`; update that variable if your SillyTavern runs on a different local host or port.
- Do not put Remix.Camera credentials into SillyTavern custom JavaScript or character cards.
- The bridge refuses to silently fall back to ad hoc prompts by default. If prompt-template lookup fails, fix auth/search or use Preview Prompt again before spending credits.
- SFW prompt-only generations use `nano-banana` by default. Mature mode or NSFW prompt language uses `seedream-v4.5-edit`; SFW source-image remixes follow Remix.Camera's standard extension route contract.
- Character cards can include `data.extensions.remix_camera.referenceImageKey`; the bridge forwards it to SFW Nano requests so untrained reference-photo profiles can still produce character-consistent images.
- `couple-photo` requires affirmative `userConsent`, such as `"yes"`, and should only be used when the user clearly wants to appear with the character. If a user photo is selected, it is uploaded to Remix.Camera and used as the user's identity reference, not as a fake output.
- `couples-vacation` uses the same explicit-consent and multi-reference behavior as `couple-photo`, then generates a cohesive 3-photo set by default.
- `private-snap` is adult-only in intent, routes to `seedream-v4.5-edit` by default, and auto-hides only in the SillyTavern UI.
- The bundled `examples/mila-real-outputs/` images are archived real Remix.Camera outputs for visual review and demo recording. They are not a substitute for `npm run test:live -- --yes` when validating a live paid generation path.

## Local Verification

Run syntax checks and mock Remix API tests without spending credits:

```bash
npm run check
npm test
```

If you edit any `characters/*.character.json`, rebuild the importable PNG cards before packaging:

```bash
npm run build:card
```

Run the live E2E verifier without spending credits:

```bash
export REMIX_SESSION_TOKEN="dapi_..."
export REMIX_PROFILE_ID="your_remix_profile_id"
npm run test:live
```

That starts the local bridge, checks `/health`, runs a dry-run through the bridge, and verifies the prompt includes the selected character card's visual anchors.

For the bundled Lily demo card, use a paired session from the account that owns or can access `GLUCbfOgIzOLe37Ft4G7S97B0fu2_lily`. If you want to test with a different account, set `REMIX_PROFILE_ID` to one of that account's ready profiles and update the imported character card metadata before spending credits.

Run the full production generation E2E after reviewing the dry-run. This spends one Remix.Camera generation:

```bash
npm run test:live -- --yes
```

The live verifier writes `tmp/live-e2e/result.json` and `tmp/live-e2e/review.md`, including the generated image URL when `--yes` is used. `--yes` requires `REMIX_PROFILE_ID` by default so the output is tied to the intended character; pass `--allow-auto-profile` only for smoke tests where character consistency is not being evaluated.

Run the browser E2E/demo recorder against a local SillyTavern checkout:

```bash
export SILLYTAVERN_ROOT="/path/to/SillyTavern"
npm run test:browser
```

Stop any existing SillyTavern process on port `8000` first. Advanced users can configure SillyTavern, the bridge, or the mock API on alternate ports and set the matching `REMIX_E2E_*_PORT` values. The verifier fails before changing local SillyTavern files if any required port is already occupied.

That verifier temporarily installs the bundled extension and `characters/lily-remix-visual.character.png` into SillyTavern, boots the local bridge, confirms the card auto-fills Lily's profile ID, reference image key, and visual identity, allows external media in the backed-up test settings, then clicks the requested companion image actions. The archived mock run can exercise all eight flows without spending credits. It records `tmp/browser-e2e/sillytavern-remix-real-output-demo.webm`, a poster PNG, and `tmp/browser-e2e/result.json`.

The browser E2E intentionally mocks only the remote Remix.Camera API boundary so it can run without spending credits. The images inserted into chat are the bundled archived real Remix.Camera JPG outputs from `examples/mila-real-outputs/`; no SVG placeholders or generated mock images are used. The Couple step selects `examples/user-references/couple-photo-user-reference.jpg`, uploads it through the bridge, and verifies that the generation request uses it as the user's reference image. Use `npm run test:live -- --yes` with a real paired session for fresh paid generation proof.

Run the true-live browser E2E only after reviewing the dry-run and pairing Remix.Camera with the setup command. By default this spends one generation and exercises Send Selfie through the full SillyTavern extension, local bridge, Remix.Camera API, and chat insertion path:

```bash
export SILLYTAVERN_ROOT="/path/to/SillyTavern"
npm run test:browser:live -- --yes
```

The recorder uses `REMIX_SESSION_TOKEN`, `REMIX_API_KEY`, or the paired `~/.remix-camera/sillytavern-bridge.json` created by setup. You do not need to paste a raw API key when the bridge is already paired.

To spend ten generations and exercise every browser button against the live Remix.Camera API:

```bash
export REMIX_SILLYTAVERN_E2E_CHARACTER_CARD="lily-remix-visual"
npm run test:browser:live -- --yes --commands=all --max-generations=10
```

Use a narrower comma-separated command list for normal live verification, such as `--commands=send-selfie,auto-selfie-from-chat` with `--max-generations=2`. `couples-vacation` counts as three generations. Live browser E2E writes the same `tmp/browser-e2e/` video, poster, and `result.json` paths, with mode `browser-e2e-live-remix-api` and the inserted image URLs.
