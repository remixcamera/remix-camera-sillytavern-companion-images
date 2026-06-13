import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runRemixCameraLexV2Lambda } from "../adapters/amazon-lex/remix-camera-lex-v2-lambda.mjs";
import { runRemixCameraDialogflowCxWebhook } from "../adapters/dialogflow-cx/remix-camera-dialogflow-cx-webhook.mjs";
import { runRemixCameraManychatTool } from "../adapters/manychat/remix-camera-manychat-tool.mjs";
import { runRemixCameraMakeTool } from "../adapters/make/remix-camera-make-tool.mjs";
import { runRemixCameraN8nTool } from "../adapters/n8n/remix-camera-n8n-tool.mjs";
import pipedreamAction, { runRemixCameraPipedreamAction } from "../adapters/pipedream/remix-camera-pipedream-action.mjs";
import { runRemixCameraVoiceflowTool } from "../adapters/voiceflow/remix-camera-voiceflow-tool.mjs";
import { runRemixCameraWatsonxAssistantTool } from "../adapters/watsonx-assistant/remix-camera-watsonx-tool.mjs";

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

test("Voiceflow helper defaults to a no-spend dry-run preview", async () => {
  const { calls, fetchImpl } = mockFetchRecorder({
    ok: true,
    dryRun: true,
    promptTemplate: { packTitle: "Excellent Lily Selfie" },
    prompt: "preview prompt",
  });
  const result = await runRemixCameraVoiceflowTool(
    { command: "send-selfie", prompt: "cozy couch" },
    { bridgeUrl: "http://bridge.local", fetchImpl, characterName: "Lily" },
  );

  assert.equal(calls[0].url, "http://bridge.local/v1/tools/send-selfie/dry-run");
  assert.equal(calls[0].body.yes, undefined);
  assert.equal(calls[0].body.characterName, "Lily");
  assert.match(result.text, /Preview ready: Excellent Lily Selfie/);
  assert.equal(result.dryRun, true);
});

test("Manychat helper defaults to a no-spend dry-run preview", async () => {
  const { calls, fetchImpl } = mockFetchRecorder({
    ok: true,
    dryRun: true,
    promptTemplate: { packTitle: "Excellent Lily Selfie" },
    prompt: "preview prompt",
  });
  const result = await runRemixCameraManychatTool(
    { command: "send-selfie", prompt: "cozy couch" },
    { bridgeUrl: "http://bridge.local", fetchImpl, characterName: "Lily" },
  );

  assert.equal(calls[0].url, "http://bridge.local/v1/tools/send-selfie/dry-run");
  assert.equal(calls[0].body.yes, undefined);
  assert.equal(calls[0].body.characterName, "Lily");
  assert.match(result.text, /Preview ready: Excellent Lily Selfie/);
  assert.equal(result.dryRun, true);
});

test("Dialogflow CX webhook defaults to a no-spend dry-run preview", async () => {
  const { calls, fetchImpl } = mockFetchRecorder({
    ok: true,
    dryRun: true,
    promptTemplate: { packTitle: "Excellent Lily Selfie" },
    prompt: "preview prompt",
  });
  const response = await runRemixCameraDialogflowCxWebhook(
    {
      fulfillmentInfo: { tag: "remix_camera_send_selfie_preview" },
      text: "cozy couch",
      sessionInfo: {
        parameters: {
          characterName: "Lily",
        },
      },
    },
    { bridgeUrl: "http://bridge.local", fetchImpl },
  );

  assert.equal(calls[0].url, "http://bridge.local/v1/tools/send-selfie/dry-run");
  assert.equal(calls[0].body.yes, undefined);
  assert.equal(calls[0].body.characterName, "Lily");
  assert.match(response.fulfillment_response.messages[0].text.text[0], /Preview ready: Excellent Lily Selfie/);
  assert.equal(response.session_info.parameters.remix_dry_run, true);
});

test("Dialogflow CX webhook requires yes=true before generation", async () => {
  const { calls, fetchImpl } = mockFetchRecorder({ ok: true });
  await assert.rejects(
    () =>
      runRemixCameraDialogflowCxWebhook(
        {
          fulfillmentInfo: { tag: "remix_camera_send_selfie_generate" },
          sessionInfo: {
            parameters: {
              command: "send-selfie",
              action: "generate",
              prompt: "cozy couch",
            },
          },
        },
        { bridgeUrl: "http://bridge.local", fetchImpl },
      ),
    /yes=true/,
  );
  assert.equal(calls.length, 0);
});

test("Amazon Lex V2 Lambda defaults to a no-spend dry-run preview", async () => {
  const { calls, fetchImpl } = mockFetchRecorder({
    ok: true,
    dryRun: true,
    promptTemplate: { packTitle: "Excellent Lily Selfie" },
    prompt: "preview prompt",
  });
  const response = await runRemixCameraLexV2Lambda(
    {
      inputTranscript: "cozy couch",
      invocationLabel: "remix_camera_send_selfie_preview",
      sessionState: {
        intent: {
          name: "RemixCameraImage",
          slots: {
            remix_character_name: { value: { interpretedValue: "Lily" } },
          },
        },
        sessionAttributes: {},
      },
    },
    { bridgeUrl: "http://bridge.local", fetchImpl },
  );

  assert.equal(calls[0].url, "http://bridge.local/v1/tools/send-selfie/dry-run");
  assert.equal(calls[0].body.yes, undefined);
  assert.equal(calls[0].body.characterName, "Lily");
  assert.equal(response.sessionState.dialogAction.type, "Close");
  assert.equal(response.sessionState.intent.state, "Fulfilled");
  assert.match(response.messages[0].content, /Preview ready: Excellent Lily Selfie/);
  assert.equal(response.sessionState.sessionAttributes.remix_dry_run, "true");
});

test("Amazon Lex V2 Lambda requires yes=true before generation", async () => {
  const { calls, fetchImpl } = mockFetchRecorder({ ok: true });
  await assert.rejects(
    () =>
      runRemixCameraLexV2Lambda(
        {
          inputTranscript: "cozy couch",
          sessionState: {
            intent: {
              name: "RemixCameraImage",
              slots: {
                remix_command: { value: { interpretedValue: "send-selfie" } },
                remix_action: { value: { interpretedValue: "generate" } },
              },
            },
          },
        },
        { bridgeUrl: "http://bridge.local", fetchImpl },
      ),
    /yes=true/,
  );
  assert.equal(calls.length, 0);
});

test("watsonx Assistant helper defaults to a no-spend dry-run preview", async () => {
  const { calls, fetchImpl } = mockFetchRecorder({
    ok: true,
    dryRun: true,
    promptTemplate: { packTitle: "Excellent Lily Selfie" },
    prompt: "preview prompt",
  });
  const result = await runRemixCameraWatsonxAssistantTool(
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

test("Voiceflow API tool JSON documents generate confirmation and response capture", () => {
  const toolJson = JSON.parse(readFileSync(new URL("../adapters/voiceflow/remix-camera-voiceflow-api-tool.json", import.meta.url), "utf8"));
  assert.equal(toolJson.type, "api_tool");
  assert.match(toolJson.url, /v1\/tools\/\{command\}\/\{action\}/);
  assert.equal(toolJson.method, "POST");
  assert.equal(toolJson.captureResponse.imageUrl, "results.0.productionImageUrl");
  assert.ok(toolJson.guardrails.some((line) => /yes to true/.test(line)));
});

test("Manychat External Request JSON requires HTTPS and maps image URL", () => {
  const requestJson = JSON.parse(readFileSync(new URL("../adapters/manychat/remix-camera-manychat-external-request.json", import.meta.url), "utf8"));
  assert.equal(requestJson.surface, "Manychat External Request");
  assert.equal(requestJson.method, "POST");
  assert.match(requestJson.url, /^https:\/\//);
  assert.ok(requestJson.customFieldMappings.some((mapping) => mapping.jsonPath === "$.results[0].productionImageUrl"));
  assert.ok(requestJson.guardrails.some((line) => /HTTPS/.test(line)));
});

test("watsonx Assistant OpenAPI extension is importable JSON and guarded", () => {
  const openapi = JSON.parse(readFileSync(new URL("../adapters/watsonx-assistant/remix-camera-watsonx-extension.openapi.json", import.meta.url), "utf8"));
  const operation = openapi.paths["/v1/tools/{command}/{action}"].post;
  assert.equal(openapi.openapi, "3.0.3");
  assert.match(openapi.servers[0].url, /^https:\/\//);
  assert.equal(operation.operationId, "previewOrGenerateCompanionImage");
  assert.equal(operation.requestBody.content["application/json"].schema.type, "object");
  assert.ok(operation["x-remix-camera-guardrails"].some((line) => /yes=true/.test(line)));
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
