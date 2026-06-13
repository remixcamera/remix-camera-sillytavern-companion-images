# WeChat Official Account Demo

This demo shows a WeChat Official Account adding Remix.Camera companion-image commands through message callbacks and customer-service replies.

## One-Step Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=wechat
```

The setup command pairs the local Remix.Camera bridge and prints the WeChat adapter path.

## Run Lily Proof Bot

```bash
WECHAT_ACCESS_TOKEN=... \
WECHAT_WEBHOOK_TOKEN=... \
REMIX_CONFIG_FILE=$HOME/.remix-camera/sillytavern-bridge.json \
node adapters/wechat/lily-webhook-server.mjs
```

Expose the server over HTTPS and set your WeChat Official Account callback URL to:

```text
https://your-host.example/wechat/webhook
```

## Demo Script

1. Configure the callback URL and complete WeChat's GET verification challenge.
2. Open the Official Account conversation.
3. Send `help`.
4. Send `preview selfie cozy couch with lamp light`.
5. Confirm the dry-run preview contains a Remix.Camera prompt/template and does not spend credits.
6. Send `selfie cozy couch with lamp light`.
7. Confirm the bot uploads the generated image to WeChat temporary media and sends an image customer-service message.
8. Send `vacation Amalfi coast weekend` and confirm it asks for explicit `yes`.
9. Send `vacation yes Amalfi coast weekend` and confirm up to three images are delivered.

## Expected Evidence

- WeChat callback signature is verified.
- `createRemixWeChatTool` handles plaintext XML text callbacks.
- `handleWebhookDetailed` returns `handled: true`.
- Generated images are uploaded with the media upload endpoint before image messages are sent.
- No local bridge URLs are posted directly to the user.

## Recording Status

This runbook is demo-ready once a verified Official Account, access token, and public callback URL are configured. Until then, bridge-backed verifier output is engineering evidence only, not a public WeChat host recording.
