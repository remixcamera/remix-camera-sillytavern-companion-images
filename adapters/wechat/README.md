# Remix.Camera for WeChat Official Account

Use this adapter when a WeChat Official Account bot should add Remix.Camera companion-image commands.

Official surface: WeChat Official Account message callbacks plus customer-service messages. Image delivery uploads the generated file to temporary media, then sends an image customer-service message.

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=wechat
```

Reusable module:

```js
import { createRemixWeChatTool } from "./adapters/wechat/remix-wechat-tool.mjs";

const remix = createRemixWeChatTool({
  accessToken: process.env.WECHAT_ACCESS_TOKEN,
  bridgeUrl: process.env.REMIX_BRIDGE_URL || "http://127.0.0.1:8787",
  characterName: "Lily",
});

const details = await remix.handleWebhookDetailed(wechatXmlBody);
```

Lily proof-of-concept webhook:

```bash
WECHAT_ACCESS_TOKEN=... \
WECHAT_WEBHOOK_TOKEN=... \
REMIX_CONFIG_FILE=$HOME/.remix-camera/sillytavern-bridge.json \
node adapters/wechat/lily-webhook-server.mjs
```

Expose the server over HTTPS and set your Official Account callback URL to:

```text
https://your-host.example/wechat/webhook
```

The server supports WeChat's GET callback verification by validating `signature`, `timestamp`, and `nonce`, then returning `echostr`.

## Commands

Users can send:

```text
selfie cafe mirror selfie
preview selfie cozy couch with lamp light
date quiet restaurant booth
daily morning coffee on the couch
outfit https://example.com/outfit.jpg red sundress
couple yes coffee shop booth with me
vacation yes Amalfi coast weekend
snap yes warm bedroom mirror snap
```

`preview` is a dry-run and never spends credits. `couple`, `vacation`, and `snap` require the word `yes` before generation.

## Host Notes

- This adapter expects plaintext WeChat XML callbacks. If your Official Account uses encrypted callbacks, decrypt before passing the XML into `handleWebhookDetailed`.
- Customer-service messages are subject to WeChat's customer-service messaging rules and active-session window.
- Generated images are uploaded through the temporary media endpoint before the image customer-service message is sent.

## Official Docs

- https://developers.weixin.qq.com/doc/offiaccount/en/Message_Management/Service_Center_messages.html
- https://developers.weixin.qq.com/doc/offiaccount/en/Asset_Management/New_temporary_materials.html
