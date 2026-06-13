# AnythingLLM Adapter

AnythingLLM supports custom agent skills that run in a Node.js environment and return strings to the agent. This adapter is packaged as an AnythingLLM custom agent skill.

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=anythingllm
```

Install this folder into AnythingLLM's `plugins/agent-skills` directory:

```text
adapters/anythingllm/remix-camera-companion-images
```

The folder name must remain `remix-camera-companion-images` because it matches `plugin.json`'s `hubId`.

## Usage

1. Start the Remix.Camera bridge locally.
2. Copy the skill folder into AnythingLLM's `plugins/agent-skills` directory.
3. Open AnythingLLM settings, confirm the skill appears under Agent Skills, then reload the workspace if needed.
4. Configure `REMIX_BRIDGE_URL` if your bridge is not `http://127.0.0.1:8787`.
5. In chat, invoke the agent with a request such as:

```text
@agent use Remix.Camera to preview a cozy couch selfie for Lily
```

The skill defaults to dry-run previews. It only calls the bridge generate endpoint when `yes=true` or `confirm=true`.

AnythingLLM Cloud cannot call a user's local `127.0.0.1` bridge directly. Use Desktop/self-hosted AnythingLLM on the same machine/network, or expose the bridge through a private authenticated tunnel.
