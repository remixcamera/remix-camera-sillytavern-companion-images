import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import {
  buildBridgeInputFromZalo,
  createRemixZaloTool,
  extractZaloTextMessages,
  parseZaloCommand,
  runZaloRemixCommand,
  sendZaloImage,
  shouldHandleZaloWebhook,
  verifyZaloMac,
  zaloMessagesForResult,
} from "../adapters/zalo/remix-zalo-tool.mjs";

test("Zalo parser maps text commands to bridge commands", () => {
  assert.deepEqual(parseZaloCommand("selfie cozy couch"), {
    type: "image",
    action: "generate",
    command: "send-selfie",
    text: "cozy couch",
  });
  assert.deepEqual(parseZaloCommand("preview vacation Amalfi coast"), {
    type: "image",
    action: "dry-run",
    command: "couples-vacation",
    text: "Amalfi coast",
  });
  assert.deepEqual(parseZaloCommand("help"), { type: "help" });
});

test("Zalo webhook extraction returns text messages", () => {
  const payload = {
    event_name: "user_send_text",
    sender: { id: "zalo_user_1" },
    message: { text: "selfie couch", msg_id: "msg_1" },
  };
  assert.deepEqual(extractZaloTextMessages(payload), [
    {
      userId: "zalo_user_1",
      text: "selfie couch",
      eventName: "user_send_text",
      messageId: "msg_1",
    },
  ]);
  assert.equal(shouldHandleZaloWebhook(payload), true);
});

test("Zalo bridge input requires explicit yes for couple and private generation", () => {
  const couple = buildBridgeInputFromZalo(parseZaloCommand("couple yes coffee shop booth"), {
    profileId: "profile_1",
    characterName: "Lily",
  });
  assert.equal(couple.yes, true);
  assert.equal(couple.userConsent, "yes");
  assert.equal(couple.profileId, "profile_1");

  const snap = buildBridgeInputFromZalo(parseZaloCommand("snap bedroom mirror"), {});
  assert.equal(snap.matureContent, true);
  assert.equal(snap.yes, undefined);
});

test("Zalo run returns instruction instead of spending when consent is missing", async () => {
  const result = await runZaloRemixCommand(parseZaloCommand("snap bedroom mirror"), {
    fetchImpl: () => {
      throw new Error("bridge should not be called");
    },
  });
  assert.equal(result.type, "text");
  assert.match(result.text, /explicit yes/);
});

test("Zalo run calls bridge and returns dry-run text", async () => {
  const calls = [];
  const result = await runZaloRemixCommand(parseZaloCommand("preview selfie cozy couch"), {
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

test("Zalo MAC verifier accepts valid HMAC and rejects tampering", () => {
  const body = Buffer.from(JSON.stringify({ event_name: "user_send_text" }));
  const mac = crypto.createHmac("sha256", "secret").update(`1781340000.${body.toString("utf8")}`).digest("hex");
  assert.equal(verifyZaloMac({ appSecret: "secret", mac, timestamp: "1781340000", body }), true);
  assert.equal(verifyZaloMac({ appSecret: "secret", mac, timestamp: "1781340001", body }), false);
});

test("Zalo messages prefer productionImageUrl over local bridge URLs", () => {
  const messages = zaloMessagesForResult({
    type: "bridge",
    imageUrls: ["http://127.0.0.1:8787/v1/images/abc"],
    payload: {
      results: [{ productionImageUrl: "https://cdn.example/remix.jpg" }],
    },
  });
  assert.deepEqual(messages, [
    {
      type: "image",
      text: "Remix.Camera",
      imageUrl: "https://cdn.example/remix.jpg",
    },
  ]);

  const fallback = zaloMessagesForResult({
    type: "bridge",
    imageUrls: ["http://127.0.0.1:8787/v1/images/abc"],
    payload: { results: [{ imageUrl: "http://127.0.0.1:8787/v1/images/abc" }] },
  });
  assert.equal(fallback[0].type, "text");
  assert.match(fallback[0].text, /public HTTPS image URL/);
});

test("Zalo sender posts image consultation message payload", async () => {
  const calls = [];
  await sendZaloImage({
    accessToken: "token",
    userId: "zalo_user_1",
    imageUrl: "https://cdn.example/remix.jpg",
    zaloApiBaseUrl: "https://openapi.zalo.test",
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), body: JSON.parse(options.body), accessToken: options.headers.access_token });
      return Response.json({ error: 0, message: "Success" });
    },
  });
  assert.equal(calls[0].url, "https://openapi.zalo.test/v3.0/oa/message/cs");
  assert.equal(calls[0].accessToken, "token");
  assert.equal(calls[0].body.recipient.user_id, "zalo_user_1");
  assert.equal(calls[0].body.message.attachment.payload.elements[0].url, "https://cdn.example/remix.jpg");
});

test("Zalo detailed handler can run without auto-sending for existing bots", async () => {
  const tool = createRemixZaloTool({
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
    sender: { id: "zalo_user_1" },
    message: { text: "preview selfie couch" },
  });
  assert.equal(details[0].handled, true);
  assert.equal(details[0].sentMessages.length, 0);
  assert.equal(details[0].result.payload.dryRun, true);
});
