# Langflow Adapter

Langflow agents can use custom Python components as tools. This adapter provides a custom component that calls the local Remix.Camera bridge.

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=langflow
```

In Langflow:

1. Add a New Custom Component.
2. Paste `remix_camera_component.py`.
3. Connect the component's Toolset output to an Agent's Tools input.
4. Set `Bridge URL` to `http://127.0.0.1:8787` if Langflow runs on the same machine.
5. Ask the agent to preview before generating; set `yes=true` only after explicit confirmation.

Cloud Langflow cannot call a user's local bridge directly. Use Langflow Desktop/self-hosted on the same machine/network, or expose the bridge through a private authenticated tunnel.
