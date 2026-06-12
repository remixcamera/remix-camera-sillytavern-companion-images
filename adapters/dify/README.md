# Dify Adapter

Dify can use Remix.Camera through the local bridge OpenAPI schema.

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=dify
```

Then in Dify:

1. Open Workspace -> Tools.
2. Add a custom OpenAPI tool.
3. Import this schema URL:

   ```text
   http://127.0.0.1:8787/openapi.json
   ```

4. Add the imported tool to an Agent or Workflow Tool node.
5. Use `/dry-run` endpoints for preview and `/generate` endpoints only when the user explicitly confirms generation.

## Recommended Agent Instruction

```text
Use Remix.Camera image tools only when the user asks for an image or when a companion image would naturally fit the conversation. Preview first for ambiguous requests. Call generate only with explicit confirmation. Couple, vacation, and private-snap tools require explicit adult consent.
```

Cloud-hosted Dify cannot call a user's local `127.0.0.1` bridge directly. Use self-hosted Dify on the same machine/network, or expose the bridge through a private authenticated tunnel that only Dify can reach.
