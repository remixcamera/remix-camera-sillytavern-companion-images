import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBridgeInputFromMattermost,
  createRemixMattermostTool,
  mattermostPayloadForResult,
  parseMattermostCommand,
  runMattermostRemixCommand,
  sendMattermostWebhook,
  verifyMattermostToken,
} from "../adapters/mattermost/remix-mattermost-tool.mjs";
import {
  buildBridgeInputFromRocketChat,
  createRemixRocketChatTool,
  parseRocketChatCommand,
  rocketChatMessageForResult,
  runRocketChatRemixCommand,
  sendRocketChatRemixResult,
  verifyRocketChatToken,
} from "../adapters/rocketchat/remix-rocketchat-tool.mjs";

test("Mattermost parser and bridge input map commands to guarded bridge calls", () => {
  assert.deepEqual(parseMattermostCommand("selfie cozy couch"), {
    type: "image",
    action: "generate",
    command: "send-selfie",
    text: "cozy couch",
  });
  assert.deepEqual(parseMattermostCommand("preview vacation Amalfi coast"), {
    type: "image",
    action: "dry-run",
    command: "couples-vacation",
    text: "Amalfi coast",
  });
  assert.deepEqual(parseMattermostCommand("help"), { type: "help" });

  const vacation = buildBridgeInputFromMattermost(parseMattermostCommand("vacation yes Amalfi coast"), {
    profileId: "profile_lily",
    characterName: "Lily",
  });
  assert.equal(vacation.yes, true);
  assert.equal(vacation.userConsent, "yes");
  assert.equal(vacation.maxGenerations, 3);
  assert.equal(vacation.profileId, "profile_lily");

  const snap = buildBridgeInputFromMattermost(parseMattermostCommand("snap bedroom mirror"), {});
  assert.equal(snap.matureContent, true);
  assert.equal(snap.yes, undefined);
});

test("Mattermost token verifier and consent gate avoid unsafe bridge calls", async () => {
  assert.equal(verifyMattermostToken({ expectedToken: "secret", receivedToken: "secret" }), true);
  assert.equal(verifyMattermostToken({ expectedToken: "secret", receivedToken: "wrong" }), false);
  assert.equal(verifyMattermostToken({ expectedToken: "", receivedToken: "anything" }), true);

  const result = await runMattermostRemixCommand(parseMattermostCommand("vacation Amalfi coast"), {
    fetchImpl: () => {
      throw new Error("bridge should not be called");
    },
  });
  assert.equal(result.type, "text");
  assert.match(result.text, /explicit yes/);
});

test("Mattermost run calls the bridge and formats production image attachments", async () => {
  const calls = [];
  const result = await runMattermostRemixCommand(parseMattermostCommand("preview selfie cozy couch"), {
    bridgeUrl: "http://bridge.local",
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), body: JSON.parse(options.body) });
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

  const payload = mattermostPayloadForResult(
    {
      type: "bridge",
      imageUrls: ["http://127.0.0.1:8787/v1/images/abc"],
      payload: {
        results: [{ imageUrl: "http://127.0.0.1:8787/v1/images/abc", productionImageUrl: "https://cdn.example/abc.jpg" }],
      },
    },
    { responseType: "in_channel" },
  );
  assert.equal(payload.response_type, "in_channel");
  assert.equal(payload.text, "Remix.Camera image ready.");
  assert.equal(payload.attachments[0].image_url, "https://cdn.example/abc.jpg");

  const localOnly = mattermostPayloadForResult({
    type: "bridge",
    imageUrls: ["http://127.0.0.1:8787/v1/images/abc"],
  });
  assert.match(localOnly.text, /cannot fetch 127\.0\.0\.1/);
  assert.deepEqual(localOnly.attachments, []);
});

test("Mattermost sender posts webhook JSON and invalid token rejects before bridge", async () => {
  const calls = [];
  await sendMattermostWebhook({
    webhookUrl: "https://mattermost.test/hooks/abc",
    payload: { text: "hello" },
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), body: JSON.parse(options.body) });
      return new Response("ok", { status: 200 });
    },
  });
  assert.deepEqual(calls, [{ url: "https://mattermost.test/hooks/abc", body: { text: "hello" } }]);

  const tool = createRemixMattermostTool({
    expectedToken: "secret",
    fetchImpl: () => {
      throw new Error("bridge should not be called");
    },
  });
  const details = await tool.handleSlashCommandDetailed({ token: "wrong", text: "selfie couch" });
  assert.equal(details.handled, false);
  assert.equal(details.reason, "invalid-token");
});

test("Rocket.Chat parser and bridge input map commands to guarded bridge calls", () => {
  assert.deepEqual(parseRocketChatCommand("selfie cozy couch"), {
    type: "image",
    action: "generate",
    command: "send-selfie",
    text: "cozy couch",
  });
  assert.deepEqual(parseRocketChatCommand("preview vacation Amalfi coast"), {
    type: "image",
    action: "dry-run",
    command: "couples-vacation",
    text: "Amalfi coast",
  });
  assert.deepEqual(parseRocketChatCommand("help"), { type: "help" });

  const vacation = buildBridgeInputFromRocketChat(parseRocketChatCommand("vacation yes Amalfi coast"), {
    profileId: "profile_lily",
  });
  assert.equal(vacation.yes, true);
  assert.equal(vacation.userConsent, "yes");
  assert.equal(vacation.maxGenerations, 3);

  const snap = buildBridgeInputFromRocketChat(parseRocketChatCommand("snap bedroom mirror"), {});
  assert.equal(snap.matureContent, true);
  assert.equal(snap.yes, undefined);
});

test("Rocket.Chat token verifier and consent gate avoid unsafe bridge calls", async () => {
  assert.equal(verifyRocketChatToken({ expectedToken: "secret", receivedToken: "secret" }), true);
  assert.equal(verifyRocketChatToken({ expectedToken: "secret", receivedToken: "wrong" }), false);
  assert.equal(verifyRocketChatToken({ expectedToken: "", receivedToken: "anything" }), true);

  const result = await runRocketChatRemixCommand(parseRocketChatCommand("snap bedroom mirror"), {
    fetchImpl: () => {
      throw new Error("bridge should not be called");
    },
  });
  assert.equal(result.type, "text");
  assert.match(result.text, /explicit yes/);
});

test("Rocket.Chat run calls bridge and formats production image attachments", async () => {
  const calls = [];
  const result = await runRocketChatRemixCommand(parseRocketChatCommand("preview selfie cozy couch"), {
    bridgeUrl: "http://bridge.local",
    fetchImpl: async (url, options) => {
      calls.push({ url: String(url), body: JSON.parse(options.body) });
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
  assert.match(result.text, /Preview ready/);

  const message = rocketChatMessageForResult(
    {
      type: "bridge",
      imageUrls: ["http://127.0.0.1:8787/v1/images/abc"],
      payload: {
        results: [{ imageUrl: "http://127.0.0.1:8787/v1/images/abc", productionImageUrl: "https://cdn.example/abc.jpg" }],
      },
    },
    { roomId: "ROOM1" },
  );
  assert.equal(message.roomId, "ROOM1");
  assert.equal(message.parseUrls, false);
  assert.equal(message.attachments[0].image_url, "https://cdn.example/abc.jpg");

  const localOnly = rocketChatMessageForResult({
    type: "bridge",
    imageUrls: ["http://127.0.0.1:8787/v1/images/abc"],
  });
  assert.match(localOnly.text, /cannot fetch 127\.0\.0\.1/);
  assert.deepEqual(localOnly.attachments, []);
});

test("Rocket.Chat sender uses REST headers and invalid token rejects before bridge", async () => {
  const calls = [];
  await sendRocketChatRemixResult({
    serverUrl: "https://chat.example.com/",
    authToken: "auth-token",
    userId: "user-id",
    roomId: "ROOM1",
    result: {
      type: "bridge",
      imageUrls: [],
      text: "Ready",
    },
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), headers: options.headers, body: JSON.parse(options.body) });
      return Response.json({ success: true });
    },
  });
  assert.equal(calls[0].url, "https://chat.example.com/api/v1/chat.postMessage");
  assert.equal(calls[0].headers["X-Auth-Token"], "auth-token");
  assert.equal(calls[0].headers["X-User-Id"], "user-id");
  assert.equal(calls[0].body.roomId, "ROOM1");
  assert.equal(calls[0].body.text, "Ready");

  const tool = createRemixRocketChatTool({
    expectedToken: "secret",
    fetchImpl: () => {
      throw new Error("bridge should not be called");
    },
  });
  const details = await tool.handleWebhookDetailed({ token: "wrong", text: "selfie couch" });
  assert.equal(details.handled, false);
  assert.equal(details.reason, "invalid-token");
});
