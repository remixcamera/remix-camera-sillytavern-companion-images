import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBridgeInputFromMatrix,
  extractMatrixTextEvents,
  parseMatrixCommand,
  runMatrixRemixCommand,
  sendMatrixImage,
  sendMatrixRemixResult,
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
