# LangChain Demo Runbook

This demo adds Remix.Camera companion image tools to an existing LangChain JS bot.

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=langchain
```

Approve the Remix.Camera pairing code, then keep the local bridge running.

## Wire Into A Bot

```js
import { createAgent, tool } from "langchain";
import * as z from "zod";
import { createRemixCameraLangChainTools } from "../adapters/langchain/remix-camera-langchain-tools.mjs";

const remixTools = createRemixCameraLangChainTools({
  tool,
  z,
  bridgeUrl: "http://127.0.0.1:8787",
  characterName: "Lily",
});

const agent = createAgent({ model, tools: remixTools });
```

Ask the bot:

```text
Send me a cozy Lily selfie from the couch. Preview first.
```

The agent should call `remix_camera_send_selfie_preview`. After the user confirms generation, call `remix_camera_send_selfie_generate` with `yes: true`.

## Evidence Standard

This runbook is not a public demo recording by itself. Public demo evidence requires a real LangChain-hosted bot transcript or UI recording where the tool result came from the production Remix.Camera bridge and no output was mocked.
