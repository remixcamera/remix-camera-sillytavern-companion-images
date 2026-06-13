import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import {
  buildBridgeInputFromWeChat,
  createRemixWeChatTool,
  extractWeChatTextMessages,
  parseWeChatCommand,
  parseWeChatXmlMessage,
  runWeChatRemixCommand,
  sendWeChatImage,
  shouldHandleWeChatWebhook,
  verifyWeChatSignature,
} from "../adapters/wechat/remix-wechat-tool.mjs";

const xmlMessage = `<xml>
<ToUserName><![CDATA[oa_1]]></ToUserName>
<FromUserName><![CDATA[user_1]]></FromUserName>
<CreateTime>1781340000</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[selfie cozy couch]]></Content>
<MsgId>123</MsgId>
</xml>`;

test("WeChat parser maps text commands to bridge commands", () => {
  assert.deepEqual(parseWeChatCommand("selfie cozy couch"), {
    type: "image",
    action: "generate",
    command: "send-selfie",
    text: "cozy couch",
  });
  assert.deepEqual(parseWeChatCommand("preview vacation Amalfi coast"), {
    type: "image",
    action: "dry-run",
    command: "couples-vacation",
    text: "Amalfi coast",
  });
  assert.deepEqual(parseWeChatCommand("help"), { type: "help" });
});

test("WeChat XML extraction returns plaintext text messages", () => {
  assert.deepEqual(parseWeChatXmlMessage(xmlMessage), {
    toUserName: "oa_1",
    fromUserName: "user_1",
    createTime: "1781340000",
    msgType: "text",
    content: "selfie cozy couch",
    msgId: "123",
  });
  assert.deepEqual(extractWeChatTextMessages(xmlMessage), [
    {
      fromUserName: "user_1",
      toUserName: "oa_1",
      text: "selfie cozy couch",
      content: "selfie cozy couch",
      msgId: "123",
      createTime: "1781340000",
    },
  ]);
  assert.equal(shouldHandleWeChatWebhook(xmlMessage), true);
});

test("WeChat bridge input requires explicit yes for couple and private generation", () => {
  const couple = buildBridgeInputFromWeChat(parseWeChatCommand("couple yes coffee shop booth"), {
    profileId: "profile_1",
    characterName: "Lily",
  });
  assert.equal(couple.yes, true);
  assert.equal(couple.userConsent, "yes");
  assert.equal(couple.profileId, "profile_1");

  const snap = buildBridgeInputFromWeChat(parseWeChatCommand("snap bedroom mirror"), {});
  assert.equal(snap.matureContent, true);
  assert.equal(snap.yes, undefined);
});

test("WeChat run returns instruction instead of spending when consent is missing", async () => {
  const result = await runWeChatRemixCommand(parseWeChatCommand("vacation Amalfi coast"), {
    fetchImpl: () => {
      throw new Error("bridge should not be called");
    },
  });
  assert.equal(result.type, "text");
  assert.match(result.text, /explicit yes/);
});

test("WeChat run calls bridge and returns dry-run text", async () => {
  const calls = [];
  const result = await runWeChatRemixCommand(parseWeChatCommand("preview selfie cozy couch"), {
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

test("WeChat signature verifier accepts valid sha1 challenge signature", () => {
  const pieces = ["token", "1781340000", "nonce"].sort().join("");
  const signature = crypto.createHash("sha1").update(pieces).digest("hex");
  assert.equal(verifyWeChatSignature({ token: "token", signature, timestamp: "1781340000", nonce: "nonce" }), true);
  assert.equal(verifyWeChatSignature({ token: "token", signature, timestamp: "1781340001", nonce: "nonce" }), false);
});

test("WeChat image sender uploads media before sending customer-service image", async () => {
  const calls = [];
  await sendWeChatImage({
    accessToken: "token",
    toUser: "user_1",
    imageUrl: "http://127.0.0.1:8787/v1/images/abc",
    wechatApiBaseUrl: "https://api.weixin.test",
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), method: options.method, body: options.body });
      if (String(url).startsWith("http://127.0.0.1")) {
        return new Response(new Blob(["fake image"], { type: "image/jpeg" }), {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        });
      }
      if (String(url).includes("/cgi-bin/media/upload")) {
        assert.equal(options.method, "POST");
        assert.ok(options.body instanceof FormData);
        return Response.json({ type: "image", media_id: "media_1" });
      }
      if (String(url).includes("/cgi-bin/message/custom/send")) {
        const body = JSON.parse(options.body);
        assert.equal(body.touser, "user_1");
        assert.equal(body.msgtype, "image");
        assert.equal(body.image.media_id, "media_1");
        return Response.json({ errcode: 0, errmsg: "ok" });
      }
      throw new Error(`Unexpected fetch ${url}`);
    },
  });
  assert.equal(calls.length, 3);
});

test("WeChat detailed handler can run without auto-sending for existing bots", async () => {
  const tool = createRemixWeChatTool({
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

  const details = await tool.handleWebhookDetailed(xmlMessage);
  assert.equal(details[0].handled, true);
  assert.equal(details[0].sentMessages.length, 0);
  assert.equal(details[0].result.payload.dryRun, true);
});
