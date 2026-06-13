import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBridgeInputFromVk,
  createRemixVkTool,
  extractVkTextMessages,
  parseVkCommand,
  runVkRemixCommand,
  sendVkPhotoAttachment,
  sendVkRemixResult,
  shouldHandleVkWebhook,
  verifyVkCallbackSecret,
  vkMessagesForResult,
} from "../adapters/vk/remix-vk-tool.mjs";

test("VK parser maps text commands to bridge commands", () => {
  assert.deepEqual(parseVkCommand("selfie cozy couch"), {
    type: "image",
    action: "generate",
    command: "send-selfie",
    text: "cozy couch",
  });
  assert.deepEqual(parseVkCommand("preview vacation Amalfi coast"), {
    type: "image",
    action: "dry-run",
    command: "couples-vacation",
    text: "Amalfi coast",
  });
  assert.deepEqual(parseVkCommand("help"), { type: "help" });
});

test("VK bridge input requires explicit yes for couple and private generation", () => {
  const couple = buildBridgeInputFromVk(parseVkCommand("couple yes coffee shop booth"), {
    profileId: "profile_1",
    characterName: "Lily",
  });
  assert.equal(couple.yes, true);
  assert.equal(couple.userConsent, "yes");
  assert.equal(couple.profileId, "profile_1");

  const snap = buildBridgeInputFromVk(parseVkCommand("snap bedroom mirror"), {});
  assert.equal(snap.matureContent, true);
  assert.equal(snap.yes, undefined);
});

test("VK routing helpers identify Callback API message_new text", () => {
  const webhook = {
    type: "message_new",
    object: {
      message: {
        peer_id: 123456,
        from_id: 123456,
        conversation_message_id: 7,
        text: "selfie couch",
      },
    },
  };
  assert.equal(shouldHandleVkWebhook(webhook), true);
  assert.deepEqual(extractVkTextMessages(webhook), [
    {
      peerId: 123456,
      fromId: 123456,
      conversationMessageId: 7,
      text: "selfie couch",
      raw: webhook.object.message,
    },
  ]);
  assert.equal(shouldHandleVkWebhook({ type: "message_new", object: { message: { peer_id: 1, text: "hello" } } }), false);
});

test("VK run returns instruction instead of spending when consent is missing", async () => {
  const result = await runVkRemixCommand(parseVkCommand("vacation Amalfi coast"), {
    fetchImpl: () => {
      throw new Error("bridge should not be called");
    },
  });
  assert.equal(result.type, "text");
  assert.match(result.text, /explicit yes/);
});

test("VK run calls bridge and extracts generated image URLs", async () => {
  const calls = [];
  const result = await runVkRemixCommand(parseVkCommand("preview selfie cozy couch"), {
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

test("VK callback secret verifier accepts configured secret and rejects mismatches", () => {
  assert.equal(verifyVkCallbackSecret({ expectedSecret: "vk_secret", receivedSecret: "vk_secret" }), true);
  assert.equal(verifyVkCallbackSecret({ expectedSecret: "vk_secret", receivedSecret: "wrong" }), false);
  assert.equal(verifyVkCallbackSecret({ expectedSecret: "", receivedSecret: "anything" }), true);
});

test("VK result messages default to public links and can request photo attachments", () => {
  const result = {
    type: "bridge",
    imageUrls: ["http://127.0.0.1:8787/v1/images/abc"],
    payload: {
      results: [{ imageUrl: "http://127.0.0.1:8787/v1/images/abc", productionImageUrl: "https://cdn.example/abc.jpg" }],
    },
  };
  assert.deepEqual(vkMessagesForResult(result), [
    {
      type: "text",
      text: "Remix.Camera\nhttps://cdn.example/abc.jpg",
      imageUrl: "https://cdn.example/abc.jpg",
    },
  ]);
  assert.deepEqual(vkMessagesForResult(result, { attachImages: true }), [
    {
      type: "photo",
      text: "Remix.Camera\nhttps://cdn.example/abc.jpg",
      imageUrl: "https://cdn.example/abc.jpg",
    },
  ]);
});

test("VK sender posts public production links by default", async () => {
  const calls = [];
  await sendVkRemixResult({
    accessToken: "vk_token",
    peerId: 123456,
    randomIdBase: 1000,
    vkApiBaseUrl: "https://api.vk.test/method",
    result: {
      type: "bridge",
      imageUrls: ["http://127.0.0.1:8787/v1/images/abc"],
      payload: {
        results: [{ imageUrl: "http://127.0.0.1:8787/v1/images/abc", productionImageUrl: "https://cdn.example/abc.jpg" }],
      },
    },
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), body: new URLSearchParams(String(options.body)) });
      return Response.json({ response: 42 });
    },
  });
  assert.equal(calls[0].url, "https://api.vk.test/method/messages.send");
  assert.equal(calls[0].body.get("access_token"), "vk_token");
  assert.equal(calls[0].body.get("peer_id"), "123456");
  assert.equal(calls[0].body.get("random_id"), "1000");
  assert.equal(calls[0].body.get("message"), "Remix.Camera\nhttps://cdn.example/abc.jpg");
});

test("VK photo attachment sender uploads, saves, and sends attachment", async () => {
  const calls = [];
  await sendVkPhotoAttachment({
    accessToken: "vk_token",
    peerId: 123456,
    randomId: 2000,
    imageUrl: "https://cdn.example/abc.jpg",
    vkApiBaseUrl: "https://api.vk.test/method",
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), method: options.method || "GET", body: options.body });
      if (String(url).endsWith("/photos.getMessagesUploadServer")) {
        return Response.json({ response: { upload_url: "https://upload.vk.test/photo" } });
      }
      if (String(url) === "https://cdn.example/abc.jpg") {
        return new Response("fake-image", { status: 200, headers: { "Content-Type": "image/jpeg" } });
      }
      if (String(url) === "https://upload.vk.test/photo") {
        assert.equal(options.method, "POST");
        return Response.json({ server: 123, photo: "[]", hash: "hash_1" });
      }
      if (String(url).endsWith("/photos.saveMessagesPhoto")) {
        return Response.json({ response: [{ owner_id: -10, id: 55, access_key: "photo_key" }] });
      }
      if (String(url).endsWith("/messages.send")) {
        const body = new URLSearchParams(String(options.body));
        assert.equal(body.get("attachment"), "photo-10_55_photo_key");
        assert.equal(body.get("message"), "Remix.Camera");
        return Response.json({ response: 42 });
      }
      throw new Error(`unexpected URL ${url}`);
    },
  });
  assert.equal(calls.length, 5);
});

test("VK detailed handler can run without auto-sending for existing bots", async () => {
  const tool = createRemixVkTool({
    accessToken: "vk_token",
    bridgeUrl: "http://bridge.local",
    fetchImpl: async () =>
      Response.json({
        ok: true,
        results: [{ productionImageUrl: "https://cdn.example/remix.jpg" }],
      }),
  });

  const details = await tool.handleTextMessageDetailed(
    {
      peerId: 123456,
      fromId: 123456,
      text: "selfie couch",
    },
    { autoSend: false },
  );

  assert.equal(details.handled, true);
  assert.equal(details.peerId, 123456);
  assert.equal(details.parsed.command, "send-selfie");
  assert.deepEqual(details.result.imageUrls, ["https://cdn.example/remix.jpg"]);
  assert.deepEqual(details.sentMessages, []);
});

test("VK webhook handler rejects invalid callback secret before calling bridge", async () => {
  const tool = createRemixVkTool({
    callbackSecret: "vk_secret",
    fetchImpl: () => {
      throw new Error("bridge should not be called");
    },
  });
  const details = await tool.handleWebhookDetailed({
    type: "message_new",
    secret: "wrong",
    object: { message: { peer_id: 1, text: "selfie couch" } },
  });
  assert.equal(details[0].handled, false);
  assert.equal(details[0].reason, "invalid-callback-secret");
});
