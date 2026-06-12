import assert from "node:assert/strict";
import crypto from "node:crypto";
import { test } from "node:test";
import {
  buildBridgeInputFromDiscord,
  discordSlashCommands,
  parseDiscordInteraction,
  runDiscordRemixInteraction,
  verifyDiscordSignature,
} from "../adapters/discord/remix-discord-tool.mjs";

test("Discord slash commands include generation and preview tools", () => {
  const commands = discordSlashCommands();
  assert.ok(commands.some((command) => command.name === "selfie"));
  assert.ok(commands.some((command) => command.name === "preview"));
  assert.ok(commands.find((command) => command.name === "couple").options.some((option) => option.name === "yes"));
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

