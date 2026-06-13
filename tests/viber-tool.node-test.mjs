import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import {
  buildBridgeInputFromViber,
  createRemixViberTool,
  extractViberTextMessages,
  parseViberCommand,
  runViberRemixCommand,
  sendViberPicture,
  shouldHandleViberWebhook,
  verifyViberSignature,
  viberMessagesForResult,
} from "../adapters/viber/remix-viber-tool.mjs";

test("Viber parser maps text commands to bridge commands", () => {
  assert.deepEqual(parseViberCommand("selfie cozy couch"), {
    type: "image",
    action: "generate",
    command: "send-selfie",
    text: "cozy couch",
  });
  assert.deepEqual(parseViberCommand("preview vacation Amalfi coast"), {
    type: "image",
    action: "dry-run",
    command: "couples-vacation",
    text: "Amalfi coast",
  });
  assert.deepEqual(parseViberCommand("help"), { type: "help" });
});

test("Viber bridge input requires explicit yes for couple and private generation", () => {
  const couple = buildBridgeInputFromViber(parseViberCommand("couple yes coffee shop booth"), {
    profileId: "profile_1",
    characterName: "Lily",
  });
  assert.equal(couple.yes, true);
  assert.equal(couple.userConsent, "yes");
  assert.equal(couple.profileId, "profile_1");

  const snap = buildBridgeInputFromViber(parseViberCommand("snap bedroom mirror"), {});
  assert.equal(snap.matureContent, true);
  assert.equal(snap.yes, undefined);
});

test("Viber routing helpers identify text webhooks", () => {
  const webhook = {
    event: "message",
    sender: { id: "viber_user_1" },
    message_token: 123,
    message: { type: "text", text: "selfie couch" },
  };
  assert.equal(shouldHandleViberWebhook(webhook), true);
  assert.deepEqual(extractViberTextMessages(webhook), [
    {
      senderId: "viber_user_1",
      sender: { id: "viber_user_1" },
      text: "selfie couch",
      messageToken: 123,
      timestamp: null,
    },
  ]);
  assert.equal(shouldHandleViberWebhook({ event: "message", sender: { id: "u" }, message: { type: "text", text: "hello" } }), false);
});

test("Viber run returns instruction instead of spending when consent is missing", async () => {
  const result = await runViberRemixCommand(parseViberCommand("vacation Amalfi coast"), {
    fetchImpl: () => {
      throw new Error("bridge should not be called");
    },
  });
  assert.equal(result.type, "text");
  assert.match(result.text, /explicit yes/);
});

test("Viber run calls bridge and extracts generated image URLs", async () => {
  const calls = [];
  const result = await runViberRemixCommand(parseViberCommand("preview selfie cozy couch"), {
    bridgeUrl: "http://bridge.local",
    fetchImpl: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      return Response.json({
        ok: true,
        dryRun: true,
        prompt: "cozy prompt",
        promptTemplate: { packTitle: "Excellent selfie" },
      });
    },
  });
  assert.equal(calls[0].url, "http://bridge.local/v1/tools/send-selfie/dry-run");
  assert.equal(calls[0].body.yes, undefined);
  assert.equal(result.payload.dryRun, true);
  assert.match(result.text, /Preview ready/);
});

test("Viber signature verifier accepts valid HMAC and rejects tampering", () => {
  const body = Buffer.from(JSON.stringify({ event: "message" }));
  const signature = crypto.createHmac("sha256", "token").update(body).digest("hex");
  assert.equal(verifyViberSignature({ authToken: "token", signature, body }), true);
  assert.equal(verifyViberSignature({ authToken: "token", signature, body: Buffer.from("{}") }), false);
});

test("Viber picture messages only use public image URLs with Viber-compatible extensions", () => {
  const messages = viberMessagesForResult({
    type: "bridge",
    imageUrls: ["http://127.0.0.1:8787/v1/images/abc"],
    payload: {
      results: [{ productionImageUrl: "https://cdn.example/remix.jpg" }],
    },
  });
  assert.deepEqual(messages, [
    {
      type: "picture",
      text: "Remix.Camera",
      media: "https://cdn.example/remix.jpg",
      thumbnail: "https://cdn.example/remix.jpg",
    },
  ]);

  const fallback = viberMessagesForResult({
    type: "bridge",
    imageUrls: ["http://127.0.0.1:8787/v1/images/abc"],
    payload: { results: [{ productionImageUrl: "https://cdn.example/remix" }] },
  });
  assert.equal(fallback[0].type, "text");
  assert.match(fallback[0].text, /public HTTPS image URL/);
});

test("Viber sender posts picture payloads to send_message", async () => {
  const calls = [];
  await sendViberPicture({
    authToken: "token",
    receiver: "viber_user_1",
    imageUrl: "https://cdn.example/remix.png",
    viberApiBaseUrl: "https://chatapi.viber.test/pa",
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, body: JSON.parse(options.body), token: options.headers["X-Viber-Auth-Token"] });
      return Response.json({ status: 0, status_message: "ok" });
    },
  });
  assert.equal(calls[0].url, "https://chatapi.viber.test/pa/send_message");
  assert.equal(calls[0].token, "token");
  assert.equal(calls[0].body.type, "picture");
  assert.equal(calls[0].body.media, "https://cdn.example/remix.png");
});

test("Viber detailed handler can run without auto-sending for existing bots", async () => {
  const tool = createRemixViberTool({
    bridgeUrl: "http://bridge.local",
    autoSend: false,
    fetchImpl: async () =>
      Response.json({
        ok: true,
        dryRun: true,
        prompt: "cozy prompt",
        promptTemplate: { packTitle: "Excellent selfie" },
      }),
  });

  const details = await tool.handleWebhookDetailed({
    event: "message",
    sender: { id: "viber_user_1" },
    message: { type: "text", text: "preview selfie couch" },
  });
  assert.equal(details[0].handled, true);
  assert.equal(details[0].sentMessages.length, 0);
  assert.equal(details[0].result.payload.dryRun, true);
});
