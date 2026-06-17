import assert from "node:assert/strict";
import { test } from "node:test";
import {
  createRemixTelegramGrammyMiddleware,
  createRemixTelegramTelegrafMiddleware,
} from "../adapters/telegram/framework-middleware.mjs";
import {
  buildBridgeInputFromTelegram,
  createRemixTelegramTool,
  getTelegramMessage,
  isRemixTelegramCommand,
  parseTelegramCommand,
  runTelegramRemixCommand,
  sendTelegramRemixResult,
  shouldHandleTelegramUpdate,
} from "../adapters/telegram/remix-telegram-tool.mjs";

test("Telegram parser maps slash commands to bridge commands", () => {
  assert.deepEqual(parseTelegramCommand("/selfie cafe mirror"), {
    type: "image",
    action: "generate",
    command: "send-selfie",
    text: "cafe mirror",
    userConsent: undefined,
  });
  assert.deepEqual(parseTelegramCommand("/preview date restaurant booth"), {
    type: "image",
    action: "dry-run",
    command: "date-night",
    text: "restaurant booth",
    userConsent: undefined,
  });
  assert.deepEqual(parseTelegramCommand("/help"), { type: "help" });
});

test("Telegram routing helpers identify only Remix.Camera commands", () => {
  const update = {
    message: {
      message_id: 42,
      chat: { id: 123 },
      text: "/selfie cafe mirror",
    },
  };

  assert.equal(getTelegramMessage(update).message_id, 42);
  assert.equal(isRemixTelegramCommand("/selfie cafe mirror"), true);
  assert.equal(isRemixTelegramCommand("/unknown cafe mirror"), false);
  assert.equal(isRemixTelegramCommand("normal chat message"), false);
  assert.equal(shouldHandleTelegramUpdate(update), true);
  assert.equal(shouldHandleTelegramUpdate({ message: { chat: { id: 123 }, text: "/unknown" } }), false);
});

test("Telegram parser accepts natural SillyTavern-style photo requests", () => {
  assert.deepEqual(parseTelegramCommand("send me a bath selfie"), {
    type: "image",
    action: "generate",
    command: "send-selfie",
    text: "send me a bath selfie",
    natural: true,
    userConsent: undefined,
  });

  assert.deepEqual(parseTelegramCommand("send a sexy nude playing tennis"), {
    type: "image",
    action: "generate",
    command: "private-snap",
    text: "send a sexy nude playing tennis",
    natural: true,
    userConsent: undefined,
  });

  assert.deepEqual(parseTelegramCommand("now take it off"), {
    type: "image",
    action: "generate",
    command: "private-snap",
    text: "now take it off",
    natural: true,
    userConsent: undefined,
    contextualSourceImage: true,
  });
});

test("contextual undress requests pass the last generated image to the bridge", async () => {
  const calls = [];
  const tool = createRemixTelegramTool({
    characterName: "Lily",
    fetchImpl: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      return new Response(
        JSON.stringify({
          ok: true,
          dryRun: true,
          command: "private-snap",
          modelId: "seedream-v4.5-edit",
          matureContent: true,
          usesImageToImage: true,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  });

  const details = await tool.handleUpdateDetailed(
    {
      message: {
        chat: { id: 123 },
        text: "preview now take it off",
      },
    },
    {
      autoSend: false,
      lastGeneratedImageUrl: "https://remix.camera/api/s3-file?key=lily-private.jpg",
    },
  );

  assert.equal(details.handled, true);
  assert.equal(details.parsed.command, "private-snap");
  assert.equal(calls[0].url, "http://127.0.0.1:8787/v1/tools/private-snap/dry-run");
  assert.equal(calls[0].body.sourceImageUrl, "https://remix.camera/api/s3-file?key=lily-private.jpg");
  assert.equal(calls[0].body.matureContent, true);
  assert.equal(calls[0].body.yes, undefined);
});

test("Telegram bridge input routes couple and private generation like natural chat", () => {
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
  assert.equal(privateInput.yes, true);
  assert.equal(privateInput.matureContent, true);
  assert.equal(privateInput.snapTtlSeconds, undefined);
});

test("Telegram private generation does not require a literal yes token", async () => {
  const calls = [];
  const result = await runTelegramRemixCommand(parseTelegramCommand("/vacation Amalfi coast"), {
    fetchImpl: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      return new Response(JSON.stringify({ ok: true, dryRun: false, results: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  assert.equal(result.type, "bridge");
  assert.equal(calls[0].url, "http://127.0.0.1:8787/v1/tools/couples-vacation/generate");
  assert.equal(calls[0].body.yes, true);
  assert.equal(calls[0].body.userConsent, "yes");
  assert.equal(calls[0].body.maxGenerations, 3);
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

test("Telegram sender refuses local-only bridge image URLs", async (t) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  t.after(() => {
    globalThis.fetch = originalFetch;
  });

  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    assert.equal(String(url), "https://api.telegram.org/botbot_token/sendMessage");
    assert.equal(options.method, "POST");
    const body = JSON.parse(options.body);
    assert.equal(body.chat_id, 123);
    assert.match(body.text, /Telegram cannot fetch 127\.0\.0\.1 URLs/);
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
  assert.equal(calls.length, 1);
});

test("Telegram detailed update handler can run without auto-sending for existing bots", async () => {
  const tool = createRemixTelegramTool({
    botToken: "bot_token",
    bridgeUrl: "http://127.0.0.1:8787",
    profileId: "profile_lily",
    characterName: "Lily",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          ok: true,
          markdown: "![Lily send-selfie](https://cdn.example.test/photo_1.jpg)",
          results: [{ ok: true, imageUrl: "https://cdn.example.test/photo_1.jpg" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  });

  const details = await tool.handleUpdateDetailed(
    {
      message: {
        message_id: 7,
        chat: { id: 123 },
        text: "/selfie couch lamp",
      },
    },
    { autoSend: false },
  );

  assert.equal(details.handled, true);
  assert.equal(details.chatId, 123);
  assert.equal(details.messageId, 7);
  assert.equal(details.parsed.command, "send-selfie");
  assert.deepEqual(details.result.imageUrls, ["https://cdn.example.test/photo_1.jpg"]);
  assert.deepEqual(details.sentMessages, []);
});

test("Telegram detailed update handler returns sent message records when auto-send is enabled", async () => {
  const telegramCalls = [];
  const tool = createRemixTelegramTool({
    botToken: "bot_token",
    bridgeUrl: "http://127.0.0.1:8787",
    fetchImpl: async (url, options = {}) => {
      if (String(url).startsWith("https://api.telegram.org/")) {
        telegramCalls.push({ url: String(url), options });
        assert.equal(String(url), "https://api.telegram.org/botbot_token/sendPhoto");
        const body = JSON.parse(options.body);
        assert.equal(body.chat_id, 123);
        assert.equal(body.photo, "https://cdn.example.test/photo_1.jpg");
        return new Response(JSON.stringify({ ok: true, result: { message_id: 99 } }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({
          ok: true,
          markdown: "![Lily send-selfie](https://cdn.example.test/photo_1.jpg)",
          results: [{ ok: true, imageUrl: "https://cdn.example.test/photo_1.jpg" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  });

  const details = await tool.handleUpdateDetailed({
    message: {
      chat: { id: 123 },
      text: "/selfie couch lamp",
    },
  });

  assert.equal(details.handled, true);
  assert.equal(details.sentMessages[0].message_id, 99);
  assert.equal(telegramCalls.length, 1);
});

test("Telegram simple update handler remains compatible when destructured", async () => {
  const tool = createRemixTelegramTool({
    bridgeUrl: "http://127.0.0.1:8787",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          ok: true,
          markdown: "![Lily send-selfie](https://cdn.example.test/photo_1.jpg)",
          results: [{ ok: true, imageUrl: "https://cdn.example.test/photo_1.jpg" }],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  });
  const { handleUpdate } = tool;

  const result = await handleUpdate({
    message: {
      chat: { id: 123 },
      text: "/selfie couch lamp",
    },
  });

  assert.equal(result.command, "send-selfie");
  assert.deepEqual(result.imageUrls, ["https://cdn.example.test/photo_1.jpg"]);
});

test("Telegraf middleware passes through unrelated updates", async () => {
  const middleware = createRemixTelegramTelegrafMiddleware();
  let nextCalled = false;
  const result = await middleware(
    {
      update: {
        message: {
          chat: { id: 123 },
          text: "normal chat",
        },
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

test("Telegraf middleware can send local bridge images through framework replies", async () => {
  const photoReplies = [];
  const middleware = createRemixTelegramTelegrafMiddleware({
    bridgeUrl: "http://127.0.0.1:8787",
    fetchImpl: async (url, options = {}) => {
      if (String(url).startsWith("http://127.0.0.1:8787/v1/tools/")) {
        return new Response(
          JSON.stringify({
            ok: true,
            markdown: "![Lily](http://127.0.0.1:8787/v1/images/photo_1)",
            results: [{ ok: true, imageUrl: "http://127.0.0.1:8787/v1/images/photo_1" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      assert.equal(String(url), "http://127.0.0.1:8787/v1/images/photo_1");
      assert.equal(options.method, undefined);
      return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), {
        status: 200,
        headers: { "Content-Type": "image/jpeg" },
      });
    },
  });

  const details = await middleware({
    state: {},
    update: {
      message: {
        message_id: 3,
        chat: { id: 123 },
        text: "/selfie couch lamp",
      },
    },
    replyWithPhoto: async (photo, extra) => {
      photoReplies.push({ photo, extra });
      return { message_id: 10 };
    },
  });

  assert.equal(details.handled, true);
  assert.equal(details.sentMessages[0].message_id, 10);
  assert.ok(Buffer.isBuffer(photoReplies[0].photo.source));
  assert.equal(photoReplies[0].photo.filename, "remix-camera.jpg");
  assert.equal(photoReplies[0].extra.caption, "Remix.Camera");
});

test("grammY middleware can upload local images with an InputFile factory", async () => {
  const sentPhotos = [];
  const inputFileFactory = (buffer, filename) => ({ kind: "InputFile", buffer, filename });
  const middleware = createRemixTelegramGrammyMiddleware({
    bridgeUrl: "http://127.0.0.1:8787",
    inputFileFactory,
    fetchImpl: async (url) => {
      if (String(url).startsWith("http://127.0.0.1:8787/v1/tools/")) {
        return new Response(
          JSON.stringify({
            ok: true,
            markdown: "![Lily](http://127.0.0.1:8787/v1/images/photo_1)",
            results: [{ ok: true, imageUrl: "http://127.0.0.1:8787/v1/images/photo_1" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(new Uint8Array([0xff, 0xd8, 0xff, 0xd9]), {
        status: 200,
        headers: { "Content-Type": "image/jpeg" },
      });
    },
  });

  const details = await middleware({
    update: {
      message: {
        message_id: 4,
        chat: { id: 123 },
        text: "/selfie couch lamp",
      },
    },
    replyWithPhoto: async (photo, extra) => {
      sentPhotos.push({ photo, extra });
      return { message_id: 11 };
    },
  });

  assert.equal(details.handled, true);
  assert.equal(sentPhotos[0].photo.kind, "InputFile");
  assert.ok(Buffer.isBuffer(sentPhotos[0].photo.buffer));
  assert.equal(sentPhotos[0].photo.filename, "remix-camera.jpg");
  assert.equal(sentPhotos[0].extra.caption, "Remix.Camera");
});

test("Telegram framework middleware can disable delivery even with a bot token", async () => {
  const originalFetch = globalThis.fetch;
  let telegramSendCount = 0;
  globalThis.fetch = async (url) => {
    if (String(url).startsWith("https://api.telegram.org/")) {
      telegramSendCount += 1;
      throw new Error("unexpected telegram send");
    }
    return originalFetch(url);
  };

  try {
    const middleware = createRemixTelegramTelegrafMiddleware({
      botToken: "bot_token",
      delivery: false,
      fetchImpl: async (url) => {
        assert.equal(String(url), "http://127.0.0.1:8787/v1/tools/send-selfie");
        return new Response(
          JSON.stringify({
            ok: true,
            markdown: "![Lily](https://cdn.example.test/photo_1.jpg)",
            results: [{ ok: true, imageUrl: "https://cdn.example.test/photo_1.jpg" }],
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      },
    });

    const details = await middleware({
      update: {
        message: {
          message_id: 5,
          chat: { id: 123 },
          text: "/selfie couch lamp",
        },
      },
      replyWithPhoto: async () => {
        throw new Error("unexpected framework send");
      },
    });

    assert.equal(details.handled, true);
    assert.equal(details.sentMessages.length, 0);
    assert.equal(telegramSendCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
