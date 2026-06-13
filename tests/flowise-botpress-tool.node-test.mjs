import assert from "node:assert/strict";
import test from "node:test";
import { remixCameraBotpressAction } from "../adapters/botpress/remix-camera-botpress-action.js";
import { remixCameraFlowiseTool } from "../adapters/flowise/remix-camera-flowise-tool.js";

test("Flowise helper defaults to dry-run unless generation is explicitly confirmed", async () => {
  const calls = [];
  const result = await remixCameraFlowiseTool(
    { command: "send-selfie", prompt: "cozy couch" },
    {
      bridgeUrl: "http://bridge.local",
      fetchImpl: async (url, options) => {
        calls.push({ url, body: JSON.parse(options.body) });
        return Response.json({
          ok: true,
          dryRun: true,
          prompt: "preview prompt",
        });
      },
    },
  );

  assert.equal(calls[0].url, "http://bridge.local/v1/tools/send-selfie/dry-run");
  assert.equal(calls[0].body.yes, undefined);
  assert.equal(result, "preview prompt");
});

test("Flowise helper calls generate only after yes or confirm is true", async () => {
  const calls = [];
  await remixCameraFlowiseTool(
    { command: "send-selfie", prompt: "cozy couch", yes: true },
    {
      bridgeUrl: "http://bridge.local",
      fetchImpl: async (url, options) => {
        calls.push({ url, body: JSON.parse(options.body) });
        return Response.json({
          ok: true,
          markdown: "![image](https://cdn.example/remix.jpg)",
        });
      },
    },
  );

  assert.equal(calls[0].url, "http://bridge.local/v1/tools/send-selfie/generate");
  assert.equal(calls[0].body.yes, true);
});

test("Botpress action defaults to dry-run unless generation is explicitly confirmed", async () => {
  const calls = [];
  const result = await remixCameraBotpressAction(
    { command: "send-selfie", prompt: "cozy couch" },
    {
      bridgeUrl: "http://bridge.local",
      fetchImpl: async (url, options) => {
        calls.push({ url, body: JSON.parse(options.body) });
        return Response.json({
          ok: true,
          dryRun: true,
          prompt: "preview prompt",
        });
      },
    },
  );

  assert.equal(calls[0].url, "http://bridge.local/v1/tools/send-selfie/dry-run");
  assert.equal(calls[0].body.yes, undefined);
  assert.equal(result.text, "preview prompt");
  assert.deepEqual(result.imageUrls, []);
});

test("Botpress action calls generate only after yes or confirm is true", async () => {
  const calls = [];
  const result = await remixCameraBotpressAction(
    { command: "send-selfie", prompt: "cozy couch", confirm: true },
    {
      bridgeUrl: "http://bridge.local",
      fetchImpl: async (url, options) => {
        calls.push({ url, body: JSON.parse(options.body) });
        return Response.json({
          ok: true,
          markdown: "![image](https://cdn.example/remix.jpg)",
          results: [{ productionImageUrl: "https://cdn.example/remix.jpg" }],
        });
      },
    },
  );

  assert.equal(calls[0].url, "http://bridge.local/v1/tools/send-selfie/generate");
  assert.equal(calls[0].body.yes, true);
  assert.deepEqual(result.imageUrls, ["https://cdn.example/remix.jpg"]);
});
