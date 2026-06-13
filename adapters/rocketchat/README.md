# Remix.Camera Rocket.Chat Adapter

This adapter lets a Rocket.Chat outgoing integration, slash-command app, or existing bot server call the local Remix.Camera bridge and post AI companion images back through Rocket.Chat.

It uses official Rocket.Chat surfaces:

- REST API overview: https://developer.rocket.chat/apidocs
- `chat.postMessage`: https://developer.rocket.chat/apidocs/post-message
- `chat.sendMessage`: https://developer.rocket.chat/apidocs/send-message
- Apps-Engine slash-command docs: https://developer.rocket.chat/docs/search

## Files

- `remix-rocketchat-tool.mjs`: reusable parser, bridge runner, token verifier, REST delivery helper, and Rocket.Chat message formatter.

## Minimal Outgoing Integration Server

```js
import express from "express";
import { createRemixRocketChatTool } from "./adapters/rocketchat/remix-rocketchat-tool.mjs";

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const tool = createRemixRocketChatTool({
  bridgeUrl: process.env.REMIX_BRIDGE_URL || "http://127.0.0.1:8787",
  profileId: process.env.REMIX_PROFILE_ID,
  characterName: process.env.REMIX_CHARACTER_NAME || "Lily",
  expectedToken: process.env.ROCKETCHAT_WEBHOOK_TOKEN,
  serverUrl: process.env.ROCKETCHAT_URL,
  authToken: process.env.ROCKETCHAT_AUTH_TOKEN,
  userId: process.env.ROCKETCHAT_USER_ID,
});

app.post("/rocketchat/remix", async (req, res, next) => {
  try {
    const response = await tool.handleWebhook(req.body, { autoSend: false });
    res.json(response || { text: tool.helpText() });
  } catch (error) {
    next(error);
  }
});

app.listen(process.env.PORT || 8788);
```

Configure a Rocket.Chat outgoing integration with trigger words such as `selfie`, `date`, `daily`, `couple`, `vacation`, `snap`, and `preview`, and point it at your HTTPS endpoint.

## REST Delivery

For a bot that posts asynchronously, set:

```bash
ROCKETCHAT_URL=https://chat.example.com
ROCKETCHAT_AUTH_TOKEN=...
ROCKETCHAT_USER_ID=...
ROCKETCHAT_ROOM_ID=...
```

The adapter posts to `/api/v1/chat.postMessage` using `X-Auth-Token` and `X-User-Id` headers.

## Commands

```text
selfie cafe mirror selfie
date quiet restaurant booth
daily morning coffee on the couch
outfit https://example.com/outfit.jpg red sundress
couple yes coffee shop booth with me
vacation yes Amalfi coast weekend
snap yes warm bedroom mirror snap
preview selfie cozy couch with lamp light
```

`preview` calls Remix.Camera dry-run routes and never spends credits. `couple`, `vacation`, and `snap` require the word `yes` before a generate call spends credits.

## Production Notes

- Verify the outgoing integration token before processing a request.
- Keep the Remix.Camera bridge credential server-side.
- Rocket.Chat attachments use public HTTPS `productionImageUrl` values. The adapter refuses to post local `127.0.0.1` bridge URLs as broken images.
- Private-snap copy is conservative because Rocket.Chat cannot guarantee automatic deletion of already-delivered media.
