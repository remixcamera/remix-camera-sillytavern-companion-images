# Botpress Adapter

Botpress can call Remix.Camera through an Execute Code card or reusable Action that posts to the local bridge.

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=botpress
```

Use this helper as the implementation reference:

```text
adapters/botpress/remix-camera-botpress-action.js
```

In Botpress:

1. Add an Execute Code card or Action.
2. Store `REMIX_BRIDGE_URL` as `http://127.0.0.1:8787` when Botpress runs on the same machine.
3. Paste or adapt `botpressExecuteCodeSnippet`.
4. Store the returned `workflow.remixCameraText` and `workflow.remixCameraImageUrls`.
5. Send the text or image URLs in the next Botpress response card.

The helper defaults to dry-runs for previews. It only calls the bridge `generate` route when `yes=true` or `confirm=true`; set those only after explicit confirmation.

Cloud Botpress cannot call a user's local `127.0.0.1` bridge directly. Use self-hosted Botpress on the same machine/network, or expose the bridge through a private authenticated tunnel that only Botpress can reach.
