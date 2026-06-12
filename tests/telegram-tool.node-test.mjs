import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildBridgeInputFromTelegram,
  parseTelegramCommand,
  runTelegramRemixCommand,
  sendTelegramRemixResult,
} from "../adapters/telegram/remix-telegram-tool.mjs";

test("Telegram parser maps slash commands to bridge commands", () => {
  assert.deepEqual(parseTelegramCommand("/selfie cafe mirror"), {
    type: "image",
    action: "generate",
    command: "send-selfie",
    text: "cafe mirror",
  });
  assert.deepEqual(parseTelegramCommand("/preview date restaurant booth"), {
    type: "image",
    action: "dry-run",
    command: "date-night",
    text: "restaurant booth",
  });
  assert.deepEqual(parseTelegramCommand("/help"), { type: "help" });
});

test("Telegram bridge input requires explicit yes for couple and private generation", () => {
  const couple = parseTelegramCommand("/couple yes coffee shop booth");
  const coupleInput = buildBridgeInputFromTelegram(couple, {
    profileId: "profile_lily",
    characterName: "Lily",
  });
  assert.equal(coupleInput.yes, true);
  assert.equal(coupleInput.userConsent, "yes");
  assert.equal(coupleInput.profileId, "profile_lily");
  assert.equal(coupleInput.maxGenerations, 1);

  const privateSnap = parseTelegramCommand("/snap bedroom mirror");
  const privateInput = buildBridgeInputFromTelegram(privateSnap, {
    characterName: "Lily",
  });
  assert.equal(privateInput.yes, undefined);
  assert.equal(privateInput.matureContent, true);
  assert.equal(privateInput.snapTtlSeconds, 120);
});

test("Telegram run returns an instruction instead of spending when consent is missing", async () => {
  let called = false;
  const result = await runTelegramRemixCommand(parseTelegramCommand("/vacation Amalfi coast"), {
    fetchImpl: async () => {
      called = true;
    },
  });

  assert.equal(called, false);
  assert.equal(result.type, "text");
  assert.match(result.text, /explicit yes/);
});

test("Telegram run calls bridge and extracts generated image URLs", async () => {
  const fetchCalls = [];
  const result = await runTelegramRemixCommand(parseTelegramCommand("/selfie couch lamp"), {
    bridgeUrl: "http://127.0.0.1:8787",
    profileId: "profile_lily",
    characterName: "Lily",
    fetchImpl: async (url, options) => {
      fetchCalls.push({ url, body: JSON.parse(options.body) });
      return new Response(
        JSON.stringify({
          ok: true,
          markdown: "![Lily send-selfie](http://127.0.0.1:8787/v1/images/photo_1)",
          results: [
            {
              ok: true,
              imageUrl: "http://127.0.0.1:8787/v1/images/photo_1",
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  });

  assert.equal(fetchCalls[0].url, "http://127.0.0.1:8787/v1/tools/send-selfie/generate");
  assert.equal(fetchCalls[0].body.yes, true);
  assert.equal(fetchCalls[0].body.profileId, "profile_lily");
  assert.deepEqual(result.imageUrls, ["http://127.0.0.1:8787/v1/images/photo_1"]);
});

test("Telegram sender uploads local bridge images instead of passing 127.0.0.1 URLs to Telegram", async (t) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (String(url).startsWith("http://127.0.0.1:8787/v1/images/")) {
      return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), {
        status: 200,
        headers: { "Content-Type": "image/jpeg" },
      });
    }
    assert.equal(String(url), "https://api.telegram.org/botbot_token/sendPhoto");
    assert.equal(options.method, "POST");
    assert.equal(options.body.get("chat_id"), "123");
    assert.ok(options.body.get("photo") instanceof Blob);
    return new Response(JSON.stringify({ ok: true, result: { message_id: 9 } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const sent = await sendTelegramRemixResult({
    botToken: "bot_token",
    chatId: 123,
    result: {
      type: "bridge",
      imageUrls: ["http://127.0.0.1:8787/v1/images/photo_1"],
      text: "done",
    },
  });

  assert.equal(sent[0].message_id, 9);
  assert.equal(calls.length, 2);
});

