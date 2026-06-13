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
});

test("messaging recorder counts planned generations before spending", () => {
  assert.equal(plannedGenerationCount("telegram", parseTargetCommand("telegram", "/preview selfie couch")), 0);
  assert.equal(plannedGenerationCount("telegram", parseTargetCommand("telegram", "/selfie couch")), 1);
  assert.equal(plannedGenerationCount("slack", parseTargetCommand("slack", "vacation yes Amalfi coast")), 3);
  assert.equal(plannedGenerationCount("discord", parseTargetCommand("discord", "snap yes bedroom mirror")), 1);
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
