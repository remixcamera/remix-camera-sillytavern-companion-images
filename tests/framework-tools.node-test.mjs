import assert from "node:assert/strict";
import test from "node:test";
import { createRemixCameraLangChainTools } from "../adapters/langchain/remix-camera-langchain-tools.mjs";
import { createRemixCameraAiSdkTools } from "../adapters/vercel-ai-sdk/remix-camera-ai-sdk-tools.mjs";

function mockFetchRecorder(payload = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(options.body) });
    return Response.json(payload);
  };
  return { calls, fetchImpl };
}

test("LangChain adapter exposes preview tools that default to dry-run", async () => {
  const { calls, fetchImpl } = mockFetchRecorder({
    ok: true,
    dryRun: true,
    promptTemplate: { packTitle: "Excellent Lily Selfie" },
    prompt: "preview prompt",
  });
  const tools = createRemixCameraLangChainTools({
    tool: (fn, config) => ({ ...config, invoke: fn }),
    bridgeUrl: "http://bridge.local",
    characterName: "Lily",
    fetchImpl,
    commands: ["send-selfie"],
    includeGenerateTools: false,
  });

  assert.equal(tools[0].name, "remix_camera_send_selfie_preview");
  const result = await tools[0].invoke({ prompt: "cozy couch" });

  assert.equal(calls[0].url, "http://bridge.local/v1/tools/send-selfie/dry-run");
  assert.equal(calls[0].body.characterName, "Lily");
  assert.equal(calls[0].body.yes, undefined);
  assert.match(result, /Preview ready: Excellent Lily Selfie/);
});

test("LangChain adapter refuses generate tools without yes=true", async () => {
  const { calls, fetchImpl } = mockFetchRecorder({ ok: true });
  const tools = createRemixCameraLangChainTools({
    tool: (fn, config) => ({ ...config, invoke: fn }),
    bridgeUrl: "http://bridge.local",
    fetchImpl,
    commands: ["send-selfie"],
    includePreviewTools: false,
  });

  await assert.rejects(() => tools[0].invoke({ prompt: "cozy couch" }), /yes=true/);
  assert.equal(calls.length, 0);
});

test("LangChain adapter calls generate only after yes=true", async () => {
  const { calls, fetchImpl } = mockFetchRecorder({
    ok: true,
    markdown: "![Lily](https://cdn.example/lily.jpg)",
    results: [{ productionImageUrl: "https://cdn.example/lily.jpg" }],
  });
  const tools = createRemixCameraLangChainTools({
    tool: (fn, config) => ({ ...config, invoke: fn }),
    bridgeUrl: "http://bridge.local",
    fetchImpl,
    commands: ["send-selfie"],
    includePreviewTools: false,
  });

  const result = await tools[0].invoke({ prompt: "cozy couch", yes: true });

  assert.equal(calls[0].url, "http://bridge.local/v1/tools/send-selfie/generate");
  assert.equal(calls[0].body.yes, true);
  assert.equal(result, "![Lily](https://cdn.example/lily.jpg)");
});

test("Vercel AI SDK adapter returns a tool map with dry-run preview execution", async () => {
  const { calls, fetchImpl } = mockFetchRecorder({
    ok: true,
    dryRun: true,
    promptTemplate: { packTitle: "Date Night Template" },
    prompt: "preview prompt",
  });
  const tools = createRemixCameraAiSdkTools({
    tool: (definition) => definition,
    bridgeUrl: "http://bridge.local",
    fetchImpl,
    commands: ["date-night"],
    includeGenerateTools: false,
  });

  const result = await tools.remix_camera_date_night_preview.execute({ prompt: "quiet restaurant booth" });

  assert.equal(calls[0].url, "http://bridge.local/v1/tools/date-night/dry-run");
  assert.equal(calls[0].body.yes, undefined);
  assert.equal(result.dryRun, true);
  assert.match(result.text, /Preview ready: Date Night Template/);
});

test("Vercel AI SDK adapter refuses generate execution without yes=true", async () => {
  const { calls, fetchImpl } = mockFetchRecorder({ ok: true });
  const tools = createRemixCameraAiSdkTools({
    tool: (definition) => definition,
    bridgeUrl: "http://bridge.local",
    fetchImpl,
    commands: ["send-selfie"],
    includePreviewTools: false,
  });

  await assert.rejects(() => tools.remix_camera_send_selfie_generate.execute({ prompt: "cozy couch" }), /yes=true/);
  assert.equal(calls.length, 0);
});

test("Vercel AI SDK adapter generate execution returns image URLs after confirmation", async () => {
  const { calls, fetchImpl } = mockFetchRecorder({
    ok: true,
    markdown: "![Lily](https://cdn.example/lily.jpg)",
    results: [{ productionImageUrl: "https://cdn.example/lily.jpg" }],
  });
  const tools = createRemixCameraAiSdkTools({
    tool: (definition) => definition,
    bridgeUrl: "http://bridge.local",
    fetchImpl,
    commands: ["send-selfie"],
    includePreviewTools: false,
  });

  const result = await tools.remix_camera_send_selfie_generate.execute({ prompt: "cozy couch", yes: true });

  assert.equal(calls[0].url, "http://bridge.local/v1/tools/send-selfie/generate");
  assert.equal(calls[0].body.yes, true);
  assert.deepEqual(result.imageUrls, ["https://cdn.example/lily.jpg"]);
});

test("framework adapters reject unknown command filters", () => {
  assert.throws(
    () =>
      createRemixCameraAiSdkTools({
        tool: (definition) => definition,
        commands: ["not-a-command"],
      }),
    /Unknown Remix\.Camera companion command: not-a-command/,
  );
});
