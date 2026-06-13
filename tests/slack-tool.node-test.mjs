import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import {
  buildBridgeInputFromSlack,
  createRemixSlackTool,
  isRemixSlackCommand,
  parseSlackCommand,
  runSlackRemixCommand,
  sendSlackRemixResult,
  shouldHandleSlackSlashCommand,
  verifySlackSignature,
} from "../adapters/slack/remix-slack-tool.mjs";

test("Slack parser maps slash-command text to bridge commands", () => {
  assert.deepEqual(parseSlackCommand("selfie cozy couch"), {
    type: "image",
    action: "generate",
    command: "send-selfie",
    text: "cozy couch",
  });
  assert.deepEqual(parseSlackCommand("preview vacation Amalfi coast"), {
    type: "image",
    action: "dry-run",
    command: "couples-vacation",
    text: "Amalfi coast",
  });
  assert.deepEqual(parseSlackCommand("help"), { type: "help" });
});

test("Slack bridge input requires explicit yes for couple and private generation", () => {
  const couple = buildBridgeInputFromSlack(parseSlackCommand("couple yes coffee shop booth"), {
    profileId: "profile_1",
    characterName: "Lily",
  });
  assert.equal(couple.yes, true);
  assert.equal(couple.userConsent, "yes");
  assert.equal(couple.profileId, "profile_1");

  const snap = buildBridgeInputFromSlack(parseSlackCommand("snap bedroom mirror"), {});
  assert.equal(snap.matureContent, true);
  assert.equal(snap.yes, undefined);
});

test("Slack routing helpers identify only Remix.Camera slash-command text", () => {
  assert.equal(isRemixSlackCommand("selfie cafe mirror"), true);
  assert.equal(isRemixSlackCommand("unknown cafe mirror"), false);
  assert.equal(shouldHandleSlackSlashCommand({ text: "preview selfie couch" }), true);
  assert.equal(shouldHandleSlackSlashCommand({ text: "hello" }), false);
});

test("Slack run returns instruction instead of spending when consent is missing", async () => {
  const result = await runSlackRemixCommand(parseSlackCommand("vacation Amalfi coast"), {
    fetchImpl: () => {
      throw new Error("bridge should not be called");
    },
  });
  assert.equal(result.type, "text");
  assert.match(result.text, /explicit yes/);
});

test("Slack run calls bridge and extracts generated image URLs", async () => {
  const calls = [];
  const result = await runSlackRemixCommand(parseSlackCommand("selfie cozy couch"), {
    bridgeUrl: "http://bridge.local",
    profileId: "profile_lily",
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
  assert.equal(calls[0].body.profileId, "profile_lily");
  assert.deepEqual(result.imageUrls, ["http://127.0.0.1:8787/v1/images/abc"]);
});

test("Slack signature verifier accepts valid signatures and rejects stale or tampered bodies", () => {
  const signingSecret = "secret";
  const timestamp = "1781253600";
  const body = Buffer.from("token=x&team_id=T1&text=selfie+couch");
  const signature = `v0=${crypto
    .createHmac("sha256", signingSecret)
    .update(Buffer.concat([Buffer.from(`v0:${timestamp}:`), body]))
    .digest("hex")}`;

  assert.equal(
    verifySlackSignature({
      signingSecret,
      timestamp,
      signature,
      body,
      now: Number(timestamp) * 1000,
    }),
    true,
  );
  assert.equal(
    verifySlackSignature({
      signingSecret,
      timestamp,
      signature,
      body: Buffer.from("token=x&team_id=T1&text=date"),
      now: Number(timestamp) * 1000,
    }),
    false,
  );
  assert.equal(
    verifySlackSignature({
      signingSecret,
      timestamp,
      signature,
      body,
      now: (Number(timestamp) + 301) * 1000,
    }),
    false,
  );
});

test("Slack sender uploads local bridge images before completing a file post", async () => {
  const calls = [];
  const sent = await sendSlackRemixResult({
    botToken: "xoxb-token",
    channelId: "C123",
    result: {
      type: "bridge",
      text: "done",
      imageUrls: ["http://127.0.0.1:8787/v1/images/abc"],
    },
    fetchImpl: async (url, options = {}) => {
      calls.push({ url: String(url), method: options.method, body: options.body });
      if (String(url).startsWith("http://127.0.0.1")) {
        return new Response(new Blob(["fake image"], { type: "image/jpeg" }), {
          status: 200,
          headers: { "content-type": "image/jpeg" },
        });
      }
      if (String(url).endsWith("/files.getUploadURLExternal")) {
        const body = JSON.parse(options.body);
        assert.equal(body.filename, "remix-camera.jpg");
        assert.ok(body.length > 0);
        return Response.json({ ok: true, upload_url: "https://upload.slack.test/1", file_id: "F1" });
      }
      if (String(url) === "https://upload.slack.test/1") {
        assert.equal(options.method, "POST");
        assert.ok(options.body instanceof ArrayBuffer);
        return new Response("", { status: 200 });
      }
      if (String(url).endsWith("/files.completeUploadExternal")) {
        const body = JSON.parse(options.body);
        assert.equal(body.channel_id, "C123");
        assert.deepEqual(body.files, [{ id: "F1", title: "Remix.Camera image 1" }]);
        return Response.json({ ok: true, file: { id: "F1" } });
      }
      throw new Error(`Unexpected fetch ${url}`);
    },
  });

  assert.equal(sent[0].file.id, "F1");
  assert.deepEqual(
    calls.map((call) => call.url),
    [
      "http://127.0.0.1:8787/v1/images/abc",
      "https://slack.com/api/files.getUploadURLExternal",
      "https://upload.slack.test/1",
      "https://slack.com/api/files.completeUploadExternal",
    ],
  );
});

test("Slack detailed slash handler can run without auto-sending for existing bots", async () => {
  const tool = createRemixSlackTool({
    botToken: "xoxb-token",
    bridgeUrl: "http://bridge.local",
    fetchImpl: async () =>
      Response.json({
        ok: true,
        results: [{ productionImageUrl: "https://cdn.example/remix.jpg" }],
      }),
  });

  const details = await tool.handleSlashCommandDetailed(
    {
      team_id: "T123",
      channel_id: "C123",
      user_id: "U123",
      response_url: "https://hooks.slack.test/response",
      text: "selfie couch",
    },
    { autoSend: false },
  );

  assert.equal(details.handled, true);
  assert.equal(details.teamId, "T123");
  assert.equal(details.channelId, "C123");
  assert.equal(details.userId, "U123");
  assert.equal(details.parsed.command, "send-selfie");
  assert.deepEqual(details.result.imageUrls, ["https://cdn.example/remix.jpg"]);
  assert.deepEqual(details.sentMessages, []);
});

test("Slack simple slash handler remains compatible when destructured", async () => {
  const tool = createRemixSlackTool({
    bridgeUrl: "http://bridge.local",
    fetchImpl: async () =>
      Response.json({
        ok: true,
        results: [{ productionImageUrl: "https://cdn.example/remix.jpg" }],
      }),
  });
  const { handleSlashCommand } = tool;

  const result = await handleSlashCommand({ text: "selfie couch" }, { autoSend: false });

  assert.equal(result.command, "send-selfie");
  assert.deepEqual(result.imageUrls, ["https://cdn.example/remix.jpg"]);
});
