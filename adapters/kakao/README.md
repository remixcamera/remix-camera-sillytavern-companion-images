# Remix.Camera for KakaoTalk Chatbots

Use this adapter when a KakaoTalk chatbot built with Kakao i/Open Builder should call Remix.Camera as a Skill server and return companion-image responses.

Official surface: Kakao i/Open Builder Skill JSON response format with `version: "2.0"`, `simpleText`, and `simpleImage` outputs.

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=kakao
```

Reusable module:

```js
import { createRemixKakaoSkill } from "./adapters/kakao/remix-kakao-skill.mjs";

const skill = createRemixKakaoSkill({
  bridgeUrl: process.env.REMIX_BRIDGE_URL || "http://127.0.0.1:8787",
  characterName: "Lily",
});

const kakaoSkillResponse = await skill.handleSkill(kakaoSkillPayload);
```

Lily proof-of-concept Skill server:

```bash
REMIX_CONFIG_FILE=$HOME/.remix-camera/sillytavern-bridge.json \
node adapters/kakao/lily-skill-server.mjs
```

Expose the server over HTTPS and set your Kakao i/Open Builder Skill URL to:

```text
https://your-host.example/kakao/skill
```

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

## Image Delivery

The adapter returns Kakao `simpleImage` outputs for generated images when Remix.Camera provides public HTTPS image URLs. Local bridge image URLs are returned as text guidance instead of broken Kakao image payloads.

Kakao skill responses have strict output limits, so the adapter returns up to three generated images. That matches the `couples-vacation` three-photo set.

## Official Docs

- https://kakaobusiness.gitbook.io/main/tool/chatbot/skill_guide/answer_json_format
