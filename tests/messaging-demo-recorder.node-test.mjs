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

  const mattermost = parseTargetCommand("mattermost", "preview selfie cozy couch");
  assert.equal(mattermost.action, "dry-run");
  assert.equal(mattermost.command, "send-selfie");
  assert.equal(mattermost.text, "cozy couch");

  const rocketchat = parseTargetCommand("rocketchat", "preview selfie cozy couch");
  assert.equal(rocketchat.action, "dry-run");
  assert.equal(rocketchat.command, "send-selfie");
  assert.equal(rocketchat.text, "cozy couch");

  const intercom = parseTargetCommand("intercom", "preview selfie cozy couch");
  assert.equal(intercom.action, "dry-run");
  assert.equal(intercom.command, "send-selfie");
  assert.equal(intercom.text, "cozy couch");

  const zendesk = parseTargetCommand("zendesk", "preview selfie cozy couch");
  assert.equal(zendesk.action, "dry-run");
  assert.equal(zendesk.command, "send-selfie");
  assert.equal(zendesk.text, "cozy couch");

  const crisp = parseTargetCommand("crisp", "preview selfie cozy couch");
  assert.equal(crisp.action, "dry-run");
  assert.equal(crisp.command, "send-selfie");
  assert.equal(crisp.text, "cozy couch");

  const tidio = parseTargetCommand("tidio", "preview selfie cozy couch");
  assert.equal(tidio.action, "dry-run");
  assert.equal(tidio.command, "send-selfie");
  assert.equal(tidio.text, "cozy couch");
});

test("messaging recorder counts planned generations before spending", () => {
  assert.equal(plannedGenerationCount("telegram", parseTargetCommand("telegram", "/preview selfie couch")), 0);
  assert.equal(plannedGenerationCount("telegram", parseTargetCommand("telegram", "/selfie couch")), 1);
  assert.equal(plannedGenerationCount("slack", parseTargetCommand("slack", "vacation yes Amalfi coast")), 3);
  assert.equal(plannedGenerationCount("discord", parseTargetCommand("discord", "snap yes bedroom mirror")), 1);
  assert.equal(plannedGenerationCount("instagram", parseTargetCommand("instagram", "vacation yes Amalfi coast")), 3);
  assert.equal(plannedGenerationCount("twilio", parseTargetCommand("twilio", "selfie couch")), 1);
  assert.equal(plannedGenerationCount("vk", parseTargetCommand("vk", "vacation yes Amalfi coast")), 3);
  assert.equal(plannedGenerationCount("mattermost", parseTargetCommand("mattermost", "vacation yes Amalfi coast")), 3);
  assert.equal(plannedGenerationCount("rocketchat", parseTargetCommand("rocketchat", "snap yes bedroom mirror")), 1);
  assert.equal(plannedGenerationCount("intercom", parseTargetCommand("intercom", "vacation yes Amalfi coast")), 3);
  assert.equal(plannedGenerationCount("zendesk", parseTargetCommand("zendesk", "snap yes bedroom mirror")), 1);
  assert.equal(plannedGenerationCount("crisp", parseTargetCommand("crisp", "selfie couch")), 1);
  assert.equal(plannedGenerationCount("tidio", parseTargetCommand("tidio", "preview selfie couch")), 0);
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
  const originalMattermostWebhook = process.env.MATTERMOST_WEBHOOK_URL;
  const originalRocketChatUrl = process.env.ROCKETCHAT_URL;
  const originalRocketChatToken = process.env.ROCKETCHAT_AUTH_TOKEN;
  const originalRocketChatUserId = process.env.ROCKETCHAT_USER_ID;
  const originalRocketChatRoomId = process.env.ROCKETCHAT_ROOM_ID;
  const originalIntercomAccessToken = process.env.INTERCOM_ACCESS_TOKEN;
  const originalIntercomAdminId = process.env.INTERCOM_ADMIN_ID;
  const originalIntercomConversationId = process.env.INTERCOM_CONVERSATION_ID;
  const originalZendeskSubdomain = process.env.ZENDESK_SUBDOMAIN;
  const originalZendeskAppId = process.env.ZENDESK_APP_ID;
  const originalZendeskConversationId = process.env.ZENDESK_CONVERSATION_ID;
  const originalZendeskKeyId = process.env.ZENDESK_KEY_ID;
  const originalZendeskSecret = process.env.ZENDESK_SECRET;
  const originalCrispTokenId = process.env.CRISP_TOKEN_ID;
  const originalCrispTokenKey = process.env.CRISP_TOKEN_KEY;
  const originalCrispWebsiteId = process.env.CRISP_WEBSITE_ID;
  const originalCrispSessionId = process.env.CRISP_SESSION_ID;
  const originalTidioClientId = process.env.TIDIO_CLIENT_ID;
  const originalTidioClientSecret = process.env.TIDIO_CLIENT_SECRET;
  const originalTidioTicketId = process.env.TIDIO_TICKET_ID;
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

    process.env.MATTERMOST_WEBHOOK_URL = "https://mattermost.test/hooks/secret-webhook";
    const mattermost = deliveryReadiness("mattermost");
    assert.equal(mattermost.status, "host-delivery-ready");
    assert.deepEqual(mattermost.requiredEnv, ["MATTERMOST_WEBHOOK_URL"]);
    assert.deepEqual(mattermost.missingEnv, []);
    assert.equal(Object.values(mattermost).some((value) => String(value).includes("secret-webhook")), false);

    process.env.ROCKETCHAT_URL = "https://chat.example.com";
    process.env.ROCKETCHAT_AUTH_TOKEN = "rocket-secret-token";
    process.env.ROCKETCHAT_USER_ID = "user-id";
    delete process.env.ROCKETCHAT_ROOM_ID;
    const rocketchat = deliveryReadiness("rocketchat");
    assert.equal(rocketchat.status, "missing-host-delivery-credentials");
    assert.deepEqual(rocketchat.requiredEnv, ["ROCKETCHAT_URL", "ROCKETCHAT_AUTH_TOKEN", "ROCKETCHAT_USER_ID", "ROCKETCHAT_ROOM_ID"]);
    assert.deepEqual(rocketchat.missingEnv, ["ROCKETCHAT_ROOM_ID"]);
    assert.equal(Object.values(rocketchat).some((value) => String(value).includes("rocket-secret-token")), false);

    process.env.INTERCOM_ACCESS_TOKEN = "intercom-secret-token";
    process.env.INTERCOM_ADMIN_ID = "admin_1";
    delete process.env.INTERCOM_CONVERSATION_ID;
    const intercom = deliveryReadiness("intercom");
    assert.equal(intercom.status, "missing-host-delivery-credentials");
    assert.deepEqual(intercom.requiredEnv, ["INTERCOM_ACCESS_TOKEN", "INTERCOM_ADMIN_ID", "INTERCOM_CONVERSATION_ID"]);
    assert.deepEqual(intercom.missingEnv, ["INTERCOM_CONVERSATION_ID"]);
    assert.equal(Object.values(intercom).some((value) => String(value).includes("intercom-secret-token")), false);

    process.env.ZENDESK_SUBDOMAIN = "remix";
    process.env.ZENDESK_APP_ID = "app_1";
    process.env.ZENDESK_CONVERSATION_ID = "conv_1";
    process.env.ZENDESK_KEY_ID = "key_id";
    process.env.ZENDESK_SECRET = "zendesk-secret";
    const zendesk = deliveryReadiness("zendesk");
    assert.equal(zendesk.status, "host-delivery-ready");
    assert.deepEqual(zendesk.missingEnv, []);
    assert.equal(Object.values(zendesk).some((value) => String(value).includes("zendesk-secret")), false);

    process.env.CRISP_TOKEN_ID = "token_id";
    process.env.CRISP_TOKEN_KEY = "crisp-secret";
    process.env.CRISP_WEBSITE_ID = "website_1";
    delete process.env.CRISP_SESSION_ID;
    const crisp = deliveryReadiness("crisp");
    assert.equal(crisp.status, "missing-host-delivery-credentials");
    assert.deepEqual(crisp.requiredEnv, ["CRISP_TOKEN_ID", "CRISP_TOKEN_KEY", "CRISP_WEBSITE_ID", "CRISP_SESSION_ID"]);
    assert.deepEqual(crisp.missingEnv, ["CRISP_SESSION_ID"]);
    assert.equal(Object.values(crisp).some((value) => String(value).includes("crisp-secret")), false);

    process.env.TIDIO_CLIENT_ID = "client-id";
    process.env.TIDIO_CLIENT_SECRET = "tidio-secret";
    process.env.TIDIO_TICKET_ID = "10000";
    const tidio = deliveryReadiness("tidio");
    assert.equal(tidio.status, "host-delivery-ready");
    assert.deepEqual(tidio.requiredEnv, ["TIDIO_CLIENT_ID", "TIDIO_CLIENT_SECRET", "TIDIO_TICKET_ID"]);
    assert.deepEqual(tidio.missingEnv, []);
    assert.equal(Object.values(tidio).some((value) => String(value).includes("tidio-secret")), false);
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
    if (originalMattermostWebhook === undefined) delete process.env.MATTERMOST_WEBHOOK_URL;
    else process.env.MATTERMOST_WEBHOOK_URL = originalMattermostWebhook;
    if (originalRocketChatUrl === undefined) delete process.env.ROCKETCHAT_URL;
    else process.env.ROCKETCHAT_URL = originalRocketChatUrl;
    if (originalRocketChatToken === undefined) delete process.env.ROCKETCHAT_AUTH_TOKEN;
    else process.env.ROCKETCHAT_AUTH_TOKEN = originalRocketChatToken;
    if (originalRocketChatUserId === undefined) delete process.env.ROCKETCHAT_USER_ID;
    else process.env.ROCKETCHAT_USER_ID = originalRocketChatUserId;
    if (originalRocketChatRoomId === undefined) delete process.env.ROCKETCHAT_ROOM_ID;
    else process.env.ROCKETCHAT_ROOM_ID = originalRocketChatRoomId;
    if (originalIntercomAccessToken === undefined) delete process.env.INTERCOM_ACCESS_TOKEN;
    else process.env.INTERCOM_ACCESS_TOKEN = originalIntercomAccessToken;
    if (originalIntercomAdminId === undefined) delete process.env.INTERCOM_ADMIN_ID;
    else process.env.INTERCOM_ADMIN_ID = originalIntercomAdminId;
    if (originalIntercomConversationId === undefined) delete process.env.INTERCOM_CONVERSATION_ID;
    else process.env.INTERCOM_CONVERSATION_ID = originalIntercomConversationId;
    if (originalZendeskSubdomain === undefined) delete process.env.ZENDESK_SUBDOMAIN;
    else process.env.ZENDESK_SUBDOMAIN = originalZendeskSubdomain;
    if (originalZendeskAppId === undefined) delete process.env.ZENDESK_APP_ID;
    else process.env.ZENDESK_APP_ID = originalZendeskAppId;
    if (originalZendeskConversationId === undefined) delete process.env.ZENDESK_CONVERSATION_ID;
    else process.env.ZENDESK_CONVERSATION_ID = originalZendeskConversationId;
    if (originalZendeskKeyId === undefined) delete process.env.ZENDESK_KEY_ID;
    else process.env.ZENDESK_KEY_ID = originalZendeskKeyId;
    if (originalZendeskSecret === undefined) delete process.env.ZENDESK_SECRET;
    else process.env.ZENDESK_SECRET = originalZendeskSecret;
    if (originalCrispTokenId === undefined) delete process.env.CRISP_TOKEN_ID;
    else process.env.CRISP_TOKEN_ID = originalCrispTokenId;
    if (originalCrispTokenKey === undefined) delete process.env.CRISP_TOKEN_KEY;
    else process.env.CRISP_TOKEN_KEY = originalCrispTokenKey;
    if (originalCrispWebsiteId === undefined) delete process.env.CRISP_WEBSITE_ID;
    else process.env.CRISP_WEBSITE_ID = originalCrispWebsiteId;
    if (originalCrispSessionId === undefined) delete process.env.CRISP_SESSION_ID;
    else process.env.CRISP_SESSION_ID = originalCrispSessionId;
    if (originalTidioClientId === undefined) delete process.env.TIDIO_CLIENT_ID;
    else process.env.TIDIO_CLIENT_ID = originalTidioClientId;
    if (originalTidioClientSecret === undefined) delete process.env.TIDIO_CLIENT_SECRET;
    else process.env.TIDIO_CLIENT_SECRET = originalTidioClientSecret;
    if (originalTidioTicketId === undefined) delete process.env.TIDIO_TICKET_ID;
    else process.env.TIDIO_TICKET_ID = originalTidioTicketId;
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
