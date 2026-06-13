# MCP Client Demo

## Setup

1. Run the Remix.Camera setup flow:

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=mcp
```

2. Add the printed `adapters/mcp/remix-camera-mcp-server.mjs` path to your MCP client configuration.
3. Start or keep running the local Remix.Camera bridge.
4. Restart the MCP client so it discovers the tools with `tools/list`.

## Demo Flow

1. Ask the MCP client: `Use Remix.Camera to preview a cozy couch selfie for Lily. Do not generate yet.`
2. Confirm the client calls `remix_camera_send_selfie_preview` and returns the selected Remix.Camera prompt template without spending credits.
3. Ask: `Generate that selfie now with yes=true.`
4. Confirm the client calls `remix_camera_send_selfie_generate` and returns the real Remix.Camera image link or rendered image.
5. Ask for a couple photo without consent. Confirm the generate tool refuses until the user explicitly includes `yes=true` and the required consent fields.

Record the real MCP host UI and the generated Remix.Camera output. Do not record a local JSON-RPC harness as if it were a real MCP client.

## Executable Evidence

Create no-spend bridge evidence for the MCP adapter:

```bash
npm run demo:verify -- --bridge-url=http://127.0.0.1:8787 --output-dir=demos/evidence
```

For a generated-image demo, use one command, include explicit `yes=true`, and cap the run at one generation unless intentionally recording a multi-image set.
