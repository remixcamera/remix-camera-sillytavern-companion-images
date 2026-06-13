# AnythingLLM Demo

Setup:

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=anythingllm
```

Install `adapters/anythingllm/remix-camera-companion-images` into AnythingLLM's `plugins/agent-skills` directory, then reload AnythingLLM.

Demo flow:

1. Start the local bridge and confirm `http://127.0.0.1:8787/health`.
2. Open an AnythingLLM workspace.
3. Type `@agent preview a cozy couch selfie for Lily with Remix.Camera`.
4. Confirm the response says `Preview ready` and names a Remix.Camera prompt template.
5. Ask `@agent generate it with yes=true` only when intentionally spending one generation.

Expected evidence:

- AnythingLLM Agent Skills page shows `Remix.Camera Companion Images`.
- The transcript shows preview first, generation second.
- Generated output is Markdown image content returned by the bridge, not a mocked image.
