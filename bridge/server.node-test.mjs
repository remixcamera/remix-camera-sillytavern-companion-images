import assert from "node:assert/strict";
import { once } from "node:events";
import { spawn } from "node:child_process";
import http from "node:http";
import { test } from "node:test";

const bridgePath = new URL("./server.mjs", import.meta.url);

async function getFreePort() {
  const server = http.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return port;
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (chunks.length === 0) {
    return {};
  }
  const buffer = Buffer.concat(chunks);
  const contentType = req.headers["content-type"] || "";
  if (String(contentType).includes("multipart/form-data")) {
    return {
      __multipart: true,
      contentType,
      text: buffer.toString("latin1"),
      byteLength: buffer.byteLength,
    };
  }
  return JSON.parse(buffer.toString("utf8"));
}

const mockPromptPacks = {
  selfie: {
    id: "pack_selfie",
    slug: "proven-companion-selfie",
    title: "Proven Companion Selfie Pack",
    adminPriorityStatus: "good",
    qualityRating: "good",
    prompt:
      "A realistic phone-camera mirror selfie in a cozy cafe corner, warm natural light, candid expression, detailed outfit styling, believable social photo composition, no text overlay.",
  },
  genericSelfie: {
    id: "pack_generic_selfie",
    slug: "generic-companion-selfie",
    title: "Generic Companion Selfie Pack",
    adminPriorityStatus: "good",
    qualityRating: "good",
    prompt:
      "A realistic phone-camera selfie, simple portrait framing, casual expression, indoor lighting, believable social photo composition, no text overlay.",
  },
  excellentSelfie: {
    id: "pack_excellent_selfie",
    slug: "excellent-companion-selfie",
    title: "Excellent Companion Selfie Pack",
    adminPriorityStatus: "excellent",
    qualityRating: "great",
    prompt:
      "A cinematic but natural phone-camera mirror selfie in a detailed lived-in bedroom, warm window light, expressive eye contact, carefully styled outfit, visible environment, premium social photo realism, no text overlay.",
  },
  outfit: {
    id: "pack_outfit",
    slug: "proven-outfit-try-on",
    title: "Proven Outfit Try-On Pack",
    adminPriorityStatus: "excellent",
    qualityRating: "great",
    prompt:
      "A full-body fashion mirror photo showing the complete outfit clearly, editorial styling, natural posture, flattering indoor lighting, detailed fabric and accessories, realistic phone photo.",
  },
  couple: {
    id: "pack_couple",
    slug: "proven-couple-selfie",
    title: "Proven Couple Selfie Pack",
    adminPriorityStatus: "excellent",
    qualityRating: "great",
    prompt:
      "A realistic couple selfie with exactly two adults close together, affectionate natural body language, date-night warmth, phone-camera framing, believable shared moment, no extra people.",
  },
  vacation: {
    id: "pack_vacation",
    slug: "proven-couples-vacation",
    title: "Proven Couples Vacation Pack",
    adminPriorityStatus: "excellent",
    qualityRating: "great",
    prompt:
      "A cohesive romantic vacation travel photo of a couple on the Amalfi coast, bright Mediterranean light, scenic destination visible, candid keepsake mood, consistent wardrobe palette.",
  },
  date: {
    id: "pack_date",
    slug: "proven-date-night",
    title: "Proven Date Night Pack",
    adminPriorityStatus: "excellent",
    qualityRating: "great",
    prompt:
      "A warm date-night phone photo at a restaurant booth, soft practical lighting, polished outfit, intimate expression, visible table setting, cinematic but believable social snapshot.",
  },
  daily: {
    id: "pack_daily",
    slug: "proven-daily-life-snap",
    title: "Proven Daily Life Snap Pack",
    adminPriorityStatus: "excellent",
    qualityRating: "great",
    prompt:
      "A casual candid daily-life phone photo at home with coffee and morning light, natural expression, relaxed wardrobe, lived-in background details, realistic companion update.",
  },
  private: {
    id: "pack_private",
    slug: "proven-private-snap",
    title: "Proven Private Adult Snap Pack",
    adminPriorityStatus: "excellent",
    qualityRating: "great",
    prompt:
      "An adult private bedroom mirror snap, tasteful lingerie styling, intimate phone-camera framing, confident clearly adult subject, warm low light, consensual mature mood, no text overlay.",
  },
};

function chooseMockPromptPacks(query) {
  const text = String(query || "").toLowerCase();
  if (text.includes("excellent-first-test")) return [mockPromptPacks.genericSelfie, mockPromptPacks.excellentSelfie];
  if (text.startsWith("couple vacation")) return [mockPromptPacks.vacation];
  if (text.startsWith("date night")) return [mockPromptPacks.date];
  if (text.startsWith("daily life")) return [mockPromptPacks.daily];
  if (text.startsWith("adult private")) return [mockPromptPacks.private];
  if (text.startsWith("fashion outfit")) return [mockPromptPacks.outfit];
  if (text.startsWith("realistic couple selfie")) return [mockPromptPacks.couple];
  if (text.startsWith("realistic companion selfie") || text.startsWith("realistic candid companion selfie")) return [mockPromptPacks.selfie];
  if (text.includes("vacation") || text.includes("amalfi") || text.includes("travel")) return [mockPromptPacks.vacation];
  if (text.includes("outfit") || text.includes("fashion") || text.includes("clothing")) return [mockPromptPacks.outfit];
  if (text.includes("couple") || text.includes("two adults") || text.includes("partner")) return [mockPromptPacks.couple];
  if (/\bdate\b/.test(text) || text.includes("restaurant")) return [mockPromptPacks.date];
  if (text.includes("daily") || text.includes("coffee") || text.includes("morning")) return [mockPromptPacks.daily];
  if (text.includes("private") || text.includes("lingerie") || text.includes("adult")) return [mockPromptPacks.private];
  return [mockPromptPacks.selfie];
}

async function startMockRemixApi() {
  const calls = [];
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || "/", "http://127.0.0.1");
    const body = req.method === "POST" ? await readJsonBody(req) : null;
    calls.push({ method: req.method, pathname: url.pathname, body, authorization: req.headers.authorization });

    if (req.method === "GET" && url.pathname === "/api/v1/design/profiles") {
      sendJson(res, 200, {
        ok: true,
        profiles: [
          {
            id: "profile_seraphina",
            trainingStatus: "ready",
            fluxReady: true,
          },
        ],
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/v1/design/packs/search") {
      const selectedPacks = chooseMockPromptPacks(body.query);
      sendJson(res, 200, {
        ok: true,
        packs: selectedPacks.map((selected) => ({
          id: selected.id,
          slug: selected.slug,
          title: selected.title,
          promptCount: 1,
          adminPriorityStatus: selected.adminPriorityStatus,
          qualityRating: selected.qualityRating,
          matchedText: selected.prompt,
          searchScore: selected.id === "pack_generic_selfie" ? 0.95 : 0.9,
        })),
      });
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/api/v1/design/packs/")) {
      const packId = decodeURIComponent(url.pathname.slice("/api/v1/design/packs/".length));
      const selected =
        Object.values(mockPromptPacks).find((pack) => pack.id === packId || pack.slug === packId) ||
        mockPromptPacks.selfie;
      sendJson(res, 200, {
        ok: true,
        pack: {
          id: selected.id,
          slug: selected.slug,
          title: selected.title,
          adminPriorityStatus: selected.adminPriorityStatus,
          qualityRating: selected.qualityRating,
          description: "Mock proven Remix.Camera prompt pack.",
          prompts: [
            {
              index: 0,
              text: selected.prompt,
              aspectRatio: "1:1",
              cropStyle: "square",
              poseType: "selfie",
              modelType: "nano-banana",
            },
          ],
        },
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/v1/design/generations") {
      assert.equal(body.profileId, "profile_seraphina");
      assert.match(body.prompt, /long pastel-pink hair/);
      assert.match(body.prompt, /proven Remix\.Camera prompt\/template/i);
      assert.ok(["nano-banana", "seedream-v4.5-edit"].includes(body.modelId));
      sendJson(res, 200, {
        ok: true,
        generation: {
          id: "photo_mock_1",
          status: "generating",
          imageUrl: null,
        },
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/v1/design/media/reference-image") {
      assert.equal(body.__multipart, true);
      assert.match(body.contentType, /multipart\/form-data/);
      assert.match(body.text, /name="file"/);
      sendJson(res, 200, {
        ok: true,
        referenceImage: {
          url: "https://remix-camera.test/uploads/user-man.jpg",
          s3Key: "uploads/test-user/reference-images/user-man.jpg",
          fileSize: body.byteLength,
          fileType: "image/jpeg",
        },
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/v1/design/remix-from-image") {
      assert.equal(body.profileId, "profile_seraphina");
      assert.match(body.prompt, /long pastel-pink hair/);
      assert.match(body.prompt, /proven Remix\.Camera prompt\/template/i);
      sendJson(res, 200, {
        ok: true,
        generation: {
          id: "photo_mock_remix",
          status: "generating",
          imageUrl: null,
          modelId: body.modelId || "nano-banana",
        },
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/v1/design/generations/status") {
      const id = Array.isArray(body.ids) ? body.ids[0] : "photo_mock_1";
      assert.ok(id);
      sendJson(res, 200, {
        ok: true,
        generations: [
          {
            id,
            status: "completed",
            imageUrl: "/generated/seraphina.jpg",
          },
        ],
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/generated/seraphina.jpg") {
      sendJpeg(res);
      return;
    }

    sendJson(res, 404, { ok: false, error: "not found" });
  });

  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    calls,
    close: () => new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve()))),
  };
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function sendJpeg(res) {
  const payload = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
    0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x01,
    0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
  ]);
  res.writeHead(200, {
    "Content-Type": "image/jpeg",
    "Content-Length": payload.byteLength,
  });
  res.end(payload);
}

async function startBridge(env) {
  const port = await getFreePort();
  const child = spawn(process.execPath, [bridgePath.pathname], {
    env: {
      ...process.env,
      REMIX_CONFIG_FILE: "__remix_camera_sillytavern_test_missing_config__.json",
      REMIX_SESSION_TOKEN: "",
      REMIX_PROFILE_ID: "",
      ...env,
      REMIX_BRIDGE_HOST: "127.0.0.1",
      REMIX_BRIDGE_PORT: String(port),
      REMIX_POLL_INTERVAL_MS: "10",
      REMIX_POLL_TIMEOUT_MS: "2000",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  let output = "";
  child.stdout.on("data", (chunk) => {
    output += chunk.toString();
  });
  child.stderr.on("data", (chunk) => {
    output += chunk.toString();
  });

  await waitFor(() => output.includes("listening"), 2000, () => output);

  return {
    url: `http://127.0.0.1:${port}`,
    output: () => output,
    close: async () => {
      child.kill();
      await once(child, "exit");
    },
  };
}

async function waitFor(predicate, timeoutMs, debug) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (predicate()) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error(`Timed out waiting for condition. ${debug ? debug() : ""}`);
}

test("bridge dry-run includes a Remix prompt template and does not spend generation credits", async () => {
  const mockApi = await startMockRemixApi();
  const bridge = await startBridge({
    REMIX_API_KEY: "rc_live_test.secret",
    REMIX_PROFILE_ID: "profile_seraphina",
    REMIX_API_BASE_URL: mockApi.baseUrl,
  });

  try {
    const response = await fetch(`${bridge.url}/v1/commands/dry-run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        command: "send-selfie",
        characterName: "Seraphina",
        visualIdentity: "long pastel-pink hair, amber eyes, black sundress, emerald vine magic",
        mood: "protective and warm",
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.dryRun, true);
    assert.match(payload.prompt, /long pastel-pink hair/);
    assert.match(payload.prompt, /cozy cafe corner/);
    assert.equal(payload.promptTemplate.packId, "pack_selfie");
    assert.deepEqual(
      mockApi.calls.map((call) => call.pathname),
      [
        "/api/v1/design/packs/search",
        "/api/v1/design/packs/pack_selfie",
      ],
    );
  } finally {
    await bridge.close();
    await mockApi.close();
  }
});

test("bridge serves OpenAPI, Lobe manifest, and per-command dry-run tool routes", async () => {
  const mockApi = await startMockRemixApi();
  const bridge = await startBridge({
    REMIX_API_KEY: "rc_live_test.secret",
    REMIX_PROFILE_ID: "profile_seraphina",
    REMIX_API_BASE_URL: mockApi.baseUrl,
  });

  try {
    const openApiResponse = await fetch(`${bridge.url}/openapi.json`);
    const openApi = await openApiResponse.json();
    assert.equal(openApiResponse.status, 200);
    assert.equal(openApi.openapi, "3.1.0");
    assert.equal(openApi.servers[0].url, bridge.url);
    assert.ok(openApi.paths["/v1/tools/send-selfie/generate"].post.description.includes("yes=true"));
    assert.ok(openApi.paths["/v1/tools/couple-photo/generate"].post.requestBody.content["application/json"].schema.required.includes("userConsent"));

    const lobeResponse = await fetch(`${bridge.url}/lobe/manifest.json`);
    const lobe = await lobeResponse.json();
    assert.equal(lobeResponse.status, 200);
    assert.equal(lobe.identifier, "remix-camera-companion-images");
    assert.ok(lobe.api.some((tool) => tool.name === "sendSelfie" && tool.url === `${bridge.url}/v1/tools/send-selfie/generate`));

    const dryRunResponse = await fetch(`${bridge.url}/v1/tools/send-selfie/dry-run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        characterName: "Seraphina",
        visualIdentity: "long pastel-pink hair, amber eyes, black sundress, emerald vine magic",
        mood: "warm",
      }),
    });
    const dryRun = await dryRunResponse.json();
    assert.equal(dryRunResponse.status, 200);
    assert.equal(dryRun.ok, true);
    assert.equal(dryRun.dryRun, true);
    assert.equal(dryRun.command, "send-selfie");
    assert.equal(dryRun.promptTemplate.packId, "pack_selfie");
  } finally {
    await bridge.close();
    await mockApi.close();
  }
});

test("bridge prefers excellent selfie templates over weaker generic selfie matches", async () => {
  const mockApi = await startMockRemixApi();
  const bridge = await startBridge({
    REMIX_API_KEY: "rc_live_test.secret",
    REMIX_PROFILE_ID: "profile_seraphina",
    REMIX_API_BASE_URL: mockApi.baseUrl,
  });

  try {
    const response = await fetch(`${bridge.url}/v1/commands/dry-run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        command: "send-selfie",
        characterName: "Seraphina",
        visualIdentity: "long pastel-pink hair, amber eyes, black sundress, emerald vine magic",
        mood: "excellent-first-test warm mirror selfie",
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.promptTemplate.packId, "pack_excellent_selfie");
    assert.equal(payload.promptTemplate.adminPriorityStatus, "excellent");
    assert.equal(payload.promptTemplate.qualityStatus, "excellent");
    assert.equal(payload.promptTemplate.preferredQuality, true);
    assert.match(payload.prompt, /detailed lived-in bedroom/);
    assert.deepEqual(
      mockApi.calls.map((call) => call.pathname),
      [
        "/api/v1/design/packs/search",
        "/api/v1/design/packs/pack_excellent_selfie",
        "/api/v1/design/packs/pack_generic_selfie",
      ],
    );
  } finally {
    await bridge.close();
    await mockApi.close();
  }
});

test("bridge allows the default local SillyTavern browser origin", async () => {
  const mockApi = await startMockRemixApi();
  const bridge = await startBridge({
    REMIX_API_KEY: "rc_live_test.secret",
    REMIX_PROFILE_ID: "profile_seraphina",
    REMIX_API_BASE_URL: mockApi.baseUrl,
  });

  try {
    const response = await fetch(`${bridge.url}/health`, {
      headers: {
        Origin: "http://127.0.0.1:8000",
      },
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(response.headers.get("access-control-allow-origin"), "http://127.0.0.1:8000");
    assert.deepEqual(payload.allowedOrigins.slice(0, 2), ["http://127.0.0.1:8000", "http://localhost:8000"]);
  } finally {
    await bridge.close();
    await mockApi.close();
  }
});

test("bridge rejects untrusted browser origins before spending credits", async () => {
  const mockApi = await startMockRemixApi();
  const bridge = await startBridge({
    REMIX_API_KEY: "rc_live_test.secret",
    REMIX_PROFILE_ID: "profile_seraphina",
    REMIX_API_BASE_URL: mockApi.baseUrl,
  });

  try {
    const response = await fetch(`${bridge.url}/v1/commands/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://evil.example",
      },
      body: JSON.stringify({
        yes: true,
        command: "send-selfie",
        characterName: "Seraphina",
        visualIdentity: "long pastel-pink hair",
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 403);
    assert.equal(payload.ok, false);
    assert.match(payload.error, /Origin is not allowed/);
    assert.equal(response.headers.get("access-control-allow-origin"), null);
    assert.equal(mockApi.calls.length, 0);
  } finally {
    await bridge.close();
    await mockApi.close();
  }
});

test("bridge generate polls Remix API and returns chat markdown", async () => {
  const mockApi = await startMockRemixApi();
  const bridge = await startBridge({
    REMIX_API_KEY: "rc_live_test.secret",
    REMIX_API_BASE_URL: mockApi.baseUrl,
  });

  try {
    const response = await fetch(`${bridge.url}/v1/commands/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        yes: true,
        command: "send-selfie",
        characterName: "Seraphina",
        visualIdentity: "long pastel-pink hair, amber eyes, black sundress, emerald vine magic",
        maxGenerations: 1,
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.match(payload.results[0].imageUrl, new RegExp(`^${bridge.url.replaceAll(".", "\\.")}/v1/images/`));
    assert.equal(payload.results[0].productionImageUrl, `${mockApi.baseUrl}/generated/seraphina.jpg`);
    assert.equal(payload.markdown, `![Seraphina send-selfie](${payload.results[0].imageUrl})`);
    assert.equal(payload.modelId, "nano-banana");
    assert.equal(payload.promptTemplate.packId, "pack_selfie");
    const imageResponse = await fetch(payload.results[0].imageUrl);
    assert.equal(imageResponse.status, 200);
    assert.equal(imageResponse.headers.get("content-type"), "image/jpeg");
    assert.equal(Buffer.from(await imageResponse.arrayBuffer()).subarray(0, 3).toString("hex"), "ffd8ff");
    assert.equal(mockApi.calls[0].authorization, "Bearer rc_live_test.secret");
    const generationCall = mockApi.calls.find((call) => call.pathname === "/api/v1/design/generations");
    assert.equal(generationCall.body.modelId, "nano-banana");
    assert.deepEqual(
      mockApi.calls.map((call) => call.pathname),
      [
        "/api/v1/design/packs/search",
        "/api/v1/design/packs/pack_selfie",
        "/api/v1/design/profiles",
        "/api/v1/design/generations",
        "/api/v1/design/generations/status",
        "/generated/seraphina.jpg",
      ],
    );
  } finally {
    await bridge.close();
    await mockApi.close();
  }
});

test("bridge uses Seedream for mature prompt-only generations", async () => {
  const mockApi = await startMockRemixApi();
  const bridge = await startBridge({
    REMIX_API_KEY: "rc_live_test.secret",
    REMIX_API_BASE_URL: mockApi.baseUrl,
  });

  try {
    const response = await fetch(`${bridge.url}/v1/commands/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        yes: true,
        matureContent: true,
        command: "send-selfie",
        characterName: "Seraphina",
        visualIdentity: "long pastel-pink hair, amber eyes, black sundress, emerald vine magic",
        maxGenerations: 1,
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.modelId, "seedream-v4.5-edit");
    const generationCall = mockApi.calls.find((call) => call.pathname === "/api/v1/design/generations");
    assert.equal(generationCall.body.modelId, "seedream-v4.5-edit");
  } finally {
    await bridge.close();
    await mockApi.close();
  }
});

test("bridge forwards explicit reference image key on Nano prompt generations", async () => {
  const mockApi = await startMockRemixApi();
  const bridge = await startBridge({
    REMIX_API_KEY: "rc_live_test.secret",
    REMIX_PROFILE_ID: "profile_seraphina",
    REMIX_API_BASE_URL: mockApi.baseUrl,
  });

  try {
    const response = await fetch(`${bridge.url}/v1/commands/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        yes: true,
        command: "send-selfie",
        characterName: "Seraphina",
        referenceImageKey: "camera/training/seraphina/reference.jpg",
        visualIdentity: "long pastel-pink hair, amber eyes, black sundress, emerald vine magic",
        maxGenerations: 1,
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.modelId, "nano-banana");
    assert.equal(payload.referenceImageKey, "camera/training/seraphina/reference.jpg");
    const generationCall = mockApi.calls.find((call) => call.pathname === "/api/v1/design/generations");
    assert.equal(generationCall.body.modelId, "nano-banana");
    assert.deepEqual(generationCall.body.referenceImage, { s3Key: "camera/training/seraphina/reference.jpg" });
  } finally {
    await bridge.close();
    await mockApi.close();
  }
});

test("bridge source-image SFW path follows standard Nano remix route contract", async () => {
  const mockApi = await startMockRemixApi();
  const bridge = await startBridge({
    REMIX_API_KEY: "rc_live_test.secret",
    REMIX_PROFILE_ID: "profile_seraphina",
    REMIX_API_BASE_URL: mockApi.baseUrl,
  });

  try {
    const response = await fetch(`${bridge.url}/v1/commands/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        yes: true,
        command: "outfit-try-on",
        characterName: "Seraphina",
        sourceImageUrl: "https://example.com/outfit.jpg",
        visualIdentity: "long pastel-pink hair, amber eyes, black sundress, emerald vine magic",
        maxGenerations: 1,
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.modelId, "nano-banana");
    const remixCall = mockApi.calls.find((call) => call.pathname === "/api/v1/design/remix-from-image");
    assert.equal(remixCall.body.modelId, undefined);
  } finally {
    await bridge.close();
    await mockApi.close();
  }
});

test("bridge source-image SFW path uses generation endpoint when a character reference key is supplied", async () => {
  const mockApi = await startMockRemixApi();
  const bridge = await startBridge({
    REMIX_API_KEY: "rc_live_test.secret",
    REMIX_PROFILE_ID: "profile_seraphina",
    REMIX_API_BASE_URL: mockApi.baseUrl,
  });

  try {
    const response = await fetch(`${bridge.url}/v1/commands/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        yes: true,
        command: "outfit-try-on",
        characterName: "Seraphina",
        sourceImageUrl: "https://example.com/outfit.jpg",
        referenceImageKey: "camera/training/seraphina/reference.jpg",
        visualIdentity: "long pastel-pink hair, amber eyes, black sundress, emerald vine magic",
        maxGenerations: 1,
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.modelId, "nano-banana");
    const generationCall = mockApi.calls.find((call) => call.pathname === "/api/v1/design/generations");
    const remixCall = mockApi.calls.find((call) => call.pathname === "/api/v1/design/remix-from-image");
    assert.equal(remixCall, undefined);
    assert.equal(generationCall.body.modelId, "nano-banana");
    assert.equal(generationCall.body.sourceImageUrl, "https://example.com/outfit.jpg");
    assert.deepEqual(generationCall.body.referenceImage, { s3Key: "camera/training/seraphina/reference.jpg" });
  } finally {
    await bridge.close();
    await mockApi.close();
  }
});

test("bridge source-image mature path forces Seedream remix", async () => {
  const mockApi = await startMockRemixApi();
  const bridge = await startBridge({
    REMIX_API_KEY: "rc_live_test.secret",
    REMIX_PROFILE_ID: "profile_seraphina",
    REMIX_API_BASE_URL: mockApi.baseUrl,
  });

  try {
    const response = await fetch(`${bridge.url}/v1/commands/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        yes: true,
        matureContent: true,
        command: "outfit-try-on",
        characterName: "Seraphina",
        sourceImageUrl: "https://example.com/outfit.jpg",
        visualIdentity: "long pastel-pink hair, amber eyes, black sundress, emerald vine magic",
        maxGenerations: 1,
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.modelId, "seedream-v4.5-edit");
    const remixCall = mockApi.calls.find((call) => call.pathname === "/api/v1/design/remix-from-image");
    assert.equal(remixCall.body.modelId, "seedream-v4.5-edit");
  } finally {
    await bridge.close();
    await mockApi.close();
  }
});

test("couple-photo uploads the user's photo as the male reference", async () => {
  const mockApi = await startMockRemixApi();
  const bridge = await startBridge({
    REMIX_API_KEY: "rc_live_test.secret",
    REMIX_PROFILE_ID: "profile_seraphina",
    REMIX_API_BASE_URL: mockApi.baseUrl,
  });

  try {
    const response = await fetch(`${bridge.url}/v1/commands/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        yes: true,
        command: "couple-photo",
        characterName: "Seraphina",
        referenceImageKey: "camera/training/seraphina/reference.jpg",
        userConsent: "yes",
        userDescription: "adult man with short dark hair and a black jacket",
        userReferenceImageDataUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEAAP/Z",
        userReferenceImageName: "user-man.jpg",
        userReferenceImageMimeType: "image/jpeg",
        visualIdentity: "long pastel-pink hair, amber eyes, black sundress, emerald vine magic",
        maxGenerations: 1,
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.modelId, "nano-banana");
    assert.equal(payload.referenceImageKey, "camera/training/seraphina/reference.jpg");
    assert.equal(payload.userReferenceImageKey, "uploads/test-user/reference-images/user-man.jpg");
    assert.deepEqual(payload.selectedReferenceImages, {
      profile_seraphina: "camera/training/seraphina/reference.jpg",
    });
    assert.match(payload.prompt, /man from the uploaded user reference photo/);
    assert.match(payload.prompt, /two distinct people/);

    const uploadCall = mockApi.calls.find((call) => call.pathname === "/api/v1/design/media/reference-image");
    assert.ok(uploadCall, "user reference photo should be uploaded before generation");
    assert.match(uploadCall.body.text, /filename="user-man\.jpg"/);

    const generationCall = mockApi.calls.find((call) => call.pathname === "/api/v1/design/generations");
    assert.deepEqual(generationCall.body.referenceImage, {
      s3Key: "uploads/test-user/reference-images/user-man.jpg",
    });
    assert.deepEqual(generationCall.body.selectedReferenceImages, {
      profile_seraphina: "camera/training/seraphina/reference.jpg",
    });
  } finally {
    await bridge.close();
    await mockApi.close();
  }
});

test("bridge treats packaged placeholder profile id as bridge default", async () => {
  const mockApi = await startMockRemixApi();
  const bridge = await startBridge({
    REMIX_API_KEY: "rc_live_test.secret",
    REMIX_API_BASE_URL: mockApi.baseUrl,
    REMIX_PROFILE_ID: "profile_seraphina",
  });

  try {
    const response = await fetch(`${bridge.url}/v1/commands/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        yes: true,
        command: "send-selfie",
        characterName: "Seraphina",
        profileId: "profile_replace_me",
        visualIdentity: "long pastel-pink hair, amber eyes, black sundress, emerald vine magic",
        maxGenerations: 1,
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.profileId, "profile_seraphina");
    assert.deepEqual(
      mockApi.calls.map((call) => call.pathname),
      [
        "/api/v1/design/packs/search",
        "/api/v1/design/packs/pack_selfie",
        "/api/v1/design/generations",
        "/api/v1/design/generations/status",
      ],
    );
  } finally {
    await bridge.close();
    await mockApi.close();
  }
});

test("couple-photo rejects non-affirmative consent before spending credits", async () => {
  const mockApi = await startMockRemixApi();
  const bridge = await startBridge({
    REMIX_API_KEY: "rc_live_test.secret",
    REMIX_PROFILE_ID: "profile_seraphina",
    REMIX_API_BASE_URL: mockApi.baseUrl,
  });

  try {
    const response = await fetch(`${bridge.url}/v1/commands/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        yes: true,
        command: "couple-photo",
        characterName: "Seraphina",
        userConsent: "no",
        visualIdentity: "long pastel-pink hair",
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.ok, false);
    assert.match(payload.error, /affirmative userConsent/);
    assert.equal(mockApi.calls.length, 0);
  } finally {
    await bridge.close();
    await mockApi.close();
  }
});

test("bridge schema exposes the companion image skill set", async () => {
  const mockApi = await startMockRemixApi();
  const bridge = await startBridge({
    REMIX_API_KEY: "rc_live_test.secret",
    REMIX_PROFILE_ID: "profile_seraphina",
    REMIX_API_BASE_URL: mockApi.baseUrl,
  });

  try {
    const response = await fetch(`${bridge.url}/schema`);
    const payload = await response.json();
    const commandNames = payload.commands.map((command) => command.name);

    assert.equal(response.status, 200);
    assert.deepEqual(
      commandNames,
      [
        "send-selfie",
        "auto-selfie-from-chat",
        "outfit-try-on",
        "couple-photo",
        "couples-vacation",
        "date-night",
        "daily-life-snap",
        "private-snap",
      ],
    );
  } finally {
    await bridge.close();
    await mockApi.close();
  }
});

test("bridge maps each companion command to a Remix prompt-template family", async () => {
  const mockApi = await startMockRemixApi();
  const bridge = await startBridge({
    REMIX_API_KEY: "rc_live_test.secret",
    REMIX_PROFILE_ID: "profile_seraphina",
    REMIX_API_BASE_URL: mockApi.baseUrl,
  });

  const cases = [
    ["send-selfie", { command: "send-selfie" }, "pack_selfie"],
    ["auto-selfie-from-chat", { command: "auto-selfie-from-chat", chatText: "Send a quick mirror selfie from the couch." }, "pack_selfie"],
    ["outfit-try-on", { command: "outfit-try-on", outfit: "black evening dress" }, "pack_outfit"],
    ["couple-photo", { command: "couple-photo", userConsent: "yes" }, "pack_couple"],
    ["couples-vacation", { command: "couples-vacation", userConsent: "yes", theme: "Amalfi coast vacation" }, "pack_vacation"],
    ["date-night", { command: "date-night", location: "restaurant booth" }, "pack_date"],
    ["daily-life-snap", { command: "daily-life-snap", chatText: "Morning coffee at home." }, "pack_daily"],
    ["private-snap", { command: "private-snap", mood: "private adult bedroom snap" }, "pack_private"],
  ];

  try {
    for (const [label, body, expectedPackId] of cases) {
      const response = await fetch(`${bridge.url}/v1/commands/dry-run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          characterName: "Seraphina",
          visualIdentity: "long pastel-pink hair, amber eyes, black sundress, emerald vine magic",
          ...body,
        }),
      });
      const payload = await response.json();

      assert.equal(response.status, 200, label);
      assert.equal(payload.ok, true, label);
      assert.equal(payload.promptTemplate.packId, expectedPackId, label);
      assert.match(payload.prompt, /proven Remix\.Camera prompt\/template/i, label);
      assert.match(payload.prompt, /long pastel-pink hair/, label);
    }
  } finally {
    await bridge.close();
    await mockApi.close();
  }
});

test("couples-vacation dry-run plans a three-photo multi-reference set", async () => {
  const mockApi = await startMockRemixApi();
  const bridge = await startBridge({
    REMIX_API_KEY: "rc_live_test.secret",
    REMIX_PROFILE_ID: "profile_seraphina",
    REMIX_API_BASE_URL: mockApi.baseUrl,
  });

  try {
    const response = await fetch(`${bridge.url}/v1/commands/dry-run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        command: "couples-vacation",
        characterName: "Seraphina",
        profileId: "profile_seraphina",
        referenceImageKey: "camera/training/seraphina/reference.jpg",
        userConsent: "yes",
        userReferenceImageKey: "uploads/test-user/reference-images/user-man.jpg",
        theme: "cohesive Amalfi coast weekend",
        visualIdentity: "long pastel-pink hair, amber eyes, black sundress, emerald vine magic",
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.command, "couples-vacation");
    assert.equal(payload.maxGenerations, 3);
    assert.equal(payload.modelId, "nano-banana");
    assert.deepEqual(payload.selectedReferenceImages, {
      profile_seraphina: "camera/training/seraphina/reference.jpg",
    });
    assert.match(payload.prompt, /couples vacation photo set/);
    assert.match(payload.prompt, /Amalfi coast/);
    assert.equal(payload.promptTemplate.packId, "pack_vacation");
    assert.deepEqual(
      mockApi.calls.map((call) => call.pathname),
      [
        "/api/v1/design/packs/search",
        "/api/v1/design/packs/pack_vacation",
      ],
    );
  } finally {
    await bridge.close();
    await mockApi.close();
  }
});

test("couples-vacation generate returns a three-image chat set", async () => {
  const mockApi = await startMockRemixApi();
  const bridge = await startBridge({
    REMIX_API_KEY: "rc_live_test.secret",
    REMIX_PROFILE_ID: "profile_seraphina",
    REMIX_API_BASE_URL: mockApi.baseUrl,
  });

  try {
    const response = await fetch(`${bridge.url}/v1/commands/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        yes: true,
        command: "couples-vacation",
        characterName: "Seraphina",
        profileId: "profile_seraphina",
        referenceImageKey: "camera/training/seraphina/reference.jpg",
        userConsent: "yes",
        userReferenceImageKey: "uploads/test-user/reference-images/user-man.jpg",
        theme: "cohesive Amalfi coast weekend",
        visualIdentity: "long pastel-pink hair, amber eyes, black sundress, emerald vine magic",
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.command, "couples-vacation");
    assert.equal(payload.results.length, 3);
    assert.equal(payload.results.filter((result) => result.ok && result.imageUrl).length, 3);
    assert.equal((payload.markdown.match(/!\[Seraphina couples-vacation/g) || []).length, 3);
    assert.match(payload.markdown, /1 of 3/);
    assert.match(payload.markdown, /2 of 3/);
    assert.match(payload.markdown, /3 of 3/);

    const generationCalls = mockApi.calls.filter((call) => call.pathname === "/api/v1/design/generations");
    assert.equal(generationCalls.length, 3);
    assert.match(generationCalls[0].body.prompt, /Photo 1 of 3/);
    assert.match(generationCalls[1].body.prompt, /Photo 2 of 3/);
    assert.match(generationCalls[2].body.prompt, /Photo 3 of 3/);
    for (const call of generationCalls) {
      assert.equal(call.body.modelId, "nano-banana");
      assert.deepEqual(call.body.referenceImage, {
        s3Key: "uploads/test-user/reference-images/user-man.jpg",
      });
      assert.deepEqual(call.body.selectedReferenceImages, {
        profile_seraphina: "camera/training/seraphina/reference.jpg",
      });
    }
  } finally {
    await bridge.close();
    await mockApi.close();
  }
});

test("couples-vacation rejects non-affirmative consent before spending credits", async () => {
  const mockApi = await startMockRemixApi();
  const bridge = await startBridge({
    REMIX_API_KEY: "rc_live_test.secret",
    REMIX_PROFILE_ID: "profile_seraphina",
    REMIX_API_BASE_URL: mockApi.baseUrl,
  });

  try {
    const response = await fetch(`${bridge.url}/v1/commands/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        yes: true,
        command: "couples-vacation",
        characterName: "Seraphina",
        userConsent: "no",
        visualIdentity: "long pastel-pink hair",
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 400);
    assert.equal(payload.ok, false);
    assert.match(payload.error, /affirmative userConsent/);
    assert.equal(mockApi.calls.length, 0);
  } finally {
    await bridge.close();
    await mockApi.close();
  }
});

test("private-snap routes to Seedream and returns snap expiry metadata", async () => {
  const mockApi = await startMockRemixApi();
  const bridge = await startBridge({
    REMIX_API_KEY: "rc_live_test.secret",
    REMIX_PROFILE_ID: "profile_seraphina",
    REMIX_API_BASE_URL: mockApi.baseUrl,
  });

  try {
    const response = await fetch(`${bridge.url}/v1/commands/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        yes: true,
        command: "private-snap",
        characterName: "Seraphina",
        snapTtlSeconds: 30,
        visualIdentity: "long pastel-pink hair, amber eyes, black sundress, emerald vine magic",
        maxGenerations: 1,
      }),
    });
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.equal(payload.ok, true);
    assert.equal(payload.command, "private-snap");
    assert.equal(payload.modelId, "seedream-v4.5-edit");
    assert.equal(payload.snapTtlSeconds, 30);
    assert.match(payload.prompt, /clearly adults/);
    const generationCall = mockApi.calls.find((call) => call.pathname === "/api/v1/design/generations");
    assert.equal(generationCall.body.modelId, "seedream-v4.5-edit");
  } finally {
    await bridge.close();
    await mockApi.close();
  }
});
