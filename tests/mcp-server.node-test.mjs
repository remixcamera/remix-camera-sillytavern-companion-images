import test from "node:test";
import assert from "node:assert/strict";
import { COMPANION_COMMANDS } from "../lib/companion-tools.mjs";
import {
  callMcpTool,
  handleMcpJsonLine,
  handleMcpRequest,
  normalizeMcpToolName,
  publicMcpTools,
} from "../adapters/mcp/remix-camera-mcp-server.mjs";

test("MCP tools/list exposes preview and guarded generate tools", async () => {
  const response = await handleMcpRequest({
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
  });

  assert.equal(response.jsonrpc, "2.0");
  assert.equal(response.id, 1);
  assert.equal(response.result.tools.length, COMPANION_COMMANDS.length * 2);
  assert.ok(response.result.tools.some((tool) => tool.name === "remix_camera_send_selfie_preview"));
  assert.ok(response.result.tools.some((tool) => tool.name === "remix_camera_send_selfie_generate"));
  assert.equal(response.result.tools.find((tool) => tool.name === "remix_camera_send_selfie_generate").inputSchema.properties.yes.type, "boolean");
});

test("MCP initialize declares tool capability", async () => {
  const response = await handleMcpRequest({
    jsonrpc: "2.0",
    id: "init",
    method: "initialize",
    params: {
      protocolVersion: "2025-11-25",
      clientInfo: {
        name: "test-client",
        version: "1.0.0",
      },
    },
  });

  assert.equal(response.result.protocolVersion, "2025-11-25");
  assert.deepEqual(response.result.capabilities, { tools: { listChanged: false } });
  assert.equal(response.result.serverInfo.name, "remix-camera-companion-images");
});

test("MCP preview tool calls bridge dry-run endpoint", async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url, options });
    return new Response(
      JSON.stringify({
        ok: true,
        dryRun: true,
        prompt: "cozy couch prompt",
        promptTemplate: {
          packTitle: "Realistic Bedroom Selfie Girl Phone Mirror",
        },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  };

  const response = await handleMcpRequest(
    {
      jsonrpc: "2.0",
      id: 2,
      method: "tools/call",
      params: {
        name: normalizeMcpToolName("send-selfie", "dry-run"),
        arguments: {
          mood: "cozy couch with lamp light",
        },
      },
    },
    {
      bridgeUrl: "http://bridge.test",
      profileId: "profile_123",
      characterName: "Lily",
      fetchImpl,
    },
  );

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "http://bridge.test/v1/tools/send-selfie/dry-run");
  assert.equal(JSON.parse(calls[0].options.body).characterName, "Lily");
  assert.equal(response.result.isError, false);
  assert.match(response.result.content[0].text, /Preview ready/i);
  assert.equal(response.result.structuredContent.payload.dryRun, true);
});

test("MCP generate tool refuses to spend without yes=true", async () => {
  let called = false;
  const result = await callMcpTool({
    name: normalizeMcpToolName("send-selfie", "generate"),
    arguments: {
      mood: "cozy couch",
    },
    fetchImpl: async () => {
      called = true;
      throw new Error("should not call bridge");
    },
  });

  assert.equal(called, false);
  assert.equal(result.isError, true);
  assert.equal(result.structuredContent.reason, "missing-explicit-yes");
});

test("MCP generate tool returns image resource links from production URLs", async () => {
  const result = await callMcpTool({
    name: normalizeMcpToolName("send-selfie", "generate"),
    arguments: {
      yes: true,
      mood: "cozy couch",
    },
    bridgeUrl: "http://bridge.test",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          ok: true,
          markdown: "![Lily](https://cdn.example.com/lily.png)",
          results: [
            {
              productionImageUrl: "https://cdn.example.com/lily.png",
            },
          ],
        }),
        {
          status: 200,
          headers: { "Content-Type": "application/json" },
        },
      ),
  });

  assert.equal(result.isError, false);
  assert.equal(result.structuredContent.imageUrls[0], "https://cdn.example.com/lily.png");
  assert.equal(result.content.find((part) => part.type === "resource_link").uri, "https://cdn.example.com/lily.png");
});

test("MCP JSON line handler returns parse errors and ignores initialized notification", async () => {
  const bad = await handleMcpJsonLine("{bad json");
  assert.equal(bad.error.code, -32700);

  const initialized = await handleMcpJsonLine(
    JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    }),
  );
  assert.equal(initialized, null);
});

test("MCP public tools do not leak private routing metadata", () => {
  const tools = publicMcpTools();
  assert.ok(tools.length > 0);
  assert.equal("_remix" in tools[0], false);
});
