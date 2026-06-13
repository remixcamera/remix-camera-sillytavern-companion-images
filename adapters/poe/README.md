# Poe Adapter

Poe supports server bots that respond to Poe through the Poe protocol. This adapter is a proof wrapper that turns Poe messages into Remix.Camera bridge calls and returns Markdown image output.

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=poe
```

Use:

```text
adapters/poe/remix_camera_poe_bot.py
```

Poe server bots need a public HTTPS server URL. If the Remix.Camera bridge is local, run the Poe bot on the same machine and expose only the Poe bot server, or expose the bridge through a private authenticated tunnel that only the Poe bot can reach.

The bot defaults to previews. It calls generation only when the user message contains explicit confirmation such as `yes=true`.
