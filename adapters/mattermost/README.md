# Remix.Camera Mattermost Adapter

This adapter lets a Mattermost slash command, outgoing webhook, or existing bot server call the local Remix.Camera bridge and return AI companion images.

It uses official Mattermost integration surfaces:

- Slash commands: https://developers.mattermost.com/integrate/slash-commands/
- Outgoing webhooks: https://developers.mattermost.com/integrate/webhooks/outgoing/
- Incoming webhooks: https://developers.mattermost.com/integrate/webhooks/incoming/

## Files

- `remix-mattermost-tool.mjs`: reusable parser, bridge runner, token verifier, Mattermost response formatter, and incoming-webhook sender.

## Minimal Slash Command Server

```js
import express from "express";
import { createRemixMattermostTool } from "./adapters/mattermost/remix-mattermost-tool.mjs";

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

const tool = createRemixMattermostTool({
  bridgeUrl: process.env.REMIX_BRIDGE_URL || "http://127.0.0.1:8787",
  profileId: process.env.REMIX_PROFILE_ID,
  characterName: process.env.REMIX_CHARACTER_NAME || "Lily",
  expectedToken: process.env.MATTERMOST_TOKEN,
});

app.post("/mattermost/remix", async (req, res, next) => {
  try {
    const response = await tool.handleSlashCommand(req.body, { autoSend: false });
    res.json(response || { response_type: "ephemeral", text: tool.helpText() });
  } catch (error) {
    next(error);
  }
});

app.listen(process.env.PORT || 8788);
```

Create a Mattermost slash command that points to the HTTPS URL for this endpoint. Mattermost sends the command text, channel/user IDs, and a token; set `MATTERMOST_TOKEN` to the token Mattermost gives you.

## Existing Bot/Webhook Use

```js
import { createRemixMattermostTool } from "./adapters/mattermost/remix-mattermost-tool.mjs";

const remix = createRemixMattermostTool({
  bridgeUrl: "http://127.0.0.1:8787",
  profileId: "your_remix_profile_id",
  characterName: "Lily",
  expectedToken: process.env.MATTERMOST_TOKEN,
});

const details = await remix.handleWebhookDetailed(mattermostPayload, { autoSend: false });
if (details.handled) {
  return details.responsePayload;
}
```

For async delivery, provide `webhookUrl` for a Mattermost incoming webhook and let `sendMattermostRemixResult` post the formatted message.

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

- Verify the Mattermost token before processing the request.
- Keep the bridge credential server-side; never put `REMIX_SESSION_TOKEN` in Mattermost.
- Mattermost image attachments must use public HTTPS image URLs. The adapter uses `productionImageUrl` and refuses to post local bridge image URLs as broken images.
- Mattermost cannot guarantee automatic deletion of already-delivered private media, so private snap copy stays conservative.
