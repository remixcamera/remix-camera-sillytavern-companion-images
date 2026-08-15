import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const anythingLlmRuntime = require("../adapters/anythingllm/remix-camera-companion-images/handler.js").runtime;

function mockFetchRecorder(payload = {}) {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(options.body) });
    return {
      ok: true,
      status: 200,
      json: async () => payload,
    };
  };
  return { calls, fetchImpl };
}

function loadTypingMindFunction(fetchImpl) {
  const source = readFileSync(new URL("../adapters/typingmind/remix-camera-plugin.js", import.meta.url), "utf8");
  const context = {
    fetch: fetchImpl,
    globalThis: {},
  };
  vm.runInNewContext(`${source}\nglobalThis.remix_camera_companion_image = remix_camera_companion_image;`, context);
  return context.globalThis.remix_camera_companion_image;
}

async function loadRisuPlugin(fetchImpl) {
  const source = readFileSync(
    new URL("../adapters/risu/remix-camera-companion-images.risu.js", import.meta.url),
    "utf8",
  );
  const state = {
    registration: null,
    unload: null,
    unregistered: [],
  };
  const Risuai = {
    getArgument: async (name) => ({
      bridge_url: "http://bridge.local",
      profile_id: "profile_lily",
      character_name: "Lily",
    })[name] || "",
    getCharacter: async () => ({ name: "Fallback Lily" }),
    nativeFetch: fetchImpl,
    registerMCP: async (metadata, listTools, callTool) => {
      state.registration = { metadata, listTools, callTool };
    },
    onUnload: async (callback) => {
      state.unload = callback;
    },
    unregisterMCP: async (identifier) => {
      state.unregistered.push(identifier);
    },
  };
  await vm.runInNewContext(source, { Risuai });
  return state;
}

test("AnythingLLM skill defaults to dry-run previews", async () => {
  const originalFetch = globalThis.fetch;
  const { calls, fetchImpl } = mockFetchRecorder({
    ok: true,
    dryRun: true,
    promptTemplate: { packTitle: "Excellent Lily Selfie" },
    prompt: "Preview prompt",
  });
  globalThis.fetch = fetchImpl;
  try {
    const result = await anythingLlmRuntime.handler.call(
      {
        runtimeArgs: {
          REMIX_BRIDGE_URL: "http://bridge.local",
          REMIX_PROFILE_ID: "profile_lily",
          REMIX_CHARACTER_NAME: "Lily",
        },
      },
      { command: "send-selfie", prompt: "cozy couch" },
    );

    assert.equal(calls[0].url, "http://bridge.local/v1/tools/send-selfie/dry-run");
    assert.equal(calls[0].body.yes, undefined);
    assert.equal(calls[0].body.profileId, "profile_lily");
    assert.match(result, /Preview ready: Excellent Lily Selfie/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("AnythingLLM skill calls generate only after explicit confirmation", async () => {
  const originalFetch = globalThis.fetch;
  const { calls, fetchImpl } = mockFetchRecorder({
    ok: true,
    markdown: "![Lily](https://cdn.example/lily.jpg)",
  });
  globalThis.fetch = fetchImpl;
  try {
    const result = await anythingLlmRuntime.handler.call(
      {
        runtimeArgs: {
          REMIX_BRIDGE_URL: "http://bridge.local",
        },
      },
      { command: "date-night", prompt: "quiet restaurant booth", confirm: true },
    );

    assert.equal(calls[0].url, "http://bridge.local/v1/tools/date-night/generate");
    assert.equal(calls[0].body.yes, true);
    assert.equal(result, "![Lily](https://cdn.example/lily.jpg)");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("TypingMind plugin spec is valid OpenAI function JSON", () => {
  const spec = JSON.parse(readFileSync(new URL("../adapters/typingmind/function-spec.json", import.meta.url), "utf8"));
  assert.equal(spec.name, "remix_camera_companion_image");
  assert.equal(spec.parameters.type, "object");
  assert.ok(spec.parameters.properties.command.enum.includes("couples-vacation"));
});

test("TypingMind plugin defaults to dry-run and forwards user attachments for couple photos", async () => {
  const { calls, fetchImpl } = mockFetchRecorder({
    ok: true,
    dryRun: true,
    promptTemplate: { packTitle: "Couple Cafe Photo" },
    prompt: "Preview prompt",
  });
  const remixCameraCompanionImage = loadTypingMindFunction(fetchImpl);
  const result = await remixCameraCompanionImage(
    { command: "couple-photo", prompt: "coffee shop booth", userConsent: "yes" },
    { bridgeUrl: "http://bridge.local", characterName: "Lily" },
    {
      userMessage: {
        text: "Use this photo of me",
        attachments: [{ type: "image/jpeg", url: "https://example.test/user.jpg", name: "user.jpg" }],
      },
    },
  );

  assert.equal(calls[0].url, "http://bridge.local/v1/tools/couple-photo/dry-run");
  assert.equal(calls[0].body.yes, undefined);
  assert.equal(calls[0].body.userReferenceImageUrl, "https://example.test/user.jpg");
  assert.match(result, /Preview ready: Couple Cafe Photo/);
});

test("TypingMind plugin calls generate only with yes=true", async () => {
  const { calls, fetchImpl } = mockFetchRecorder({
    ok: true,
    markdown: "![Lily](https://cdn.example/lily.jpg)",
  });
  const remixCameraCompanionImage = loadTypingMindFunction(fetchImpl);
  const result = await remixCameraCompanionImage(
    { command: "send-selfie", prompt: "cozy couch", yes: true },
    { bridgeUrl: "http://bridge.local" },
    {},
  );

  assert.equal(calls[0].url, "http://bridge.local/v1/tools/send-selfie/generate");
  assert.equal(calls[0].body.yes, true);
  assert.equal(result, "![Lily](https://cdn.example/lily.jpg)");
});

test("RisuAI API v3 plugin registers MCP tools and preserves the spend guard", async () => {
  const source = readFileSync(
    new URL("../adapters/risu/remix-camera-companion-images.risu.js", import.meta.url),
    "utf8",
  );
  assert.match(source, /\/\/@api 3\.0/);
  assert.match(source, /\/\/@version 0\.4\.0-alpha\.3/);
  assert.match(source, /\/\/@update-url https:\/\/raw\.githubusercontent\.com\//);

  const calls = [];
  const state = await loadRisuPlugin(async (url, options) => {
    calls.push({ url: String(url), body: JSON.parse(options.body) });
    const generating = String(url).endsWith("/generate");
    const body = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      json: async () => generating
        ? body.mood === "public fallback"
          ? {
              ok: true,
              results: [{
                productionImageUrl: "http://127.0.0.1:8787/v1/images/local-id",
                imageUrl: "https://cdn.example/lily-fallback.jpg",
              }],
            }
          : {
              ok: true,
              markdown: "![Lily](http://127.0.0.1:8787/v1/images/local-id)",
              results: [{
                ok: true,
                imageUrl: "http://127.0.0.1:8787/v1/images/local-id",
                productionImageUrl: "https://cdn.example/lily.jpg",
              }],
            }
        : { ok: true, dryRun: true, promptTemplate: { packTitle: "Cozy Lily Selfie" }, prompt: "Preview prompt" },
    };
  });

  assert.equal(state.registration.metadata.identifier, "plugin:remix-camera-companion-images");
  assert.equal(state.registration.metadata.version, "0.4.0-alpha.3");
  assert.equal((await state.registration.listTools()).length, 8);

  const preview = await state.registration.callTool("remix_send_selfie", { mood: "cozy couch" });
  assert.equal(calls[0].url, "http://bridge.local/v1/tools/send-selfie/dry-run");
  assert.equal(calls[0].body.profileId, "profile_lily");
  assert.match(preview[0].text, /preview ready: Cozy Lily Selfie/i);

  const generated = await state.registration.callTool("remix_send_selfie", { mood: "cozy couch", yes: true });
  assert.equal(calls[1].url, "http://bridge.local/v1/tools/send-selfie/generate");
  assert.equal(calls[1].body.yes, true);
  assert.equal(generated[0].text, "![Lily image](https://cdn.example/lily.jpg)");

  const fallback = await state.registration.callTool("remix_send_selfie", { mood: "public fallback", yes: true });
  assert.equal(fallback[0].text, "![Lily image](https://cdn.example/lily-fallback.jpg)");

  await state.unload();
  assert.deepEqual(state.unregistered, ["plugin:remix-camera-companion-images"]);
});
