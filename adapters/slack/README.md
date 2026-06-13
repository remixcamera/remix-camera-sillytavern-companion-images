# Slack Adapter

Slack has two deliverables:

- `remix-slack-tool.mjs`: reusable slash-command helpers for an existing Slack bot.
- `lily-slash-command-server.mjs`: a Lily proof-of-concept slash-command server.

## Reusable Tool

```js
import { createRemixSlackTool } from "./adapters/slack/remix-slack-tool.mjs";

const remix = createRemixSlackTool({
  bridgeUrl: "http://127.0.0.1:8787",
  botToken: process.env.SLACK_BOT_TOKEN,
  characterName: "Lily",
  profileId: process.env.REMIX_PROFILE_ID,
});

const result = await remix.handleSlashCommand(slackSlashCommandPayload);
```

For an existing bot that already owns acknowledgement and delivery, route first and disable automatic sending:

```js
if (remix.shouldHandleSlashCommand(slackSlashCommandPayload)) {
  const details = await remix.handleSlashCommandDetailed(slackSlashCommandPayload, {
    autoSend: false,
  });
  await yourBot.postImages(details.result.imageUrls);
}
```

The tool parses slash-command text such as:

```text
selfie cozy couch with lamp light
preview date quiet restaurant booth
couple yes coffee shop booth with me
snap yes warm bedroom mirror snap
```

Couple, vacation, and private commands require explicit `yes` before any generation request is sent to the bridge.

## Lily Proof Of Concept

```bash
SLACK_SIGNING_SECRET=... \
SLACK_BOT_TOKEN=xoxb-... \
REMIX_BRIDGE_URL=http://127.0.0.1:8787 \
node adapters/slack/lily-slash-command-server.mjs
```

Expose the server over HTTPS and point a Slack slash command, for example `/lily`, at:

```text
https://your-host.example/slack/commands
```

The proof server verifies Slack request signatures, acknowledges quickly, then posts the result back through Slack. Public production image URLs are sent as Slack image blocks. Local bridge image URLs are uploaded to Slack with `files.getUploadURLExternal` and `files.completeUploadExternal` when `SLACK_BOT_TOKEN` and the slash-command `channel_id` are available.

## Required Slack Scopes

For dry-run previews through `response_url`, no bot token is needed after the slash command is installed.

For generated images from a local bridge URL, grant the Slack app:

```text
commands
chat:write
files:write
```

Slack cannot fetch `127.0.0.1` bridge image URLs. Do not post local bridge URLs as image blocks; upload them as files or use public `productionImageUrl` values.
