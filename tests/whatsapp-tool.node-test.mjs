import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBridgeInputFromWhatsApp,
  createRemixWhatsAppTool,
  extractWhatsAppTextMessages,
  isRemixWhatsAppCommand,
  parseWhatsAppCommand,
  runWhatsAppRemixCommand,
  sendWhatsAppImage,
  shouldHandleWhatsAppWebhook,
} from "../adapters/whatsapp/remix-whatsapp-tool.mjs";

test("WhatsApp parser maps text commands to bridge commands", () => {
  assert.deepEqual(parseWhatsAppCommand("selfie cozy couch"), {
    type: "image",
    action: "generate",
    command: "send-selfie",
    text: "cozy couch",
  });
  assert.deepEqual(parseWhatsAppCommand("/preview vacation Amalfi coast"), {
    type: "image",
    action: "dry-run",
    command: "couples-vacation",
    text: "Amalfi coast",
  });
  assert.deepEqual(parseWhatsAppCommand("help"), { type: "help" });
});

test("WhatsApp bridge input requires explicit yes for couple and private generation", () => {
  const couple = buildBridgeInputFromWhatsApp(parseWhatsAppCommand("couple yes coffee shop booth"), {
    profileId: "profile_1",
    characterName: "Lily",
  });
  assert.equal(couple.yes, true);
  assert.equal(couple.userConsent, "yes");
  assert.equal(couple.profileId, "profile_1");

  const snap = buildBridgeInputFromWhatsApp(parseWhatsAppCommand("snap bedroom mirror"), {});
  assert.equal(snap.matureContent, true);
  assert.equal(snap.yes, undefined);
});

test("WhatsApp routing helpers identify only Remix.Camera commands", () => {
  assert.equal(isRemixWhatsAppCommand("selfie cafe mirror"), true);
  assert.equal(isRemixWhatsAppCommand("unknown cafe mirror"), false);
  assert.equal(
    shouldHandleWhatsAppWebhook({
      entry: [
        {
          changes: [
            {
              value: {
                metadata: { phone_number_id: "phone_1" },
                messages: [{ from: "15555550123", id: "wamid.1", text: { body: "selfie couch" } }],
              },
            },
          ],
        },
      ],
    }),
    true,
  );
  assert.equal(shouldHandleWhatsAppWebhook({ entry: [{ changes: [{ value: { messages: [{ from: "1", text: { body: "hello" } }] } }] }] }), false);
});

test("WhatsApp run returns instruction instead of spending when consent is missing", async () => {
  const result = await runWhatsAppRemixCommand(parseWhatsAppCommand("snap bedroom mirror"), {
    fetchImpl: () => {
      throw new Error("bridge should not be called");
    },
  });
  assert.equal(result.type, "text");
  assert.match(result.text, /explicit yes/);
});

test("WhatsApp run calls bridge and extracts generated image URLs", async () => {
  const calls = [];
  const result = await runWhatsAppRemixCommand(parseWhatsAppCommand("selfie cozy couch"), {
    bridgeUrl: "http://bridge.local",
    fetchImpl: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      return Response.json({
        ok: true,
        markdown: "![image](http://127.0.0.1:8787/v1/images/abc)",
        results: [{ imageUrl: "http://127.0.0.1:8787/v1/images/abc" }],
      });
    },
  });
  assert.equal(calls[0].url, "http://bridge.local/v1/tools/send-selfie/generate");
  assert.equal(calls[0].body.yes, true);
  assert.deepEqual(result.imageUrls, ["http://127.0.0.1:8787/v1/images/abc"]);
});

test("WhatsApp sender uploads local bridge images before sending", async () => {
  const calls = [];
  await sendWhatsAppImage({
    accessToken: "token",
    phoneNumberId: "phone_1",
    to: "15555550123",
    imageUrl: "http://127.0.0.1:8787/v1/images/abc",
    graphApiBaseUrl: "https://graph.facebook.com/v25.0",
    fetchImpl: async (url, options = {}) => {
      calls.push({ url, method: options.method, body: options.body });
      if (String(url).startsWith("http://127.0.0.1")) {
        return new Response(new Blob(["fake image"], { type: "image/jpeg" }), {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        });
      }
      if (String(url).endsWith("/media")) {
        assert.equal(options.method, "POST");
        assert.ok(options.body instanceof FormData);
        return Response.json({ id: "media_1" });
      }
      if (String(url).endsWith("/messages")) {
        const body = JSON.parse(options.body);
        assert.equal(body.type, "image");
        assert.equal(body.image.id, "media_1");
        assert.equal(body.to, "15555550123");
        return Response.json({ messages: [{ id: "message_1" }] });
      }
      throw new Error(`Unexpected fetch ${url}`);
    },
  });

  assert.deepEqual(
    calls.map((call) => call.url),
    [
      "http://127.0.0.1:8787/v1/images/abc",
      "https://graph.facebook.com/v25.0/phone_1/media",
      "https://graph.facebook.com/v25.0/phone_1/messages",
    ],
  );
});

test("WhatsApp webhook extraction returns text messages", async () => {
  const messages = extractWhatsAppTextMessages({
    entry: [
      {
        changes: [
          {
            value: {
              metadata: { phone_number_id: "phone_1" },
              messages: [{ from: "15555550123", id: "wamid.1", text: { body: "selfie couch" } }],
            },
          },
        ],
      },
    ],
  });
  assert.deepEqual(messages, [
    {
      from: "15555550123",
      text: "selfie couch",
      messageId: "wamid.1",
      phoneNumberId: "phone_1",
    },
  ]);
});

test("WhatsApp tool handles a text message end to end", async () => {
  const sent = [];
  const tool = createRemixWhatsAppTool({
    accessToken: "token",
    phoneNumberId: "phone_1",
    bridgeUrl: "http://bridge.local",
    fetchImpl: async (url, options = {}) => {
      if (String(url).includes("/v1/tools/")) {
        return Response.json({
          ok: true,
          results: [{ productionImageUrl: "https://cdn.example/remix.jpg" }],
        });
      }
      sent.push({ url, body: JSON.parse(options.body) });
      return Response.json({ messages: [{ id: "message_1" }] });
    },
  });

  const result = await tool.handleText({ from: "15555550123", text: "selfie couch" });
  assert.equal(result.command, "send-selfie");
  assert.equal(sent[0].body.type, "image");
  assert.equal(sent[0].body.image.link, "https://cdn.example/remix.jpg");
});

test("WhatsApp detailed handler can run without auto-sending for existing bots", async () => {
  const tool = createRemixWhatsAppTool({
    accessToken: "token",
    phoneNumberId: "phone_1",
    bridgeUrl: "http://bridge.local",
    fetchImpl: async () =>
      Response.json({
        ok: true,
        results: [{ productionImageUrl: "https://cdn.example/remix.jpg" }],
      }),
  });

  const details = await tool.handleTextDetailed(
    { from: "15555550123", messageId: "wamid.1", text: "selfie couch" },
    { autoSend: false },
  );

  assert.equal(details.handled, true);
  assert.equal(details.to, "15555550123");
  assert.equal(details.messageId, "wamid.1");
  assert.equal(details.parsed.command, "send-selfie");
  assert.deepEqual(details.result.imageUrls, ["https://cdn.example/remix.jpg"]);
  assert.deepEqual(details.sentMessages, []);
});

test("WhatsApp simple text handler remains compatible when destructured", async () => {
  const tool = createRemixWhatsAppTool({
    bridgeUrl: "http://bridge.local",
    fetchImpl: async () =>
      Response.json({
        ok: true,
        results: [{ productionImageUrl: "https://cdn.example/remix.jpg" }],
      }),
  });
  const { handleText } = tool;

  const result = await handleText({ from: "15555550123", text: "selfie couch" }, { autoSend: false });

  assert.equal(result.command, "send-selfie");
  assert.deepEqual(result.imageUrls, ["https://cdn.example/remix.jpg"]);
});
