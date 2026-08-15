import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createInstallationId,
  createInstallTelemetryClient,
  normalizeInstallSource,
  telemetryEnabled,
  validInstallationId,
} from "../lib/install-telemetry.mjs";

test("installation telemetry uses a random anonymous id and stable source labels", async () => {
  const installationId = createInstallationId();
  assert.equal(validInstallationId(installationId), true);
  assert.equal(createInstallationId(installationId), installationId);
  assert.equal(normalizeInstallSource("GitHub Show & Tell"), "github_show_tell");

  const calls = [];
  const telemetry = createInstallTelemetryClient({
    apiBaseUrl: "https://remix.camera/",
    installationId,
    installSource: "GitHub Show & Tell",
    target: "sillytavern",
    packageVersion: "0.4.0-alpha.3",
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return { ok: true };
    },
  });

  assert.equal(await telemetry.track("sillytavern_setup_completed"), true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://remix.camera/api/integrations/sillytavern/telemetry");
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    eventName: "sillytavern_setup_completed",
    installationId,
    installSource: "github_show_tell",
    target: "sillytavern",
    packageVersion: "0.4.0-alpha.3",
  });
  assert.deepEqual(telemetry.config, {
    enabled: true,
    schemaVersion: "v1",
    installationId,
    installSource: "github_show_tell",
    target: "sillytavern",
    packageVersion: "0.4.0-alpha.3",
  });
});

test("telemetry honors both explicit opt-out forms and ignores unknown events", async () => {
  assert.equal(telemetryEnabled({ disabled: true, env: {} }), false);
  assert.equal(telemetryEnabled({ env: { DO_NOT_TRACK: "1" } }), false);
  assert.equal(telemetryEnabled({ env: { REMIX_TELEMETRY_DISABLED: "true" } }), false);

  let called = false;
  const telemetry = createInstallTelemetryClient({
    apiBaseUrl: "https://remix.camera",
    installationId: createInstallationId(),
    installSource: "github_readme",
    target: "sillytavern",
    packageVersion: "test",
    fetchImpl: async () => {
      called = true;
      return { ok: true };
    },
  });
  assert.equal(await telemetry.track("capture_prompt"), false);
  assert.equal(called, false);
});
