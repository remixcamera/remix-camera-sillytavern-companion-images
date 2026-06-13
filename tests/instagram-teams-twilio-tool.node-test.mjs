import assert from "node:assert/strict";
import crypto from "node:crypto";
import { test } from "node:test";
import {
  createRemixInstagramTool,
  parseInstagramCommand,
  runInstagramRemixCommand,
  sendInstagramRemixResult,
  verifyInstagramSignature,
} from "../adapters/instagram/remix-instagram-tool.mjs";
import {
  createRemixTeamsMessageHandler,
  createRemixTeamsTool,
  parseTeamsCommand,
  runTeamsRemixCommand,
  teamsActivitiesFromRemixResult,
} from "../adapters/teams/remix-teams-tool.mjs";
import {
  createRemixTwilioMmsTool,
  parseTwilioCommand,
  runTwilioRemixCommand,
  sendTwilioRemixResult,
} from "../adapters/twilio/remix-twilio-mms-tool.mjs";

function bridgeFetch({ imageUrl = "https://cdn.example.test/photo_1.jpg", dryRun = true } = {}) {
  return async (url, options = {}) => {
    assert.equal(options.method, "POST");
    assert.match(String(url), /\/v1\/tools\//);
    return new Response(
      JSON.stringify({
        ok: true,
        dryRun,
        prompt: dryRun ? "high-quality companion selfie prompt" : undefined,
        promptTemplate: dryRun ? { packTitle: "Realistic Bedroom Selfie Girl Phone Mirror" } : undefined,
        markdown: dryRun ? undefined : `![Lily](${imageUrl})`,
        results: [{ ok: true, imageUrl }],
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  };
}

test("Instagram parser maps DM commands to bridge commands", () => {
  assert.deepEqual(parseInstagramCommand("preview selfie cozy couch"), {
    type: "image",
    action: "dry-run",
    command: "send-selfie",
    text: "cozy couch",
  });
  assert.deepEqual(parseInstagramCommand("vacation yes Amalfi coast"), {
    type: "image",
    action: "generate",
    command: "couples-vacation",
    text: "yes Amalfi coast",
  });
  assert.equal(parseInstagramCommand("normal chat"), null);
});

test("Instagram run refuses private generation without explicit yes", async () => {
  const result = await runInstagramRemixCommand(parseInstagramCommand("snap warm bedroom"), {
    fetchImpl: bridgeFetch(),
  });
  assert.equal(result.type, "text");
  assert.match(result.text, /needs explicit yes/i);
});

test("Instagram detailed webhook handler can run without auto-sending", async () => {
  const tool = createRemixInstagramTool({
    bridgeUrl: "http://127.0.0.1:8787",
    autoSend: false,
    fetchImpl: bridgeFetch(),
  });
  const details = await tool.handleWebhookDetailed({
    entry: [
      {
        messaging: [
          {
            sender: { id: "igsid_1" },
            recipient: { id: "ig_1" },
            message: { mid: "mid_1", text: "preview selfie cozy couch" },
          },
        ],
      },
    ],
  });
  assert.equal(details.length, 1);
  assert.equal(details[0].handled, true);
  assert.equal(details[0].senderId, "igsid_1");
  assert.equal(details[0].result.payload.dryRun, true);
  assert.deepEqual(details[0].sentMessages, []);
});

test("Instagram sender uses public production image URLs", async () => {
  const calls = [];
  const sent = await sendInstagramRemixResult({
    accessToken: "ig_token",
    igId: "17841400000000000",
    recipientId: "igsid_1",
    result: {
      type: "bridge",
      imageUrls: ["http://127.0.0.1:8787/v1/images/local"],
      payload: {
        results: [{ imageUrl: "http://127.0.0.1:8787/v1/images/local", productionImageUrl: "https://cdn.example.test/photo.jpg" }],
      },
    },
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), body: JSON.parse(options.body) });
      return new Response(JSON.stringify({ message_id: "ig_mid_1" }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });
  assert.equal(sent[0].message_id, "ig_mid_1");
  assert.equal(calls[0].url, "https://graph.instagram.com/v24.0/17841400000000000/messages");
  assert.equal(calls[0].body.recipient.id, "igsid_1");
  assert.equal(calls[0].body.message.attachment.payload.url, "https://cdn.example.test/photo.jpg");
});

test("Instagram signature verifier accepts valid Meta signatures and rejects tampering", () => {
  const body = Buffer.from(JSON.stringify({ entry: [] }));
  const digest = crypto.createHmac("sha256", "app_secret").update(body).digest("hex");
  assert.equal(verifyInstagramSignature({ appSecret: "app_secret", signature: `sha256=${digest}`, body }), true);
  assert.equal(verifyInstagramSignature({ appSecret: "app_secret", signature: `sha256=${digest}`, body: Buffer.from("{}") }), false);
});

test("Teams parser strips bot mentions and maps commands", () => {
  assert.deepEqual(parseTeamsCommand("<at>Lily</at> preview selfie cozy couch"), {
    type: "image",
    action: "dry-run",
    command: "send-selfie",
    text: "cozy couch",
  });
  assert.deepEqual(parseTeamsCommand("couple yes coffee shop"), {
    type: "image",
    action: "generate",
    command: "couple-photo",
    text: "yes coffee shop",
  });
});

test("Teams run performs bridge dry-runs", async () => {
  const result = await runTeamsRemixCommand(parseTeamsCommand("preview selfie cozy couch"), {
    bridgeUrl: "http://127.0.0.1:8787",
    fetchImpl: bridgeFetch(),
  });
  assert.equal(result.command, "send-selfie");
  assert.equal(result.payload.dryRun, true);
  assert.match(result.text, /Preview ready/i);
});

test("Teams activities prefer public production image attachments", () => {
  const activities = teamsActivitiesFromRemixResult({
    type: "bridge",
    imageUrls: ["http://127.0.0.1:8787/v1/images/local"],
    payload: {
      results: [{ productionImageUrl: "https://cdn.example.test/photo.jpg" }],
    },
  });
  assert.equal(activities.length, 1);
  assert.equal(activities[0].attachments[0].contentType, "image/jpeg");
  assert.equal(activities[0].attachments[0].contentUrl, "https://cdn.example.test/photo.jpg");
});

test("Teams message handler passes through unrelated activities", async () => {
  const handler = createRemixTeamsMessageHandler();
  let nextCalled = false;
  const result = await handler(
    {
      activity: {
        type: "message",
        text: "normal chat",
      },
      sendActivity: async () => {
        throw new Error("unexpected send");
      },
    },
    async () => {
      nextCalled = true;
      return "next-result";
    },
  );
  assert.equal(nextCalled, true);
  assert.equal(result, "next-result");
});

test("Teams tool can auto-send through context.sendActivity", async () => {
  const sentActivities = [];
  const tool = createRemixTeamsTool({
    bridgeUrl: "http://127.0.0.1:8787",
    fetchImpl: bridgeFetch({ imageUrl: "https://cdn.example.test/photo.jpg", dryRun: false }),
  });
  const details = await tool.handleTurnDetailed({
    activity: {
      type: "message",
      id: "activity_1",
      conversation: { id: "conversation_1" },
      text: "selfie couch lamp",
    },
    sendActivity: async (activity) => {
      sentActivities.push(activity);
      return { id: `sent_${sentActivities.length}` };
    },
  });
  assert.equal(details.handled, true);
  assert.equal(details.sentMessages[0].id, "sent_1");
  assert.equal(sentActivities[0].attachments[0].contentUrl, "https://cdn.example.test/photo.jpg");
});

test("Twilio parser maps SMS commands to bridge commands", () => {
  assert.deepEqual(parseTwilioCommand("preview selfie cozy couch"), {
    type: "image",
    action: "dry-run",
    command: "send-selfie",
    text: "cozy couch",
  });
  assert.deepEqual(parseTwilioCommand("date quiet booth"), {
    type: "image",
    action: "generate",
    command: "date-night",
    text: "quiet booth",
  });
});

test("Twilio run refuses couple generation without explicit yes", async () => {
  const result = await runTwilioRemixCommand(parseTwilioCommand("couple coffee shop"), {
    fetchImpl: bridgeFetch(),
  });
  assert.equal(result.type, "text");
  assert.match(result.text, /needs explicit yes/i);
});

test("Twilio sender posts MMS with MediaUrl and Basic auth", async () => {
  const calls = [];
  const sent = await sendTwilioRemixResult({
    accountSid: "AC123",
    authToken: "auth_token",
    from: "+15550000001",
    to: "+15550000002",
    result: {
      type: "bridge",
      imageUrls: ["https://cdn.example.test/photo.jpg"],
      payload: { results: [{ imageUrl: "https://cdn.example.test/photo.jpg" }] },
    },
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), headers: options.headers, body: new URLSearchParams(options.body) });
      return new Response(JSON.stringify({ sid: "SM123" }), { status: 201, headers: { "Content-Type": "application/json" } });
    },
  });
  assert.equal(sent[0].sid, "SM123");
  assert.equal(calls[0].url, "https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json");
  assert.equal(calls[0].headers.Authorization, `Basic ${Buffer.from("AC123:auth_token").toString("base64")}`);
  assert.equal(calls[0].body.get("To"), "+15550000002");
  assert.equal(calls[0].body.get("From"), "+15550000001");
  assert.equal(calls[0].body.get("MediaUrl"), "https://cdn.example.test/photo.jpg");
});

test("Twilio inbound handler replies to the inbound sender", async () => {
  const calls = [];
  const tool = createRemixTwilioMmsTool({
    accountSid: "AC123",
    authToken: "auth_token",
    fetchImpl: async (url, options = {}) => {
      if (String(url).startsWith("http://127.0.0.1:8787/v1/tools/")) {
        return bridgeFetch({ imageUrl: "https://cdn.example.test/photo.jpg", dryRun: false })(url, options);
      }
      calls.push({ url: String(url), body: new URLSearchParams(options.body) });
      return new Response(JSON.stringify({ sid: "SM456" }), { status: 201, headers: { "Content-Type": "application/json" } });
    },
  });

  const details = await tool.handleInboundDetailed("From=%2B15550000002&To=%2B15550000001&Body=selfie%20couch&MessageSid=SM_IN");
  assert.equal(details.handled, true);
  assert.equal(details.to, "+15550000002");
  assert.equal(details.sendingFrom, "+15550000001");
  assert.equal(details.sentMessages[0].sid, "SM456");
  assert.equal(calls[0].body.get("To"), "+15550000002");
  assert.equal(calls[0].body.get("From"), "+15550000001");
});
