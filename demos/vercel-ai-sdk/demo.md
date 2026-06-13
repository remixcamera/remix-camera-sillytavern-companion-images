# Vercel AI SDK Demo Runbook

This demo adds Remix.Camera companion image tools to a Vercel AI SDK chatbot or agent.

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=vercel-ai-sdk
```

Approve the Remix.Camera pairing code, then keep the local bridge running.

## Wire Into A Bot

```js
import { streamText, tool } from "ai";
import * as z from "zod";
import { createRemixCameraAiSdkTools } from "../adapters/vercel-ai-sdk/remix-camera-ai-sdk-tools.mjs";

const tools = createRemixCameraAiSdkTools({
  tool,
  z,
  bridgeUrl: "http://127.0.0.1:8787",
  characterName: "Lily",
});

export async function POST(req) {
  const { messages } = await req.json();
  const result = streamText({
    model,
    messages,
    tools,
  });
  return result.toUIMessageStreamResponse();
}
```

Ask the bot:

```text
Show me the outfit we were talking about. Preview the image prompt first.
```

The bot should use a `*_preview` tool first. Only call a `*_generate` tool when the user explicitly confirms and the tool input includes `yes: true`.

## Evidence Standard

This runbook is not a public demo recording by itself. Public demo evidence requires a real AI SDK app transcript or screen recording where the tool result came from the production Remix.Camera bridge and no output was mocked.
