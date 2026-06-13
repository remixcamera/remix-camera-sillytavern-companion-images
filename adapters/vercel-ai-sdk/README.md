# Remix.Camera Vercel AI SDK Tools

Use this adapter when your companion bot uses the Vercel AI SDK and needs Remix.Camera image abilities inside `generateText`, `streamText`, or an agent loop.

AI SDK tools are objects with a description, input schema, and optional `execute` function. This adapter returns that tool map while keeping `ai` and `zod` as peer-side imports.

## Install

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=vercel-ai-sdk
```

## Add Tools

```js
import { streamText, tool } from "ai";
import * as z from "zod";
import { createRemixCameraAiSdkTools } from "./adapters/vercel-ai-sdk/remix-camera-ai-sdk-tools.mjs";

const tools = createRemixCameraAiSdkTools({
  tool,
  z,
  bridgeUrl: process.env.REMIX_BRIDGE_URL || "http://127.0.0.1:8787",
  profileId: process.env.REMIX_PROFILE_ID,
  characterName: "Lily",
});

const result = streamText({
  model,
  messages,
  tools,
});
```

## Tool Names

Each companion command is exposed as a preview tool and a guarded generate tool:

```text
remix_camera_send_selfie_preview
remix_camera_send_selfie_generate
remix_camera_auto_selfie_from_chat_preview
remix_camera_outfit_try_on_preview
remix_camera_couple_photo_preview
remix_camera_couples_vacation_preview
remix_camera_date_night_preview
remix_camera_daily_life_snap_preview
remix_camera_private_snap_preview
```

Preview tools never spend credits. Generate tools require `yes: true`; otherwise the adapter refuses before making a bridge call.

## References

- Vercel AI SDK tool calling docs: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling
