# Poe Demo

Setup:

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=poe
```

Demo flow:

1. Start the local Remix.Camera bridge.
2. Run or deploy `adapters/poe/remix_camera_poe_bot.py` as a Poe server bot.
3. In Poe, create a Server Bot and point it to the hosted bot URL.
4. Send `preview a cozy couch selfie for Lily`.
5. Confirm Poe renders the `Preview ready` response.
6. Send `generate that yes=true` only when intentionally spending a generation.

Record the Poe conversation plus the bot server logs. Do not use screenshots of local bridge output as Poe evidence unless Poe itself rendered the message.
