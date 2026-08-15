# Dify Adapter

Dify can use Remix.Camera through the local bridge OpenAPI schema.

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=dify
```

Then in Dify:

1. Open Workspace -> Tools.
2. Add a custom OpenAPI tool.
3. Import the schema URL that the Dify process can actually reach:

   ```text
   Native/local Dify: http://127.0.0.1:8787/openapi.json
   Docker Desktop:    http://host.docker.internal:8787/openapi.json
   ```

4. Add the imported tool to an Agent or Workflow Tool node.
5. Use `/dry-run` endpoints for preview and `/generate` endpoints only when the user explicitly confirms generation.

## Recommended Agent Instruction

```text
Use Remix.Camera image tools only when the user asks for an image or when a companion image would naturally fit the conversation. Preview first for ambiguous requests. Call generate only with explicit confirmation. Couple, vacation, and private-snap tools require explicit adult consent.
```

`127.0.0.1` inside a Dify container is the container itself, not the host Mac. For a trusted single-user Docker Desktop test, start setup with `REMIX_BRIDGE_HOST=0.0.0.0` and use `host.docker.internal`. The bridge has credit-spending endpoints and no general network authentication layer, so keep that listener behind the host firewall and never expose it to a LAN or the public internet. Cloud-hosted Dify requires a separately authenticated private bridge deployment; do not expose this local bridge through a public tunnel as-is.

This directory currently supports Dify's Custom OpenAPI Tool surface. Dify Marketplace publication is a separate deliverable: it requires a packaged Python 3.12 Tool plugin (`.difypkg`), manifest, provider/tool YAML, code, icon, and privacy metadata. Do not describe this OpenAPI adapter as a Marketplace plugin.
