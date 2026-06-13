import assert from "node:assert/strict";
import { test } from "node:test";
import {
  COMPANION_COMMANDS,
  createBridgeOpenApiDocument,
  createChatGptActionsOpenApiDocument,
  createCommandInputSchema,
  createLobeManifest,
} from "../lib/companion-tools.mjs";

test("companion tool schemas require consent for user-included image commands", () => {
  const coupleSchema = createCommandInputSchema("couple-photo", {
    includeSpendGuard: true,
    requireSpendGuard: true,
  });
  const vacationSchema = createCommandInputSchema("couples-vacation", {
    includeSpendGuard: true,
    requireSpendGuard: true,
  });

  assert.deepEqual(coupleSchema.required, ["yes", "userConsent"]);
  assert.deepEqual(vacationSchema.required, ["yes", "userConsent"]);
  assert.equal(coupleSchema.properties.userReferenceImageDataUrl.type, "string");
  assert.equal(vacationSchema.properties.maxGenerations.maximum, 3);
});

test("OpenAPI document exposes dry-run and guarded generate endpoints for every command", () => {
  const document = createBridgeOpenApiDocument("http://127.0.0.1:8787");

  assert.equal(document.openapi, "3.1.0");
  for (const command of COMPANION_COMMANDS) {
    const dryRun = document.paths[`/v1/tools/${command.name}/dry-run`]?.post;
    const generate = document.paths[`/v1/tools/${command.name}/generate`]?.post;
    assert.ok(dryRun, `${command.name} dry-run path exists`);
    assert.ok(generate, `${command.name} generate path exists`);
    assert.equal(dryRun.operationId, `${command.toolName}DryRun`);
    assert.equal(generate.operationId, command.toolName);
    assert.ok(generate.description.includes("yes=true"));
    assert.ok(generate.requestBody.content["application/json"].schema.required.includes("yes"));
  }
});

test("ChatGPT Actions OpenAPI document is namespaced and bearer-secured", () => {
  const document = createChatGptActionsOpenApiDocument("https://bridge.example.com");

  assert.equal(document.openapi, "3.1.0");
  assert.equal(document.info.title, "Remix.Camera ChatGPT Companion Image Actions");
  assert.equal(document.servers[0].url, "https://bridge.example.com");
  assert.equal(document.components.securitySchemes.bearerAuth.scheme, "bearer");
  assert.ok(document.paths["/chatgpt-actions/health"].get.security[0].bearerAuth);
  for (const command of COMPANION_COMMANDS) {
    const dryRun = document.paths[`/chatgpt-actions/v1/tools/${command.name}/dry-run`]?.post;
    const generate = document.paths[`/chatgpt-actions/v1/tools/${command.name}/generate`]?.post;
    assert.ok(dryRun, `${command.name} ChatGPT dry-run path exists`);
    assert.ok(generate, `${command.name} ChatGPT generate path exists`);
    assert.equal(dryRun.operationId, `${command.toolName}DryRun`);
    assert.equal(generate.operationId, command.toolName);
    assert.ok(generate.security[0].bearerAuth);
    assert.ok(generate.requestBody.content["application/json"].schema.required.includes("yes"));
  }
});

test("Lobe manifest exposes preview and guarded generate APIs per companion command", () => {
  const manifest = createLobeManifest("http://127.0.0.1:8787");

  assert.equal(manifest.identifier, "remix-camera-companion-images");
  assert.equal(manifest.api.length, COMPANION_COMMANDS.length * 2);
  assert.equal(manifest.api[0].url, "http://127.0.0.1:8787/v1/tools/send-selfie/dry-run");
  assert.equal(manifest.api[1].url, "http://127.0.0.1:8787/v1/tools/send-selfie/generate");
  for (const command of COMPANION_COMMANDS) {
    const preview = manifest.api.find((item) => item.name === `${command.toolName}Preview`);
    const generate = manifest.api.find((item) => item.name === command.toolName);
    assert.ok(preview, `${command.name} preview API exists`);
    assert.ok(generate, `${command.name} generate API exists`);
    assert.equal(preview.url, `http://127.0.0.1:8787/v1/tools/${command.name}/dry-run`);
    assert.equal(generate.url, `http://127.0.0.1:8787/v1/tools/${command.name}/generate`);
    assert.ok(!preview.parameters.required.includes("yes"));
    assert.ok(generate.parameters.required.includes("yes"));
  }
});
