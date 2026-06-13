import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import {
  buildBridgeInputFromLine,
  createRemixLineTool,
  extractLineTextEvents,
  isRemixLineCommand,
  lineMessagesForResult,
  parseLineCommand,
  runLineRemixCommand,
  sendLineRemixResult,
  shouldHandleLineWebhook,
  verifyLineSignature,
} from "../adapters/line/remix-line-tool.mjs";

test("LINE parser maps text commands to bridge commands", () => {
  assert.deepEqual(parseLineCommand("selfie cozy couch"), {
    type: "image",
    action: "generate",
    command: "send-selfie",
    text: "cozy couch",
  });
  assert.deepEqual(parseLineCommand("preview vacation Amalfi coast"), {
    type: "image",
    action: "dry-run",
    command: "couples-vacation",
    text: "Amalfi coast",
  });
  assert.deepEqual(parseLineCommand("help"), { type: "help" });
});

test("LINE bridge input requires explicit yes for couple and private generation", () => {
  const couple = buildBridgeInputFromLine(parseLineCommand("couple yes coffee shop booth"), {
    profileId: "profile_1",
    characterName: "Lily",
  });
  assert.equal(couple.yes, true);
  assert.equal(couple.userConsent, "yes");
  assert.equal(couple.profileId, "profile_1");

  const snap = buildBridgeInputFromLine(parseLineCommand("snap bedroom mirror"), {});
  assert.equal(snap.matureContent, true);
  assert.equal(snap.yes, undefined);
});

test("LINE routing helpers identify only Remix.Camera message text", () => {
  assert.equal(isRemixLineCommand("selfie cafe mirror"), true);
  assert.equal(isRemixLineCommand("unknown cafe mirror"), false);
  assert.equal(
    shouldHandleLineWebhook({
      events: [
        {
          type: "message",
          replyToken: "reply_1",
          source: { type: "user", userId: "U1" },
          message: { type: "text", text: "selfie couch" },
        },
      ],
    }),
    true,
  );
  assert.equal(
    shouldHandleLineWebhook({
      events: [
        {
          type: "message",
          replyToken: "reply_1",
          source: { type: "user", userId: "U1" },
          message: { type: "text", text: "hello" },
        },
      ],
    }),
    false,
  );
});

test("LINE run returns instruction instead of spending when consent is missing", async () => {
  const result = await runLineRemixCommand(parseLineCommand("snap bedroom mirror"), {
    fetchImpl: () => {
      throw new Error("bridge should not be called");
    },
  });
  assert.equal(result.type, "text");
  assert.match(result.text, /explicit yes/);
});

test("LINE run calls bridge and extracts generated image URLs", async () => {
  const calls = [];
  const result = await runLineRemixCommand(parseLineCommand("selfie cozy couch"), {
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

test("LINE signature verifier accepts valid HMAC and rejects tampering", () => {
  const body = Buffer.from(JSON.stringify({ events: [] }));
  const signature = crypto.createHmac("sha256", "secret").update(body).digest("base64");
  assert.equal(verifyLineSignature({ channelSecret: "secret", signature, body }), true);
  assert.equal(verifyLineSignature({ channelSecret: "secret", signature, body: Buffer.from("{}") }), false);
});

test("LINE messages prefer productionImageUrl over local bridge URLs", () => {
  const messages = lineMessagesForResult({
    type: "bridge",
    imageUrls: ["http://127.0.0.1:8787/v1/images/abc"],
    payload: {
      results: [{ imageUrl: "http://127.0.0.1:8787/v1/images/abc", productionImageUrl: "https://cdn.example/abc.jpg" }],
    },
  });
  assert.deepEqual(messages, [
    {
      type: "image",
      originalContentUrl: "https://cdn.example/abc.jpg",
      previewImageUrl: "https://cdn.example/abc.jpg",
    },
  ]);
});

test("LINE sender posts reply messages", async () => {
  const calls = [];
  await sendLineRemixResult({
    channelAccessToken: "token",
    replyToken: "reply_1",
    result: {
      type: "text",
      text: "hello",
      imageUrls: [],
    },
    lineApiBaseUrl: "https://api.line.test",
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), body: JSON.parse(options.body), auth: options.headers.Authorization });
      return Response.json({});
    },
  });
  assert.equal(calls[0].url, "https://api.line.test/v2/bot/message/reply");
  assert.equal(calls[0].auth, "Bearer token");
  assert.deepEqual(calls[0].body.messages, [{ type: "text", text: "hello" }]);
});

test("LINE webhook extraction returns text events", () => {
  const events = extractLineTextEvents({
    events: [
      {
        type: "message",
        replyToken: "reply_1",
        source: { type: "user", userId: "U1" },
        message: { type: "text", text: "selfie couch" },
        webhookEventId: "event_1",
      },
    ],
  });
  assert.deepEqual(events, [
    {
      replyToken: "reply_1",
      text: "selfie couch",
      source: { type: "user", userId: "U1" },
      webhookEventId: "event_1",
    },
  ]);
});

test("LINE detailed event handler can run without auto-sending for existing bots", async () => {
  const tool = createRemixLineTool({
    channelAccessToken: "token",
    bridgeUrl: "http://bridge.local",
    fetchImpl: async () =>
      Response.json({
        ok: true,
        results: [{ productionImageUrl: "https://cdn.example/remix.jpg" }],
      }),
  });

  const details = await tool.handleTextEventDetailed(
    {
      replyToken: "reply_1",
      source: { type: "user", userId: "U1" },
      webhookEventId: "event_1",
      text: "selfie couch",
    },
    { autoSend: false },
  );

  assert.equal(details.handled, true);
  assert.equal(details.replyToken, "reply_1");
  assert.equal(details.to, "U1");
  assert.equal(details.webhookEventId, "event_1");
  assert.equal(details.parsed.command, "send-selfie");
  assert.deepEqual(details.result.imageUrls, ["https://cdn.example/remix.jpg"]);
  assert.deepEqual(details.sentMessages, []);
});

test("LINE simple text event handler remains compatible when destructured", async () => {
  const tool = createRemixLineTool({
    bridgeUrl: "http://bridge.local",
    fetchImpl: async () =>
      Response.json({
        ok: true,
        results: [{ productionImageUrl: "https://cdn.example/remix.jpg" }],
      }),
  });
  const { handleTextEvent } = tool;

  const result = await handleTextEvent({ replyToken: "reply_1", text: "selfie couch" }, { autoSend: false });

  assert.equal(result.command, "send-selfie");
  assert.deepEqual(result.imageUrls, ["https://cdn.example/remix.jpg"]);
});
