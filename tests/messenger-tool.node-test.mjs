import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import {
  buildBridgeInputFromMessenger,
  extractMessengerTextMessages,
  parseMessengerCommand,
  runMessengerRemixCommand,
  sendMessengerRemixResult,
  verifyMessengerSignature,
} from "../adapters/messenger/remix-messenger-tool.mjs";

test("Messenger parser maps text commands to bridge commands", () => {
  assert.deepEqual(parseMessengerCommand("selfie cozy couch"), {
    type: "image",
    action: "generate",
    command: "send-selfie",
    text: "cozy couch",
  });
  assert.deepEqual(parseMessengerCommand("preview vacation Amalfi coast"), {
    type: "image",
    action: "dry-run",
    command: "couples-vacation",
    text: "Amalfi coast",
  });
  assert.deepEqual(parseMessengerCommand("help"), { type: "help" });
});

test("Messenger bridge input requires explicit yes for couple and private generation", () => {
  const couple = buildBridgeInputFromMessenger(parseMessengerCommand("couple yes coffee shop booth"), {
    profileId: "profile_1",
    characterName: "Lily",
  });
  assert.equal(couple.yes, true);
  assert.equal(couple.userConsent, "yes");
  assert.equal(couple.profileId, "profile_1");

  const snap = buildBridgeInputFromMessenger(parseMessengerCommand("snap bedroom mirror"), {});
  assert.equal(snap.matureContent, true);
  assert.equal(snap.yes, undefined);
});

test("Messenger run returns instruction instead of spending when consent is missing", async () => {
  const result = await runMessengerRemixCommand(parseMessengerCommand("vacation Amalfi coast"), {
    fetchImpl: () => {
      throw new Error("bridge should not be called");
    },
  });
  assert.equal(result.type, "text");
  assert.match(result.text, /explicit yes/);
});

test("Messenger run calls bridge and extracts generated image URLs", async () => {
  const calls = [];
  const result = await runMessengerRemixCommand(parseMessengerCommand("selfie cozy couch"), {
    bridgeUrl: "http://bridge.local",
    fetchImpl: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      return Response.json({
        ok: true,
        markdown: "![image](http://127.0.0.1:8787/v1/images/abc)",
        results: [{ imageUrl: "http://127.0.0.1:8787/v1/images/abc", productionImageUrl: "https://cdn.example/abc.jpg" }],
      });
    },
  });
  assert.equal(calls[0].url, "http://bridge.local/v1/tools/send-selfie/generate");
  assert.equal(calls[0].body.yes, true);
  assert.deepEqual(result.imageUrls, ["http://127.0.0.1:8787/v1/images/abc"]);
});

test("Messenger signature verifier accepts valid HMAC and rejects tampering", () => {
  const body = Buffer.from(JSON.stringify({ object: "page", entry: [] }));
  const signature = `sha256=${crypto.createHmac("sha256", "secret").update(body).digest("hex")}`;
  assert.equal(verifyMessengerSignature({ appSecret: "secret", signature, body }), true);
  assert.equal(verifyMessengerSignature({ appSecret: "secret", signature, body: Buffer.from("{}") }), false);
});

test("Messenger sender uses productionImageUrl for image attachments", async () => {
  const calls = [];
  await sendMessengerRemixResult({
    pageAccessToken: "page_token",
    recipientId: "user_1",
    graphApiBaseUrl: "https://graph.example/v25.0",
    result: {
      type: "bridge",
      imageUrls: ["http://127.0.0.1:8787/v1/images/abc"],
      payload: {
        results: [{ imageUrl: "http://127.0.0.1:8787/v1/images/abc", productionImageUrl: "https://cdn.example/abc.jpg" }],
      },
    },
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), body: JSON.parse(options.body) });
      return Response.json({ recipient_id: "user_1", message_id: "mid_1" });
    },
  });
  assert.equal(calls[0].url, "https://graph.example/v25.0/me/messages?access_token=page_token");
  assert.equal(calls[0].body.recipient.id, "user_1");
  assert.equal(calls[0].body.message.attachment.payload.url, "https://cdn.example/abc.jpg");
});

test("Messenger webhook extraction returns text messages", () => {
  const messages = extractMessengerTextMessages({
    entry: [
      {
        messaging: [
          {
            sender: { id: "user_1" },
            recipient: { id: "page_1" },
            message: { mid: "mid_1", text: "selfie couch" },
          },
        ],
      },
    ],
  });
  assert.deepEqual(messages, [
    {
      senderId: "user_1",
      recipientId: "page_1",
      text: "selfie couch",
      messageId: "mid_1",
    },
  ]);
});
