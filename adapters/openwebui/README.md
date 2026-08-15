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

The file intentionally has no frontmatter `requirements` entry. Current Open WebUI already includes `pydantic`; declaring it again makes some isolated `uvx`/container installations try to run `pip install` at import time.

For shared or multi-user Open WebUI deployments, prefer a server-side OpenAPI or MCP connection to the local bridge instead of installing arbitrary Python in the Open WebUI process. The Python Tool remains the simplest single-user/local setup.
