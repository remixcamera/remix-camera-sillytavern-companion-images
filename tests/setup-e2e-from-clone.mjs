import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, mkdir, readFile, stat } from "node:fs/promises";
import { spawn } from "node:child_process";
import http from "node:http";
import os from "node:os";
import path from "node:path";

const repoRoot = path.resolve(new URL("..", import.meta.url).pathname);

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json", "content-length": Buffer.byteLength(payload) });
  res.end(payload);
}

async function body(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
}

async function freePort() {
  const server = http.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

async function waitFor(predicate, timeoutMs, debug) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error(`Timed out: ${debug()}`);
}

const root = await mkdtemp(path.join(os.tmpdir(), "remix-sillytavern-e2e-"));
const sillyTavernDir = path.join(root, "SillyTavern");
const configPath = path.join(root, "config", "bridge.json");
await mkdir(path.join(sillyTavernDir, "public", "scripts"), { recursive: true });
await mkdir(path.join(sillyTavernDir, "data", "default-user"), { recursive: true });

const telemetryEvents = [];
const apiCalls = [];
const api = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const requestBody = req.method === "POST" ? await body(req) : {};
  apiCalls.push({ method: req.method, pathname: url.pathname, body: requestBody });

  if (req.method === "POST" && url.pathname === "/api/integrations/sillytavern/telemetry") {
    telemetryEvents.push(requestBody);
    return json(res, 202, { ok: true });
  }
  if (req.method === "POST" && url.pathname === "/api/v1/design/auth/device/start") {
    return json(res, 200, {
      deviceCode: "rdc_e2e.secret",
      userCode: "TEST-CODE",
      verificationUriComplete: "https://remix.camera/account/sillytavern?code=TEST-CODE",
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
      intervalSeconds: 0,
    });
  }
  if (req.method === "POST" && url.pathname === "/api/v1/design/auth/device/poll") {
    return json(res, 200, {
      ok: true,
      sessionToken: "dapi_e2e.secret",
      profileId: "profile_e2e",
      characterName: "Fresh Clone Companion",
      session: { sessionId: "session_e2e", source: "sillytavern" },
    });
  }
  if (req.method === "GET" && url.pathname === "/api/v1/design/profiles") {
    return json(res, 200, { profiles: [{ id: "profile_e2e", name: "Fresh Clone Companion", fluxReady: true }] });
  }
  if (req.method === "POST" && url.pathname === "/api/v1/design/sillytavern/character-card") {
    const payload = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    res.writeHead(200, {
      "content-type": "image/png",
      "content-length": payload.byteLength,
      "content-disposition": 'attachment; filename="fresh-clone-companion.character.png"',
    });
    return res.end(payload);
  }
  if (req.method === "GET" && url.pathname === "/api/v1/design/templates") {
    return json(res, 200, {
      templates: [{
        id: "pack_e2e",
        slug: "fresh-clone-selfie",
        title: "Fresh Clone Selfie",
        prompt: "A realistic phone-camera selfie in a warm room, natural light, believable social photo.",
        proven: { qualityTier: "excellent" },
        match: {
          why: "A realistic phone-camera selfie in a warm room, natural light, believable social photo.",
          score: 0.99,
        },
      }],
    });
  }
  if (req.method === "GET" && url.pathname === "/api/v1/design/templates/pack_e2e") {
    return json(res, 200, {
      template: {
        id: "pack_e2e",
        slug: "fresh-clone-selfie",
        title: "Fresh Clone Selfie",
        prompts: [{
          index: 0,
          prompt: "A realistic phone-camera selfie in a warm room, natural light, believable social photo.",
          aspectRatio: "1:1",
          recommendedModelId: "nano-banana",
        }],
      },
    });
  }
  if (req.method === "POST" && url.pathname === "/api/v1/design/generations") {
    return json(res, 200, { generation: { id: "generation_e2e", status: "generating" } });
  }
  if (req.method === "POST" && url.pathname === "/api/v1/design/generations/status") {
    return json(res, 200, { generations: [{ id: "generation_e2e", status: "completed", imageUrl: "/generated/e2e.jpg" }] });
  }
  if (req.method === "GET" && url.pathname === "/generated/e2e.jpg") {
    const payload = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    res.writeHead(200, { "content-type": "image/jpeg", "content-length": payload.byteLength });
    return res.end(payload);
  }
  return json(res, 404, { error: "not found" });
});
api.listen(0, "127.0.0.1");
await once(api, "listening");

const apiBaseUrl = `http://127.0.0.1:${api.address().port}`;
const bridgePort = await freePort();
const setup = spawn(process.execPath, [
  path.join(repoRoot, "bin", "setup.mjs"),
  `--sillytavern-dir=${sillyTavernDir}`,
  `--api-base-url=${apiBaseUrl}`,
  `--config=${configPath}`,
  `--port=${bridgePort}`,
  "--source=e2e_fresh_clone",
  "--no-open",
], {
  cwd: repoRoot,
  env: { ...process.env, DO_NOT_TRACK: "0", REMIX_TELEMETRY_DISABLED: "0" },
  stdio: ["ignore", "pipe", "pipe"],
});
let setupOutput = "";
setup.stdout.on("data", (chunk) => { setupOutput += chunk.toString(); });
setup.stderr.on("data", (chunk) => { setupOutput += chunk.toString(); });
const [setupCode] = await once(setup, "exit");
assert.equal(setupCode, 0, setupOutput);

const extensionPath = path.join(sillyTavernDir, "data", "default-user", "extensions", "remix-camera-companion-images", "index.js");
const cardPath = path.join(sillyTavernDir, "data", "default-user", "characters", "fresh-clone-companion.character.png");
assert.ok((await stat(extensionPath)).size > 1_000);
assert.equal((await stat(cardPath)).size, 8);
const config = JSON.parse(await readFile(configPath, "utf8"));
assert.equal(config.profileId, "profile_e2e");
assert.equal(config.telemetry.installSource, "e2e_fresh_clone");
assert.equal(config.telemetry.enabled, true);
assert.equal(config.clientName, undefined);

const bridgeUrl = `http://127.0.0.1:${bridgePort}`;
await waitFor(async () => {
  try {
    return (await fetch(`${bridgeUrl}/health`)).ok;
  } catch {
    return false;
  }
}, 5_000, () => setupOutput);
const health = await (await fetch(`${bridgeUrl}/health`)).json();
assert.equal(health.ok, true);
assert.equal(health.version, "0.4.0-alpha.3");
assert.equal(health.defaultProfileId, "profile_e2e");

const generatedResponse = await fetch(`${bridgeUrl}/v1/commands/generate`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({
    command: "send-selfie",
    characterName: "Fresh Clone Companion",
    visualIdentity: "adult woman with auburn hair and green eyes",
    mood: "happy after a clean install",
    yes: true,
    maxGenerations: 1,
  }),
});
const generated = await generatedResponse.json();
assert.equal(generatedResponse.status, 200, JSON.stringify(generated));
assert.equal(generated.ok, true);
assert.equal(generated.results[0].productionImageUrl, `${apiBaseUrl}/generated/e2e.jpg`);

await waitFor(
  () => telemetryEvents.some((event) => event.eventName === "sillytavern_first_image_completed"),
  3_000,
  () => JSON.stringify(telemetryEvents),
);
const expectedEvents = [
  "sillytavern_install_started",
  "sillytavern_pairing_started",
  "sillytavern_pairing_completed",
  "sillytavern_setup_completed",
  "sillytavern_bridge_started",
  "sillytavern_first_image_completed",
];
assert.deepEqual(telemetryEvents.map((event) => event.eventName), expectedEvents);
assert.equal(new Set(telemetryEvents.map((event) => event.installationId)).size, 1);
for (const event of telemetryEvents) {
  assert.deepEqual(Object.keys(event).sort(), [
    "eventName",
    "installSource",
    "installationId",
    "packageVersion",
    "target",
  ]);
  assert.equal(event.packageVersion, "0.4.0-alpha.3");
}

const bridgeProcessId = Number((await import("node:child_process")).execFileSync("lsof", ["-ti", `tcp:${bridgePort}`], { encoding: "utf8" }).trim());
if (Number.isFinite(bridgeProcessId) && bridgeProcessId > 1) process.kill(bridgeProcessId, "SIGTERM");
await new Promise((resolve) => api.close(resolve));

console.log(JSON.stringify({
  ok: true,
  cleanRoot: root,
  extensionInstalled: extensionPath,
  characterCardInstalled: cardPath,
  health,
  firstImage: generated.results[0].productionImageUrl,
  telemetryEvents: expectedEvents,
  apiCallCount: apiCalls.length,
  setupOutput: setupOutput.trim(),
}, null, 2));
