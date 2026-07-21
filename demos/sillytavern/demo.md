# SillyTavern Demo

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=sillytavern
```

## Demo Flow

1. Approve the Remix.Camera device code in the browser.
2. Import the downloaded Lily character card, or open an existing character and set the Remix.Camera profile in the extension panel.
3. Open `Extensions -> Remix.Camera Companion Images`.
4. Click `Health Check`.
5. Click `Preview Prompt` for a couch or cafe selfie.
6. Click `Selfie`, then `Date`, then `Vacation` with user consent.

## Live Production Recording

The checked-in live production proof is:

```text
demos/sillytavern/live-production-2026-06-12/sillytavern-remix-live-selfie-demo.webm
demos/sillytavern/live-production-2026-06-12/sillytavern-remix-live-selfie-demo-poster.png
demos/sillytavern/live-production-2026-06-12/result.json
```

It was recorded with:

```bash
SILLYTAVERN_ROOT=/path/to/SillyTavern \
REMIX_SILLYTAVERN_E2E_CHARACTER_CARD=lily-remix-visual \
npm run test:browser:live -- --yes --commands=send-selfie --max-generations=1
```

## Sophie Setup-to-Output Marketing Walkthrough

The current landing-page walkthrough is:

```text
demos/sillytavern/sophie-setup-2026-07-21/sophie-setup-to-output.mp4
demos/sillytavern/sophie-setup-2026-07-21/sophie-setup-hero.png
demos/sillytavern/sophie-setup-2026-07-21/sophie-character-setup.png
demos/sillytavern/sophie-setup-2026-07-21/sophie-mirror-selfie-output.png
demos/sillytavern/sophie-setup-2026-07-21/narrated-tutorial-storyboard.md
```

This is a real SillyTavern UI recording with live bridge Health Check and no-credit Preview Prompt steps. It replays a previously approved production Sophie output in chat and submitted zero new generations during the recording. The demo sender is Billy.

## Proof Points

- The extension panel auto-fills character metadata from the card or settings.
- Preview shows the selected Remix.Camera prompt template and does not spend credits.
- Generated images insert into chat as real image messages from the local bridge.
- Couple and vacation flows require explicit consent and can include a user reference photo.
- The live recording uses `mode: browser-e2e-live-remix-api`, `modelId: nano-banana`, and exactly one production generation.
