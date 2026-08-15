# Current-host companion integration audit

Recorded and verified on August 12-13, 2026. Every completed demo uses the real host UI, the checked-out Remix.Camera adapter, and the live local bridge. The RisuAI demo performs exactly one approved generation; the Open WebUI and Jan demos remain no-credit previews.

## Demo videos

### RisuAI API v3

- File: `risu-api-v3-ai-gf-chat.webm`
- Host: official hosted RisuAI, UI version `2026.6.215`
- Adapter: `adapters/risu/remix-camera-companion-images.risu.js`
- Scenario: Chris explicitly asks Lily to generate exactly one cozy selfie during an AI-girlfriend chat.
- Proof shown: the real `remix_send_selfie` tool call, Chris as the user/sender name, the completed companion reply, and the generated selfie visibly rendered inside hosted RisuAI.
- Generation proof: generation ID `57Wgx5tShdxblfS21WRL`, template `Cozy Bedroom Mirror Selfie Night Relaxed Pose`, one generated image, and no retry generation.
- Capture type: continuous frame capture of the real hosted RisuAI page, scrolling from the exact tool call to the rendered production image. The frames are browser captures of the live host, not a recreated UI.

### Open WebUI Python Tool

- File: `openwebui-python-tool-ai-gf-chat.webm`
- Host: Open WebUI `0.11`
- Adapter: `adapters/openwebui/remix_camera_companion_images.py`
- Scenario: Lily is asked in an AI-girlfriend chat for a cozy apartment selfie, preview first.
- Proof shown: actual Python Tool enabled in chat, `send_selfie` execution, tool result, and explicit no-credit reply.
- Capture type: continuous real-host screen recording.

### Jan native MCP

- File: `jan-mcp-ai-gf-chat-step-through.mp4`
- Host: Jan `0.8.4`
- Adapter: `adapters/mcp/remix-camera-mcp-server.mjs`
- Scenario: Lily is asked in an AI-girlfriend chat for a cozy couch selfie, preview first.
- Proof shown: Jan's actual per-call permission dialog, the `Remix Camera Send Selfie Preview` MCP call, the exact Remix.Camera template `Cozy Bedroom Mirror Selfie Night Relaxed Pose`, and the no-credit companion reply.
- Capture type: step-through video made only from four real Jan UI captures taken during one successful execution. It is labeled separately because Jan opened on another macOS desktop Space and whole-screen recording captured the foreground Codex Space instead of Jan. It is not a simulated host or reconstructed UI.

The deterministic local OpenAI-compatible model used in these demos exists only to make tool selection reproducible. The host, adapter, bridge request, Remix.Camera template selection, permission UI, tool transcript, and result are real. It issued exactly one approved Risu generation call; a token-gated one-shot proxy rejected any duplicate. The other demos never call the generation endpoint.

## Current audit disposition

| Surface | Current result | Video |
| --- | --- | --- |
| RisuAI API v3 | Passed in official hosted UI after documenting the mandatory MCP module import/global-enable step and fixing public production-image delivery. | Yes, generated image visible |
| Open WebUI Python Tool | Passed in Open WebUI 0.11 after removing the redundant `pydantic` installer requirement. | Yes |
| Jan | Passed in Jan 0.8.4 through the shared stdio MCP server and one-time tool permission. | Yes, real-UI step-through |
| Shared MCP | Passed a current SDK's legacy `2025-11-25` stdio handshake and exposed 16 preview/generate tools. Jan proves an actual host call. The newer stateless `2026-07-28` wire contract is not claimed by this alpha. | Via Jan |
| LobeHub | Contract repaired and reclassified: native MCP is the maintained route; the legacy manifest's previously missing `/lobe/gateway` now works. A truthful current-host chat recording was blocked because hosted LobeHub required a fresh account session and current local LobeHub `2.2.12` requires its database/key-vault stack. | Blocked, no fabricated clip |
| LibreChat | Documentation updated to native MCP, with OpenAPI retained only as a fallback. A current host was unavailable because this machine has no LibreChat runtime or Docker. | Blocked, no fabricated clip |
| Dify | OpenAPI adapter and Docker host routing corrected. This is a Custom OpenAPI Tool, not yet a packaged Dify Marketplace plugin. A current host was unavailable because this machine has no Dify runtime or Docker. | Blocked, no fabricated clip |

## Current contracts checked

- RisuAI plugin API v3: <https://github.com/kwaroran/RisuAI/blob/main/plugins.md>
- Open WebUI Tools: <https://docs.openwebui.com/features/extensibility/plugin/tools/>
- LobeHub current repository and MCP direction: <https://github.com/lobehub/lobehub>
- Dify tool plugins: <https://docs.dify.ai/en/develop-plugin/dev-guides-and-walkthroughs/tool-plugin>
- LibreChat MCP: <https://www.librechat.ai/docs/features/mcp>
- Jan MCP servers: <https://www.jan.ai/docs/desktop/integrations/mcp-servers>
- MCP legacy protocol used by the audited hosts: <https://modelcontextprotocol.io/specification/2025-11-25>
- Current MCP protocol era, not yet implemented by this alpha: <https://modelcontextprotocol.io/specification/2026-07-28>
