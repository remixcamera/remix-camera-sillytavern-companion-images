import assert from "node:assert/strict";
import crypto from "node:crypto";
import { test } from "node:test";
import {
  buildBridgeInputFromDiscord,
  createRemixDiscordTool,
  discordSlashCommands,
  isRemixDiscordInteraction,
  parseDiscordInteraction,
  runDiscordRemixInteraction,
  shouldHandleDiscordInteraction,
  verifyDiscordSignature,
} from "../adapters/discord/remix-discord-tool.mjs";

test("Discord slash commands include generation and preview tools", () => {
  const commands = discordSlashCommands();
  assert.ok(commands.some((command) => command.name === "selfie"));
  assert.ok(commands.some((command) => command.name === "preview"));
  assert.ok(commands.find((command) => command.name === "couple").options.some((option) => option.name === "yes"));
});

test("Discord routing helpers identify only Remix.Camera application commands", () => {
  const interaction = {
    type: 2,
    data: {
      name: "selfie",
      options: [{ name: "prompt", value: "couch lamp" }],
    },
  };

  assert.equal(isRemixDiscordInteraction(interaction), true);
  assert.equal(shouldHandleDiscordInteraction(interaction), true);
  assert.equal(isRemixDiscordInteraction({ type: 2, data: { name: "unknown" } }), false);
  assert.equal(shouldHandleDiscordInteraction({ type: 1 }), false);
});

test("Discord parser and bridge input enforce couple consent", () => {
  const interaction = {
    data: {
      name: "couple",
      options: [
        { name: "yes", value: true },
        { name: "prompt", value: "coffee shop booth" },
      ],
    },
  };
  const parsed = parseDiscordInteraction(interaction);
  const input = buildBridgeInputFromDiscord(parsed, {
    profileId: "profile_lily",
    characterName: "Lily",
  });

  assert.equal(parsed.command, "couple-photo");
  assert.equal(parsed.action, "generate");
  assert.equal(input.yes, true);
  assert.equal(input.userConsent, "yes");
  assert.equal(input.location, "coffee shop booth");
});

test("Discord run calls bridge per-command generate endpoint", async () => {
  const calls = [];
  const interaction = {
    data: {
      name: "selfie",
      options: [{ name: "prompt", value: "couch lamp" }],
    },
  };
  const result = await runDiscordRemixInteraction(interaction, {
    bridgeUrl: "http://127.0.0.1:8787",
    profileId: "profile_lily",
    characterName: "Lily",
    fetchImpl: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      return new Response(
        JSON.stringify({
          ok: true,
          markdown: "![Lily send-selfie](http://127.0.0.1:8787/v1/images/photo_1)",
          results: [{ ok: true, imageUrl: "http://127.0.0.1:8787/v1/images/photo_1" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  });

  assert.equal(calls[0].url, "http://127.0.0.1:8787/v1/tools/send-selfie/generate");
  assert.equal(calls[0].body.yes, true);
  assert.equal(calls[0].body.profileId, "profile_lily");
  assert.deepEqual(result.imageUrls, ["http://127.0.0.1:8787/v1/images/photo_1"]);
});

test("Discord Ed25519 signature verifier accepts valid signatures and rejects tampering", () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
  const publicKeyDer = publicKey.export({ format: "der", type: "spki" });
  const rawPublicKey = publicKeyDer.subarray(-32).toString("hex");
  const timestamp = "1781253600";
  const body = Buffer.from(JSON.stringify({ type: 1 }));
  const signature = crypto.sign(null, Buffer.concat([Buffer.from(timestamp), body]), privateKey).toString("hex");

  assert.equal(verifyDiscordSignature({ publicKey: rawPublicKey, signature, timestamp, body }), true);
  assert.equal(verifyDiscordSignature({ publicKey: rawPublicKey, signature, timestamp, body: Buffer.from("{}") }), false);
});

test("Discord detailed handler can run without auto-sending for existing bots", async () => {
  const tool = createRemixDiscordTool({
    applicationId: "app_id",
    bridgeUrl: "http://127.0.0.1:8787",
    profileId: "profile_lily",
    characterName: "Lily",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          ok: true,
          markdown: "![Lily send-selfie](https://cdn.example.test/photo_1.jpg)",
          results: [{ ok: true, imageUrl: "https://cdn.example.test/photo_1.jpg" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  });

  const details = await tool.handleInteractionDetailed(
    {
      id: "interaction_1",
      token: "interaction_token",
      type: 2,
      data: {
        name: "selfie",
        options: [{ name: "prompt", value: "couch lamp" }],
      },
    },
    { autoSend: false },
  );

  assert.equal(details.handled, true);
  assert.equal(details.interactionId, "interaction_1");
  assert.equal(details.interactionToken, "interaction_token");
  assert.equal(details.parsed.command, "send-selfie");
  assert.deepEqual(details.result.imageUrls, ["https://cdn.example.test/photo_1.jpg"]);
  assert.deepEqual(details.sentMessages, []);
});

test("Discord detailed handler returns sent webhook records when auto-send is enabled", async (t) => {
  const originalFetch = globalThis.fetch;
  const webhookCalls = [];
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (url, options = {}) => {
    webhookCalls.push({ url: String(url), options });
    assert.equal(String(url), "https://discord.com/api/v10/webhooks/app_id/interaction_token");
    const payload = JSON.parse(options.body.get("payload_json"));
    assert.equal(payload.content, "Remix.Camera");
    assert.equal(payload.embeds[0].image.url, "https://cdn.example.test/photo_1.jpg");
    return new Response(JSON.stringify({ id: "message_1" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const tool = createRemixDiscordTool({
    applicationId: "app_id",
    bridgeUrl: "http://127.0.0.1:8787",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          ok: true,
          markdown: "![Lily send-selfie](https://cdn.example.test/photo_1.jpg)",
          results: [{ ok: true, imageUrl: "https://cdn.example.test/photo_1.jpg" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  });

  const details = await tool.handleInteractionDetailed({
    token: "interaction_token",
    type: 2,
    data: {
      name: "selfie",
      options: [{ name: "prompt", value: "couch lamp" }],
    },
  });

  assert.equal(details.handled, true);
  assert.equal(details.sentMessages[0].id, "message_1");
  assert.equal(webhookCalls.length, 1);
});

test("Discord simple interaction handler remains compatible when destructured", async () => {
  const tool = createRemixDiscordTool({
    bridgeUrl: "http://127.0.0.1:8787",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          ok: true,
          markdown: "![Lily send-selfie](https://cdn.example.test/photo_1.jpg)",
          results: [{ ok: true, imageUrl: "https://cdn.example.test/photo_1.jpg" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  });
  const { handleInteraction } = tool;

  const result = await handleInteraction({
    type: 2,
    data: {
      name: "selfie",
      options: [{ name: "prompt", value: "couch lamp" }],
    },
  });

  assert.equal(result.command, "send-selfie");
  assert.deepEqual(result.imageUrls, ["https://cdn.example.test/photo_1.jpg"]);
});
