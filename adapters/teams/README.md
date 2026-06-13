# Microsoft Teams Adapter

The Teams adapter lets a Microsoft Teams bot or Bot Framework-style handler call the local Remix.Camera bridge and send generated companion images with `context.sendActivity(...)`.

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=teams
```

## Reusable Tool

```js
import { createRemixTeamsMessageHandler } from "./adapters/teams/remix-teams-tool.mjs";

bot.onMessage(
  createRemixTeamsMessageHandler({
    bridgeUrl: "http://127.0.0.1:8787",
    profileId: process.env.REMIX_PROFILE_ID,
    characterName: "Lily",
  }),
);
```

For an existing Teams bot, keep your own routing and send logic:

```js
const remix = createRemixTeamsTool({
  bridgeUrl: "http://127.0.0.1:8787",
  profileId: process.env.REMIX_PROFILE_ID,
  characterName: "Lily",
});

if (remix.shouldHandleActivity(context.activity)) {
  const details = await remix.handleTurnDetailed(context, { autoSend: false });
  for (const activity of remix.activities(details.result)) {
    await context.sendActivity(activity);
  }
}
```

The handler strips Teams mention markup such as `<at>Lily</at>` before parsing commands.

## Delivery Notes

Teams image attachments should use public HTTPS `contentUrl` values for reliable display. The adapter prefers `productionImageUrl` from the bridge. If only a local bridge URL is available, it sends a text warning instead of pretending Teams can fetch `127.0.0.1`.

Private snaps include conservative retention copy. Teams bots cannot force-delete delivered media; tenant retention and message deletion controls remain the source of truth.
