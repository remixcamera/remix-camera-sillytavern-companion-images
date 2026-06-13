import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import {
  buildBridgeInputFromCrisp,
  crispMessagesForResult,
  parseCrispCommand,
  runCrispRemixCommand,
  sendCrispRemixResult,
} from "../adapters/crisp/remix-crisp-tool.mjs";
import {
  buildBridgeInputFromIntercom,
  intercomReplyPayloadForResult,
  parseIntercomCommand,
  runIntercomRemixCommand,
  sendIntercomRemixResult,
} from "../adapters/intercom/remix-intercom-tool.mjs";
import {
  buildBridgeInputFromTidio,
  parseTidioCommand,
  runTidioRemixCommand,
  sendTidioTicketReply,
  tidioReplyTextForResult,
  tidioWidgetScriptForResult,
  verifyTidioSignature,
} from "../adapters/tidio/remix-tidio-tool.mjs";
import {
  buildBridgeInputFromZendesk,
  parseZendeskCommand,
  runZendeskRemixCommand,
  sendZendeskRemixResult,
  zendeskMessagesForResult,
} from "../adapters/zendesk/remix-zendesk-sunshine-tool.mjs";

const generatedResult = {
  type: "bridge",
  command: "send-selfie",
  imageUrls: ["http://127.0.0.1:8787/v1/images/local"],
  payload: {
    results: [
      {
        imageUrl: "http://127.0.0.1:8787/v1/images/local",
        productionImageUrl: "https://cdn.example/remix-camera-lily.jpg",
      },
    ],
  },
};

test("web-chat parsers and bridge inputs preserve preview and consent behavior", () => {
  for (const [name, parse, build] of [
    ["intercom", parseIntercomCommand, buildBridgeInputFromIntercom],
    ["zendesk", parseZendeskCommand, buildBridgeInputFromZendesk],
    ["crisp", parseCrispCommand, buildBridgeInputFromCrisp],
    ["tidio", parseTidioCommand, buildBridgeInputFromTidio],
  ]) {
    assert.deepEqual(parse("preview vacation Amalfi coast"), {
      type: "image",
      action: "dry-run",
      command: "couples-vacation",
      text: "Amalfi coast",
    });
    assert.deepEqual(parse("help"), { type: "help" });
    const vacation = build(parse("vacation yes Amalfi coast"), {
      profileId: "profile_lily",
      characterName: "Lily",
    });
    assert.equal(vacation.profileId, "profile_lily", `${name} keeps profile id`);
    assert.equal(vacation.yes, true, `${name} generation sets yes`);
    assert.equal(vacation.userConsent, "yes", `${name} couple/vacation consent`);
    assert.equal(vacation.maxGenerations, 3, `${name} vacation generates three images`);
    const privateSnap = build(parse("snap bedroom mirror"), {});
    assert.equal(privateSnap.matureContent, true, `${name} snap marks mature content`);
    assert.equal(privateSnap.yes, undefined, `${name} snap requires explicit yes`);
  }
});

test("web-chat adapters refuse guarded generation before calling bridge", async () => {
  for (const [name, parse, run] of [
    ["intercom", parseIntercomCommand, runIntercomRemixCommand],
    ["zendesk", parseZendeskCommand, runZendeskRemixCommand],
    ["crisp", parseCrispCommand, runCrispRemixCommand],
    ["tidio", parseTidioCommand, runTidioRemixCommand],
  ]) {
    const result = await run(parse("vacation Amalfi coast"), {
      fetchImpl: () => {
        throw new Error(`${name} should not call bridge`);
      },
    });
    assert.equal(result.type, "text", name);
    assert.match(result.text, /explicit yes/, name);
  }
});

test("web-chat adapters call bridge for previews without spending", async () => {
  for (const [name, parse, run] of [
    ["intercom", parseIntercomCommand, runIntercomRemixCommand],
    ["zendesk", parseZendeskCommand, runZendeskRemixCommand],
    ["crisp", parseCrispCommand, runCrispRemixCommand],
    ["tidio", parseTidioCommand, runTidioRemixCommand],
  ]) {
    const calls = [];
    const result = await run(parse("preview selfie cozy couch"), {
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
    assert.equal(calls[0].url, "http://bridge.local/v1/tools/send-selfie/dry-run", name);
    assert.equal(calls[0].body.yes, undefined, name);
    assert.match(result.text, /Preview ready/, name);
  }
});

test("Intercom payload and sender use attachment_urls with public production URLs", async () => {
  const payload = intercomReplyPayloadForResult(generatedResult, { adminId: "admin_1" });
  assert.equal(payload.message_type, "comment");
  assert.equal(payload.type, "admin");
  assert.equal(payload.admin_id, "admin_1");
  assert.deepEqual(payload.attachment_urls, ["https://cdn.example/remix-camera-lily.jpg"]);

  const localOnly = intercomReplyPayloadForResult({
    type: "bridge",
    imageUrls: ["http://127.0.0.1:8787/v1/images/local"],
  });
  assert.equal(localOnly.attachment_urls, undefined);
  assert.match(localOnly.body, /cannot fetch 127\.0\.0\.1/);

  const calls = [];
  await sendIntercomRemixResult({
    accessToken: "intercom-token",
    conversationId: "conv_1",
    adminId: "admin_1",
    intercomVersion: "2.8",
    result: generatedResult,
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), headers: options.headers, body: JSON.parse(options.body) });
      return Response.json({ type: "conversation", id: "conv_1" });
    },
  });
  assert.equal(calls[0].url, "https://api.intercom.io/conversations/conv_1/reply");
  assert.equal(calls[0].headers.Authorization, "Bearer intercom-token");
  assert.equal(calls[0].headers["Intercom-Version"], "2.8");
  assert.deepEqual(calls[0].body.attachment_urls, ["https://cdn.example/remix-camera-lily.jpg"]);
});

test("Zendesk sends text then native image messages", async () => {
  const messages = zendeskMessagesForResult(generatedResult);
  assert.equal(messages[0].author.type, "business");
  assert.equal(messages[0].content.type, "text");
  assert.equal(messages[1].content.type, "image");
  assert.equal(messages[1].content.mediaUrl, "https://cdn.example/remix-camera-lily.jpg");

  const calls = [];
  await sendZendeskRemixResult({
    subdomain: "remix",
    appId: "app_1",
    conversationId: "conv_1",
    keyId: "key_id",
    secret: "secret",
    result: generatedResult,
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), headers: options.headers, body: JSON.parse(options.body) });
      return Response.json({ message: { id: `message_${calls.length}` } });
    },
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "https://remix.zendesk.com/sc/v2/apps/app_1/conversations/conv_1/messages");
  assert.equal(calls[0].headers.Authorization, `Basic ${Buffer.from("key_id:secret").toString("base64")}`);
  assert.equal(calls[1].body.content.type, "image");
  assert.equal(calls[1].body.content.mediaUrl, "https://cdn.example/remix-camera-lily.jpg");
});

test("Crisp sends operator text and file messages with website token headers", async () => {
  const messages = crispMessagesForResult(generatedResult);
  assert.equal(messages[0].type, "text");
  assert.equal(messages[0].from, "operator");
  assert.equal(messages[1].type, "file");
  assert.equal(messages[1].content.url, "https://cdn.example/remix-camera-lily.jpg");
  assert.equal(messages[1].content.type, "image/jpeg");

  const calls = [];
  await sendCrispRemixResult({
    tokenId: "token_id",
    tokenKey: "token_key",
    websiteId: "website_1",
    sessionId: "session_1",
    result: generatedResult,
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), headers: options.headers, body: JSON.parse(options.body) });
      return Response.json({ error: false, data: { fingerprint: `message_${calls.length}` } });
    },
  });
  assert.equal(calls.length, 2);
  assert.equal(calls[0].url, "https://api.crisp.chat/v1/website/website_1/conversation/session_1/message");
  assert.equal(calls[0].headers.Authorization, `Basic ${Buffer.from("token_id:token_key").toString("base64")}`);
  assert.equal(calls[0].headers["X-Crisp-Tier"], "website");
  assert.equal(calls[1].body.type, "file");
  assert.equal(calls[1].body.content.url, "https://cdn.example/remix-camera-lily.jpg");
});

test("Tidio verifies webhook signatures and returns text-link/widget delivery", async () => {
  const body = JSON.stringify({ webhook_id: "evt_1", content: "preview selfie couch" });
  const timestamp = "1680652800";
  const secret = "tidio-secret";
  const signature = crypto.createHmac("sha256", secret).update(`${body}_${timestamp}`).digest("hex");
  assert.equal(verifyTidioSignature({ body, header: `t=${timestamp},s=${signature}`, secret }), true);
  assert.equal(verifyTidioSignature({ body, header: `t=${timestamp},s=bad`, secret }), false);

  const replyText = tidioReplyTextForResult(generatedResult);
  assert.match(replyText, /Remix\.Camera image ready/);
  assert.match(replyText, /https:\/\/cdn\.example\/remix-camera-lily\.jpg/);
  assert.doesNotMatch(replyText, /127\.0\.0\.1/);

  const script = tidioWidgetScriptForResult(generatedResult);
  assert.match(script, /tidioChatApi\.messageFromOperator/);
  assert.match(script, /https:\/\/cdn\.example\/remix-camera-lily\.jpg/);
  assert.doesNotMatch(script, /127\.0\.0\.1/);

  const calls = [];
  await sendTidioTicketReply({
    clientId: "client-id",
    clientSecret: "client-secret",
    ticketId: "10000",
    operatorId: "b4c3717a-d45b-4c08-ab2a-f0d38bdc0caf",
    result: generatedResult,
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), headers: options.headers, body: JSON.parse(options.body) });
      return Response.json({ id: "01HX" }, { status: 201 });
    },
  });
  assert.equal(calls[0].url, "https://api.tidio.com/tickets/10000/reply");
  assert.equal(calls[0].headers["X-Tidio-Openapi-Client-Id"], "client-id");
  assert.equal(calls[0].headers["X-Tidio-Openapi-Client-Secret"], "client-secret");
  assert.equal(calls[0].headers["Content-Type"], "application/json; version=1");
  assert.equal(calls[0].body.author_type, "operator");
  assert.equal(calls[0].body.message_type, "public");
  assert.match(calls[0].body.content, /https:\/\/cdn\.example\/remix-camera-lily\.jpg/);
});
