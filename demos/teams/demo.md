# Microsoft Teams Demo

## Setup

1. Run the Remix.Camera setup flow:

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=teams
```

2. Add `createRemixTeamsMessageHandler(...)` to a Teams bot message handler.
3. Start the local Remix.Camera bridge, then run your Teams bot with the normal Bot Framework or Teams SDK credentials.

## Demo Flow

1. Message the bot: `preview selfie cozy couch with lamp light`. Confirm Teams replies with the selected Remix.Camera template without spending credits.
2. Message the bot: `selfie cozy couch with lamp light`. Confirm Teams replies with a real image activity using a public HTTPS `contentUrl`.
3. Message the bot: `couple coffee shop booth`. Confirm the bot asks for explicit `yes` and does not call generation.
4. Message the bot: `couple yes coffee shop booth with me`. Confirm the bridge accepts the consented couple-photo flow.
5. Message the bot: `snap yes warm bedroom mirror snap`. Confirm Teams replies with the image plus conservative retention copy.

Record the real Teams conversation, bot handler logs, bridge logs, and attachment activity payload. Do not record a local harness as if it were a real Teams chat.

## Executable Evidence

Create no-spend bridge evidence for the Teams adapter:

```bash
npm run demo:verify -- --bridge-url=http://127.0.0.1:8787 --output-dir=demos/evidence
```

For a generated-image demo, use one command, add explicit `yes` where required, and cap the run at one generation unless intentionally recording a multi-image set.
