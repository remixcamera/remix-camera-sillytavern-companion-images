import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBridgeInputFromMatrix,
  createRemixMatrixTool,
  extractMatrixTextEvents,
  isRemixMatrixCommand,
  parseMatrixCommand,
  runMatrixRemixCommand,
  sendMatrixImage,
  sendMatrixRemixResult,
  shouldHandleMatrixSync,
  shouldHandleMatrixTextEvent,
} from "../adapters/matrix/remix-matrix-tool.mjs";

test("Matrix parser maps prefixed and direct text commands to bridge commands", () => {
  assert.deepEqual(parseMatrixCommand("!lily selfie cozy couch"), {
    type: "image",
    action: "generate",
    command: "send-selfie",
    text: "cozy couch",
  });
  assert.deepEqual(parseMatrixCommand("preview vacation Amalfi coast"), {
    type: "image",
    action: "dry-run",
    command: "couples-vacation",
    text: "Amalfi coast",
  });
  assert.deepEqual(parseMatrixCommand("/lily help"), { type: "help" });
});

test("Matrix bridge input requires explicit yes for couple and private generation", () => {
  const couple = buildBridgeInputFromMatrix(parseMatrixCommand("couple yes coffee shop booth"), {
    profileId: "profile_1",
    characterName: "Lily",
  });
  assert.equal(couple.yes, true);
  assert.equal(couple.userConsent, "yes");
  assert.equal(couple.profileId, "profile_1");

  const snap = buildBridgeInputFromMatrix(parseMatrixCommand("snap bedroom mirror"), {});
  assert.equal(snap.matureContent, true);
  assert.equal(snap.yes, undefined);
});

test("Matrix routing helpers identify commands and honor shared-room prefix settings", () => {
  assert.equal(isRemixMatrixCommand("selfie cafe mirror"), true);
  assert.equal(isRemixMatrixCommand("unknown cafe mirror"), false);
  assert.equal(shouldHandleMatrixTextEvent({ sender: "@user:example", text: "!lily selfie couch" }, { requirePrefix: true }), true);
  assert.equal(shouldHandleMatrixTextEvent({ sender: "@user:example", text: "selfie couch" }, { requirePrefix: true }), false);
  assert.equal(shouldHandleMatrixTextEvent({ sender: "@bot:example", text: "!lily selfie couch" }, { ownUserId: "@bot:example" }), false);
  assert.equal(
    shouldHandleMatrixSync(
      {
        rooms: {
          join: {
            "!room:example": {
              timeline: {
                events: [
                  { type: "m.room.message", sender: "@user:example", content: { msgtype: "m.text", body: "!lily selfie couch" } },
                ],
              },
            },
          },
        },
      },
      { requirePrefix: true },
    ),
    true,
  );
});

test("Matrix run returns instruction instead of spending when consent is missing", async () => {
  const result = await runMatrixRemixCommand(parseMatrixCommand("couple coffee shop booth"), {
    fetchImpl: () => {
      throw new Error("bridge should not be called");
    },
  });
  assert.equal(result.type, "text");
  assert.match(result.text, /explicit yes/);
});

test("Matrix run calls bridge and extracts generated image URLs", async () => {
  const calls = [];
  const result = await runMatrixRemixCommand(parseMatrixCommand("selfie cozy couch"), {
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

test("Matrix sender uploads image bytes and sends an m.image event", async () => {
  const calls = [];
  await sendMatrixImage({
    homeserverUrl: "https://matrix.example",
    accessToken: "token",
    roomId: "!room:example",
    imageUrl: "http://127.0.0.1:8787/v1/images/abc",
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), method: options.method, body: options.body });
      if (String(url).startsWith("http://127.0.0.1")) {
        return new Response(new Blob(["fake image"], { type: "image/jpeg" }), {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        });
      }
      if (String(url).startsWith("https://matrix.example/_matrix/media/v3/upload")) {
        assert.equal(options.method, "POST");
        assert.ok(options.body instanceof ArrayBuffer);
        return Response.json({ content_uri: "mxc://matrix.example/media_1" });
      }
      if (String(url).includes("/send/m.room.message/")) {
        const body = JSON.parse(options.body);
        assert.equal(body.msgtype, "m.image");
        assert.equal(body.url, "mxc://matrix.example/media_1");
        return Response.json({ event_id: "$event_1" });
      }
      throw new Error(`Unexpected fetch ${url}`);
    },
  });
  assert.equal(calls.length, 3);
});

test("Matrix sender handles complete Remix results", async () => {
  const sentBodies = [];
  await sendMatrixRemixResult({
    homeserverUrl: "https://matrix.example",
    accessToken: "token",
    roomId: "!room:example",
    result: {
      type: "bridge",
      imageUrls: ["https://cdn.example/abc.jpg"],
    },
    fetchImpl: async (url, options = {}) => {
      if (String(url).startsWith("https://cdn.example")) {
        return new Response(new Blob(["fake image"], { type: "image/jpeg" }), {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        });
      }
      if (String(url).includes("/_matrix/media/v3/upload")) {
        return Response.json({ content_uri: "mxc://matrix.example/media_1" });
      }
      sentBodies.push(JSON.parse(options.body));
      return Response.json({ event_id: "$event_1" });
    },
  });
  assert.equal(sentBodies[0].msgtype, "m.image");
});

test("Matrix sync extraction filters own messages and optional prefixes", () => {
  const events = extractMatrixTextEvents(
    {
      rooms: {
        join: {
          "!room:example": {
            timeline: {
              events: [
                { type: "m.room.message", sender: "@bot:example", content: { msgtype: "m.text", body: "!lily selfie own" } },
                { type: "m.room.message", sender: "@user:example", event_id: "$1", content: { msgtype: "m.text", body: "selfie no prefix" } },
                { type: "m.room.message", sender: "@user:example", event_id: "$2", content: { msgtype: "m.text", body: "!lily selfie couch" } },
              ],
            },
          },
        },
      },
    },
    { ownUserId: "@bot:example", requirePrefix: true },
  );
  assert.deepEqual(events, [
    {
      roomId: "!room:example",
      eventId: "$2",
      sender: "@user:example",
      text: "!lily selfie couch",
    },
  ]);
});

test("Matrix detailed event handler can run without auto-sending for existing bots", async () => {
  const tool = createRemixMatrixTool({
    accessToken: "token",
    bridgeUrl: "http://bridge.local",
    fetchImpl: async () =>
      Response.json({
        ok: true,
        results: [{ productionImageUrl: "https://cdn.example/remix.jpg" }],
      }),
  });

  const details = await tool.handleTextEventDetailed(
    {
      roomId: "!room:example",
      eventId: "$event_1",
      sender: "@user:example",
      text: "!lily selfie couch",
    },
    { autoSend: false },
  );

  assert.equal(details.handled, true);
  assert.equal(details.roomId, "!room:example");
  assert.equal(details.eventId, "$event_1");
  assert.equal(details.sender, "@user:example");
  assert.equal(details.parsed.command, "send-selfie");
  assert.deepEqual(details.result.imageUrls, ["https://cdn.example/remix.jpg"]);
  assert.deepEqual(details.sentMessages, []);
});

test("Matrix detailed event handler honors prefix and own-message guards", async () => {
  const tool = createRemixMatrixTool({
    ownUserId: "@bot:example",
    requirePrefix: true,
    bridgeUrl: "http://bridge.local",
    fetchImpl: async () => {
      throw new Error("bridge should not be called");
    },
  });

  const missingPrefix = await tool.handleTextEventDetailed({
    roomId: "!room:example",
    eventId: "$event_1",
    sender: "@user:example",
    text: "selfie couch",
  });
  assert.equal(missingPrefix.handled, false);
  assert.equal(missingPrefix.reason, "missing-prefix");

  const ownMessage = await tool.handleTextEventDetailed({
    roomId: "!room:example",
    eventId: "$event_2",
    sender: "@bot:example",
    text: "!lily selfie couch",
  });
  assert.equal(ownMessage.handled, false);
  assert.equal(ownMessage.reason, "own-message");
});

test("Matrix simple text event handler remains compatible when destructured", async () => {
  const tool = createRemixMatrixTool({
    bridgeUrl: "http://bridge.local",
    fetchImpl: async () =>
      Response.json({
        ok: true,
        results: [{ productionImageUrl: "https://cdn.example/remix.jpg" }],
      }),
  });
  const { handleTextEvent } = tool;

  const result = await handleTextEvent({ roomId: "!room:example", text: "selfie couch" }, { autoSend: false });

  assert.equal(result.command, "send-selfie");
  assert.deepEqual(result.imageUrls, ["https://cdn.example/remix.jpg"]);
});
