# Open WebUI Adapter

Use the native Open WebUI Tool file:

```text
adapters/openwebui/remix_camera_companion_images.py
```

Setup:

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=openwebui
```

In Open WebUI, create a Tool from the Python file and set the valves:

```text
BRIDGE_URL=http://127.0.0.1:8787
PROFILE_ID=<your Remix.Camera profile id>
CHARACTER_NAME=Lily
```

Every tool accepts `yes=False` by default for dry-run preview. Use `yes=True` only after the user asks to generate.

