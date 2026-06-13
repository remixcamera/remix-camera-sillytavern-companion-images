import assert from "node:assert/strict";
import test from "node:test";
import {
  buildEvidence,
  deliveryReadiness,
  parseTargetCommand,
  plannedGenerationCount,
} from "../scripts/record-messaging-demo.mjs";

test("messaging recorder parses target-specific preview commands", () => {
  const telegram = parseTargetCommand("telegram", "/preview selfie cozy couch");
  assert.equal(telegram.action, "dry-run");
  assert.equal(telegram.command, "send-selfie");
  assert.equal(telegram.text, "cozy couch");

  const matrix = parseTargetCommand("matrix", "!lily preview vacation Amalfi coast");
  assert.equal(matrix.action, "dry-run");
  assert.equal(matrix.command, "couples-vacation");
  assert.equal(matrix.text, "Amalfi coast");

  const discord = parseTargetCommand("discord", "preview date quiet restaurant booth");
  assert.equal(discord.parsed.action, "dry-run");
  assert.equal(discord.parsed.command, "date-night");
  assert.equal(discord.parsed.prompt, "quiet restaurant booth");

  const instagram = parseTargetCommand("instagram", "preview daily morning coffee");
  assert.equal(instagram.action, "dry-run");
  assert.equal(instagram.command, "daily-life-snap");
  assert.equal(instagram.text, "morning coffee");

  const twilio = parseTargetCommand("twilio", "preview selfie cozy couch");
  assert.equal(twilio.action, "dry-run");
  assert.equal(twilio.command, "send-selfie");
  assert.equal(twilio.text, "cozy couch");

  const vk = parseTargetCommand("vk", "preview selfie cozy couch");
  assert.equal(vk.action, "dry-run");
  assert.equal(vk.command, "send-selfie");
  assert.equal(vk.text, "cozy couch");
});

test("messaging recorder counts planned generations before spending", () => {
  assert.equal(plannedGenerationCount("telegram", parseTargetCommand("telegram", "/preview selfie couch")), 0);
  assert.equal(plannedGenerationCount("telegram", parseTargetCommand("telegram", "/selfie couch")), 1);
  assert.equal(plannedGenerationCount("slack", parseTargetCommand("slack", "vacation yes Amalfi coast")), 3);
  assert.equal(plannedGenerationCount("discord", parseTargetCommand("discord", "snap yes bedroom mirror")), 1);
  assert.equal(plannedGenerationCount("instagram", parseTargetCommand("instagram", "vacation yes Amalfi coast")), 3);
  assert.equal(plannedGenerationCount("twilio", parseTargetCommand("twilio", "selfie couch")), 1);
  assert.equal(plannedGenerationCount("vk", parseTargetCommand("vk", "vacation yes Amalfi coast")), 3);
});

test("messaging recorder evidence records no-delivery dry-runs honestly", () => {
  const parsedResult = parseTargetCommand("line", "preview selfie cozy couch");
  const evidence = buildEvidence({
    target: "line",
    commandText: "preview selfie cozy couch",
    parsedResult,
    result: {
      type: "bridge",
      command: "send-selfie",
      payload: {
        dryRun: true,
        promptTemplate: { packTitle: "Realistic Bedroom Selfie Girl Phone Mirror" },
        prompt: "prompt text",
      },
      imageUrls: [],
    },
    sentMessages: [],
    deliveryAttempted: false,
    skippedReason: "Set LINE_CHANNEL_ACCESS_TOKEN, LINE_TO to send this demo through the real line host.",
    plannedGenerationCount: 0,
    bridgeUrl: "http://127.0.0.1:8787",
    bridgeStarted: true,
    startedAt: "2026-06-12T00:00:00.000Z",
    characterName: "Lily",
    profileId: "profile_lily",
    includePrompt: false,
    outputDir: "/tmp/demo",
  });

  assert.equal(evidence.mode, "line-bridge-dry-run-no-delivery");
  assert.equal(evidence.hostDelivery.attempted, false);
  assert.equal(evidence.hostDelivery.delivered, false);
  assert.equal(evidence.bridge.promptTemplate, "Realistic Bedroom Selfie Girl Phone Mirror");
  assert.match(evidence.text, /Preview ready/);
});

test("messaging recorder includes Instagram and Twilio delivery readiness without secret values", () => {
  const originalInstagramToken = process.env.INSTAGRAM_ACCESS_TOKEN;
  const originalInstagramRecipient = process.env.INSTAGRAM_RECIPIENT_ID;
  const originalTwilioSid = process.env.TWILIO_ACCOUNT_SID;
  const originalTwilioToken = process.env.TWILIO_AUTH_TOKEN;
  const originalTwilioFrom = process.env.TWILIO_FROM;
  const originalTwilioTo = process.env.TWILIO_TO;
  const originalVkToken = process.env.VK_ACCESS_TOKEN;
  const originalVkPeerId = process.env.VK_PEER_ID;
  try {
    process.env.INSTAGRAM_ACCESS_TOKEN = "ig-secret-token";
    delete process.env.INSTAGRAM_RECIPIENT_ID;
    const instagram = deliveryReadiness("instagram");
    assert.equal(instagram.status, "missing-host-delivery-credentials");
    assert.deepEqual(instagram.requiredEnv, ["INSTAGRAM_ACCESS_TOKEN", "INSTAGRAM_RECIPIENT_ID"]);
    assert.deepEqual(instagram.missingEnv, ["INSTAGRAM_RECIPIENT_ID"]);
    assert.equal(Object.values(instagram).some((value) => String(value).includes("ig-secret-token")), false);

    process.env.TWILIO_ACCOUNT_SID = "AC123";
    process.env.TWILIO_AUTH_TOKEN = "twilio-secret-token";
    process.env.TWILIO_FROM = "+15550000001";
    process.env.TWILIO_TO = "+15550000002";
    const twilio = deliveryReadiness("twilio");
    assert.equal(twilio.status, "host-delivery-ready");
    assert.deepEqual(twilio.requiredEnv, ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM", "TWILIO_TO"]);
    assert.deepEqual(twilio.missingEnv, []);
    assert.equal(Object.values(twilio).some((value) => String(value).includes("twilio-secret-token")), false);

    process.env.VK_ACCESS_TOKEN = "vk-secret-token";
    delete process.env.VK_PEER_ID;
    const vk = deliveryReadiness("vk");
    assert.equal(vk.status, "missing-host-delivery-credentials");
    assert.deepEqual(vk.requiredEnv, ["VK_ACCESS_TOKEN", "VK_PEER_ID"]);
    assert.deepEqual(vk.missingEnv, ["VK_PEER_ID"]);
    assert.equal(Object.values(vk).some((value) => String(value).includes("vk-secret-token")), false);
  } finally {
    if (originalInstagramToken === undefined) delete process.env.INSTAGRAM_ACCESS_TOKEN;
    else process.env.INSTAGRAM_ACCESS_TOKEN = originalInstagramToken;
    if (originalInstagramRecipient === undefined) delete process.env.INSTAGRAM_RECIPIENT_ID;
    else process.env.INSTAGRAM_RECIPIENT_ID = originalInstagramRecipient;
    if (originalTwilioSid === undefined) delete process.env.TWILIO_ACCOUNT_SID;
    else process.env.TWILIO_ACCOUNT_SID = originalTwilioSid;
    if (originalTwilioToken === undefined) delete process.env.TWILIO_AUTH_TOKEN;
    else process.env.TWILIO_AUTH_TOKEN = originalTwilioToken;
    if (originalTwilioFrom === undefined) delete process.env.TWILIO_FROM;
    else process.env.TWILIO_FROM = originalTwilioFrom;
    if (originalTwilioTo === undefined) delete process.env.TWILIO_TO;
    else process.env.TWILIO_TO = originalTwilioTo;
    if (originalVkToken === undefined) delete process.env.VK_ACCESS_TOKEN;
    else process.env.VK_ACCESS_TOKEN = originalVkToken;
    if (originalVkPeerId === undefined) delete process.env.VK_PEER_ID;
    else process.env.VK_PEER_ID = originalVkPeerId;
  }
});

test("messaging recorder reports delivery readiness without secret values", () => {
  const originalToken = process.env.TELEGRAM_BOT_TOKEN;
  const originalChatId = process.env.TELEGRAM_CHAT_ID;
  try {
    delete process.env.TELEGRAM_BOT_TOKEN;
    process.env.TELEGRAM_CHAT_ID = "12345";
    const missing = deliveryReadiness("telegram");
    assert.equal(missing.status, "missing-host-delivery-credentials");
    assert.deepEqual(missing.requiredEnv, ["TELEGRAM_BOT_TOKEN", "TELEGRAM_CHAT_ID"]);
    assert.deepEqual(missing.missingEnv, ["TELEGRAM_BOT_TOKEN"]);
    assert.equal(Object.values(missing).some((value) => String(value).includes("12345")), false);

    process.env.TELEGRAM_BOT_TOKEN = "secret-token";
    const ready = deliveryReadiness("telegram");
    assert.equal(ready.status, "host-delivery-ready");
    assert.deepEqual(ready.missingEnv, []);
    assert.equal(Object.values(ready).some((value) => String(value).includes("secret-token")), false);
  } finally {
    if (originalToken === undefined) {
      delete process.env.TELEGRAM_BOT_TOKEN;
    } else {
      process.env.TELEGRAM_BOT_TOKEN = originalToken;
    }
    if (originalChatId === undefined) {
      delete process.env.TELEGRAM_CHAT_ID;
    } else {
      process.env.TELEGRAM_CHAT_ID = originalChatId;
    }
  }
});
