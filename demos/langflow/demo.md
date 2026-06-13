# Langflow Demo

Setup:

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=langflow
```

Demo flow:

1. Start the Remix.Camera bridge and confirm `http://127.0.0.1:8787/health`.
2. In Langflow, create a custom component from `adapters/langflow/remix_camera_component.py`.
3. Connect it to an Agent as a tool.
4. Ask for a cozy Lily selfie preview.
5. Confirm the component returns `Preview ready` and a Remix.Camera template.
6. Flip `preview=false` and `yes=true` only when intentionally spending a generation.

Record the Langflow run panel and bridge logs. The demo should show Langflow invoking the component, not just a local curl response.
