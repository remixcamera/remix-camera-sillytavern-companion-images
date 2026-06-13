# Remix.Camera LangChain Tools

Use this adapter when your companion bot is a LangChain JS agent and already handles chat, memory, and persona. The adapter only adds Remix.Camera image tools.

LangChain's current JavaScript docs define tools with the `tool` helper and a schema. This package keeps `langchain` and `zod` as peer-side imports so the setup package stays dependency-light.

## Install

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=langchain
```

## Add Tools

```js
import { createAgent, tool } from "langchain";
import * as z from "zod";
import { createRemixCameraLangChainTools } from "./adapters/langchain/remix-camera-langchain-tools.mjs";

const remixTools = createRemixCameraLangChainTools({
  tool,
  z,
  bridgeUrl: process.env.REMIX_BRIDGE_URL || "http://127.0.0.1:8787",
  profileId: process.env.REMIX_PROFILE_ID,
  characterName: "Lily",
});

const agent = createAgent({
  model,
  tools: [...remixTools],
});
```

## Tool Names

Each command is exposed as a preview tool and a guarded generate tool:

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

Generate tools require `yes: true`. Without that confirmation, the adapter refuses before it calls the bridge.

## References

- LangChain JS tools docs: https://docs.langchain.com/oss/javascript/langchain/tools
