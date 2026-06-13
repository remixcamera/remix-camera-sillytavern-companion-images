# TypingMind Adapter

TypingMind plugins can use OpenAI function specs plus JavaScript implementations. This adapter provides a pasteable function spec and JavaScript implementation that call the local Remix.Camera bridge.

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=typingmind
```

In TypingMind:

1. Open Plugins -> Create Plugin.
2. Add a user setting named `bridgeUrl` with default `http://127.0.0.1:8787`.
3. Paste `function-spec.json` into the OpenAI Function Spec field.
4. Paste `remix-camera-plugin.js` into the JavaScript implementation field.
5. Set output to render Markdown so generated image Markdown appears directly in chat.

The function defaults to dry-run previews. It only calls `/generate` when `yes=true` or `confirm=true`.

TypingMind browser plugins must be allowed by the bridge CORS policy. If you self-host TypingMind on another origin, set `REMIX_ALLOWED_ORIGINS` before starting the bridge.
