import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runRemixCameraMakeTool } from "../adapters/make/remix-camera-make-tool.mjs";
import { runRemixCameraN8nTool } from "../adapters/n8n/remix-camera-n8n-tool.mjs";
import pipedreamAction, { runRemixCameraPipedreamAction } from "../adapters/pipedream/remix-camera-pipedream-action.mjs";

const require = createRequire(import.meta.url);
const zapierApp = require("../adapters/zapier/remix-camera-zapier-app/index.cjs");

function mockFetchRecorder(payload = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(options.body) });
    return Response.json(payload);
  };
  return { calls, fetchImpl };
}

test("n8n helper defaults to a no-spend dry-run preview", async () => {
  const { calls, fetchImpl } = mockFetchRecorder({
    ok: true,
    dryRun: true,
    promptTemplate: { packTitle: "Excellent Lily Selfie" },
    prompt: "preview prompt",
  });
  const result = await runRemixCameraN8nTool(
    { command: "send-selfie", prompt: "cozy couch" },
    { bridgeUrl: "http://bridge.local", fetchImpl, characterName: "Lily" },
  );

  assert.equal(calls[0].url, "http://bridge.local/v1/tools/send-selfie/dry-run");
  assert.equal(calls[0].body.yes, undefined);
  assert.equal(calls[0].body.characterName, "Lily");
  assert.match(result.text, /Preview ready: Excellent Lily Selfie/);
  assert.equal(result.dryRun, true);
});

test("Make helper defaults to a no-spend dry-run preview", async () => {
  const { calls, fetchImpl } = mockFetchRecorder({
    ok: true,
    dryRun: true,
    promptTemplate: { packTitle: "Excellent Lily Selfie" },
    prompt: "preview prompt",
  });
  const result = await runRemixCameraMakeTool(
    { command: "send-selfie", prompt: "cozy couch" },
    { bridgeUrl: "http://bridge.local", fetchImpl, characterName: "Lily" },
  );

  assert.equal(calls[0].url, "http://bridge.local/v1/tools/send-selfie/dry-run");
  assert.equal(calls[0].body.yes, undefined);
  assert.equal(calls[0].body.characterName, "Lily");
  assert.match(result.text, /Preview ready: Excellent Lily Selfie/);
  assert.equal(result.dryRun, true);
});

test("Make action module JSON keeps generation behind action=generate and yes=true", () => {
  const moduleJson = JSON.parse(readFileSync(new URL("../adapters/make/remix-camera-make-action-module.json", import.meta.url), "utf8"));
  assert.equal(moduleJson.type, "action");
  assert.match(moduleJson.communication.url, /parameters\.action/);
  assert.match(moduleJson.communication.url, /parameters\.yes/);
  assert.equal(moduleJson.communication.method, "POST");
  assert.equal(moduleJson.communication.body.yes.includes("parameters.yes"), true);
});

test("n8n helper refuses requested generation without yes=true", async () => {
  const { calls, fetchImpl } = mockFetchRecorder({ ok: true });
  await assert.rejects(
    () => runRemixCameraN8nTool({ command: "send-selfie", prompt: "cozy couch", action: "generate" }, { bridgeUrl: "http://bridge.local", fetchImpl }),
    /yes=true/,
  );
  assert.equal(calls.length, 0);
});

test("Pipedream action helper calls generate only after yes=true", async () => {
  const { calls, fetchImpl } = mockFetchRecorder({
    ok: true,
    markdown: "![Lily](https://cdn.example/lily.jpg)",
    results: [{ productionImageUrl: "https://cdn.example/lily.jpg" }],
  });
  const result = await runRemixCameraPipedreamAction(
    { command: "send-selfie", prompt: "cozy couch", action: "generate", yes: true },
    { bridgeUrl: "http://bridge.local", fetchImpl },
  );

  assert.equal(calls[0].url, "http://bridge.local/v1/tools/send-selfie/generate");
  assert.equal(calls[0].body.yes, true);
  assert.deepEqual(result.imageUrls, ["https://cdn.example/lily.jpg"]);
});

test("automation helpers keep explicit dry-run requests no-spend even with yes=true", async () => {
  const { calls, fetchImpl } = mockFetchRecorder({
    ok: true,
    dryRun: true,
    promptTemplate: { packTitle: "Daily Snap Template" },
    prompt: "preview prompt",
  });
  const result = await runRemixCameraPipedreamAction(
    { command: "send-selfie", prompt: "cozy couch", action: "dry-run", yes: true },
    { bridgeUrl: "http://bridge.local", fetchImpl },
  );

  assert.equal(calls[0].url, "http://bridge.local/v1/tools/send-selfie/dry-run");
  assert.equal(calls[0].body.yes, undefined);
  assert.equal(result.dryRun, true);
});

test("Pipedream component exports a usable action surface", async () => {
  const { calls, fetchImpl } = mockFetchRecorder({
    ok: true,
    dryRun: true,
    promptTemplate: { packTitle: "Daily Snap Template" },
    prompt: "preview prompt",
  });
  const summaries = [];
  const result = await pipedreamAction.run.call(
    {
      bridgeUrl: "http://bridge.local",
      command: "daily-life-snap",
      prompt: "morning coffee",
      characterName: "Lily",
      action: "dry-run",
      yes: false,
      fetchImpl,
    },
    {
      $: {
        export(name, value) {
          summaries.push({ name, value });
        },
      },
    },
  );

  assert.equal(calls[0].url, "http://bridge.local/v1/tools/daily-life-snap/dry-run");
  assert.match(result.text, /Preview ready: Daily Snap Template/);
  assert.equal(summaries[0].name, "$summary");
});

test("Zapier CLI action defaults to dry-run and maps bridge output", async () => {
  const requests = [];
  const result = await zapierApp._test.perform(
    {
      request: async (options) => {
        requests.push(options);
        return {
          json: {
            ok: true,
            dryRun: true,
            promptTemplate: { packTitle: "Excellent Lily Selfie" },
            prompt: "preview prompt",
          },
        };
      },
    },
    {
      inputData: {
        bridgeUrl: "http://bridge.local",
        command: "send-selfie",
        prompt: "cozy couch",
        action: "dry-run",
        yes: true,
      },
      authData: {
        characterName: "Lily",
      },
    },
  );

  assert.equal(requests[0].url, "http://bridge.local/v1/tools/send-selfie/dry-run");
  assert.equal(JSON.parse(requests[0].body).yes, undefined);
  assert.equal(result.dryRun, true);
  assert.match(result.text, /Preview ready: Excellent Lily Selfie/);
});

test("Zapier CLI action refuses generate without yes=true", async () => {
  await assert.rejects(
    () =>
      zapierApp._test.perform(
        { request: async () => ({ json: {} }) },
        {
          inputData: {
            bridgeUrl: "http://bridge.local",
            command: "send-selfie",
            prompt: "cozy couch",
            action: "generate",
            yes: false,
          },
        },
      ),
    /yes=true/,
  );
});

test("n8n workflow JSON contains the guarded bridge call pipeline", () => {
  const workflow = JSON.parse(readFileSync(new URL("../adapters/n8n/remix-camera-n8n-workflow.json", import.meta.url), "utf8"));
  const nodeNames = workflow.nodes.map((node) => node.name);
  assert.deepEqual(nodeNames, [
    "Companion Tool Webhook",
    "Prepare Bridge Request",
    "Call Remix.Camera Bridge",
    "Format Tool Result",
  ]);
  assert.match(JSON.stringify(workflow), /yes=true/);
  assert.match(JSON.stringify(workflow), /\/v1\/tools\//);
});
