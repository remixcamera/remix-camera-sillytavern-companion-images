import assert from "node:assert/strict";
import { test } from "node:test";
import { callBridgeCommand } from "../adapters/shared/bridge-client.mjs";

test("shared adapter sends the dedicated bridge key", async () => {
  let captured;
  await callBridgeCommand({
    command: "send-selfie", bridgeApiKey: "adapter-test-key",
    fetchImpl: async (url, options) => {
      captured = { url, options };
      return { ok: true, json: async () => ({ ok: true }) };
    },
  });
  assert.equal(captured.options.headers.Authorization, "Bearer adapter-test-key");
  assert.equal(captured.url.includes("adapter-test-key"), false);
  assert.equal(captured.options.body.includes("adapter-test-key"), false);
});
