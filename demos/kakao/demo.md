# KakaoTalk Chatbot Demo

This demo shows a KakaoTalk chatbot adding Remix.Camera companion images through a Kakao i/Open Builder Skill server.

## One-Step Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=kakao
```

The setup command pairs the local Remix.Camera bridge and prints the Kakao adapter path.

## Run Lily Skill Server

```bash
REMIX_CONFIG_FILE=$HOME/.remix-camera/sillytavern-bridge.json \
node adapters/kakao/lily-skill-server.mjs
```

Expose the server over HTTPS and set your Kakao i/Open Builder Skill URL to:

```text
https://your-host.example/kakao/skill
```

## Demo Script

1. Open the KakaoTalk chatbot using the Open Builder test panel or a deployed KakaoTalk channel.
2. Send `help`.
3. Send `preview selfie cozy couch with lamp light`.
4. Confirm the Skill response returns `version: "2.0"` with a `simpleText` dry-run preview and no credit spend.
5. Send `selfie cozy couch with lamp light`.
6. Confirm the Skill response returns a `simpleImage` output with a public Remix.Camera image URL.
7. Send `vacation Amalfi coast weekend` and confirm it asks for explicit `yes`.
8. Send `vacation yes Amalfi coast weekend` and confirm up to three `simpleImage` outputs are returned.

## Expected Evidence

- Kakao Skill request includes the user utterance in `userRequest.utterance`.
- `createRemixKakaoSkill` routes the utterance to the bridge.
- Dry-runs return `simpleText`.
- Generated outputs return Kakao `simpleImage` payloads.
- Local bridge URLs are not returned as broken Kakao image payloads.

## Recording Status

This runbook is demo-ready once a Kakao Open Builder bot can reach the Skill URL. Until then, bridge-backed verifier output is engineering evidence only, not a public KakaoTalk host recording.
