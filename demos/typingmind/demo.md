# TypingMind Demo

Setup:

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=typingmind
```

Demo flow:

1. Start the local bridge and confirm `http://127.0.0.1:8787/health`.
2. Create a TypingMind plugin with `adapters/typingmind/function-spec.json`.
3. Paste `adapters/typingmind/remix-camera-plugin.js` as the JavaScript implementation.
4. Ask the chat to preview a cozy Lily selfie.
5. Confirm the plugin returns `Preview ready` and a Remix.Camera prompt template.
6. Ask it to generate only with `yes=true`.

For couple-photo demos, attach the user's consenting adult reference photo in TypingMind and call `couple-photo` with `userConsent: "yes"`.
