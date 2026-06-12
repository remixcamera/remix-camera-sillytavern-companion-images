# SillyTavern Live Production Demo

This folder contains a real production screen recording captured from the local SillyTavern extension flow.

## Artifact

- `sillytavern-remix-live-selfie-demo.webm`: screen recording
- `sillytavern-remix-live-selfie-demo-poster.png`: poster frame
- `result.json`: structured verification metadata

## What Was Verified

- SillyTavern 1.12.0 loaded the Lily Character Card V2 PNG.
- The Remix.Camera extension auto-hydrated Lily's profile ID and visual identity.
- The local bridge called `https://remix.camera`.
- The extension inserted the returned production image into the SillyTavern chat.
- The run spent exactly one generation with `--max-generations=1`.
- The generated image used `modelId: nano-banana` for the SFW selfie request.
- Browser console issue count was zero.

## Command

```bash
SILLYTAVERN_ROOT=/Users/adamhalper/SillyTavern-Launcher/SillyTavern \
REMIX_SILLYTAVERN_E2E_CHARACTER_CARD=lily-remix-visual \
npm run test:browser:live -- --yes --commands=send-selfie --max-generations=1
```

The recorder used the paired Remix.Camera session in `~/.remix-camera/sillytavern-bridge.json`; no raw API key was placed in SillyTavern or the character card.
