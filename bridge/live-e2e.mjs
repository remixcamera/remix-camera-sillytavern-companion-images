#!/usr/bin/env node

import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const bridgePath = path.join(__dirname, "server.mjs");
const characterPath = path.join(packageRoot, "characters", process.env.REMIX_LIVE_E2E_CHARACTER || "lily-remix-visual.character.json");
const outputDir = path.join(packageRoot, "tmp", "live-e2e");

const args = new Set(process.argv.slice(2));
const shouldGenerate = args.has("--yes") || process.env.REMIX_LIVE_E2E_YES === "true";
const allowAutoProfile = args.has("--allow-auto-profile") || process.env.REMIX_LIVE_E2E_ALLOW_AUTO_PROFILE === "true";

function fail(message) {
  console.error(message);
  process.exitCode = 1;
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanProfileId(value) {
  const profileId = cleanString(value);
  return profileId === "profile_replace_me" ? "" : profileId;
}

async function getFreePort() {
  const server = http.createServer();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  return port;
}

async function waitFor(predicate, timeoutMs, debug) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const value = predicate();
    if (value) {
      return value;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Timed out waiting for condition. ${debug ? debug() : ""}`);
}

async function readCharacterDefaults() {
  const card = JSON.parse(await readFile(characterPath, "utf8"));
  const remix = card?.data?.extensions?.remix_camera;
  if (!remix) {
    throw new Error(`Missing remix_camera metadata in ${characterPath}`);
  }
  return remix;
}

async function startBridge(port) {
  const child = spawn(process.execPath, [bridgePath], {
    cwd: packageRoot,
    env: {
      ...process.env,
      REMIX_BRIDGE_HOST: "127.0.0.1",
      REMIX_BRIDGE_PORT: String(port),
      REMIX_POLL_INTERVAL_MS: process.env.REMIX_POLL_INTERVAL_MS || "2000",
      REMIX_POLL_TIMEOUT_MS: process.env.REMIX_POLL_TIMEOUT_MS || "180000",
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

  await waitFor(() => output.includes("listening"), 5000, () => output);

  return {
    baseUrl: `http://127.0.0.1:${port}`,
    output: () => output,
    close: async () => {
      if (!child.killed) {
        child.kill();
      }
      await once(child, "exit").catch(() => undefined);
    },
  };
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${url} failed with ${response.status}: ${JSON.stringify(payload)}`);
  }
  return payload;
}

async function verifyImageUrl(imageUrl) {
  const response = await fetch(imageUrl, {
    method: "GET",
    headers: { Range: "bytes=0-4095" },
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok && response.status !== 206) {
    throw new Error(`Generated image URL returned ${response.status}: ${imageUrl}`);
  }
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("image/") && !contentType.includes("octet-stream")) {
    throw new Error(`Generated URL did not return an image-like content type: ${contentType}`);
  }
  return {
    status: response.status,
    contentType,
  };
}

function liveRequestBody(remix) {
  return {
    command: "send-selfie",
    characterName: cleanString(remix.characterName) || "Lily",
    profileId: cleanProfileId(process.env.REMIX_PROFILE_ID) || cleanProfileId(remix.profileId),
    mood: cleanString(process.env.REMIX_LIVE_E2E_MOOD) || remix.defaultMood,
    outfit: cleanString(process.env.REMIX_LIVE_E2E_OUTFIT) || remix.defaultOutfit,
    location: cleanString(process.env.REMIX_LIVE_E2E_LOCATION) || remix.defaultLocation,
    style: cleanString(process.env.REMIX_LIVE_E2E_STYLE) || remix.defaultStyle,
    visualIdentity: cleanString(process.env.REMIX_LIVE_E2E_VISUAL_IDENTITY) || remix.visualIdentity,
    negativePrompt: cleanString(process.env.REMIX_LIVE_E2E_NEGATIVE_PROMPT) || remix.negativePrompt,
    maxGenerations: 1,
  };
}

async function main() {
  if (!cleanString(process.env.REMIX_API_KEY)) {
    fail("REMIX_API_KEY is required. Create an API key in Remix.Camera and export it before running live E2E.");
    return;
  }

  const remix = await readCharacterDefaults();
  const body = liveRequestBody(remix);

  if (shouldGenerate && !body.profileId && !allowAutoProfile) {
    fail("REMIX_PROFILE_ID is required for --yes live generation so the output is tied to the intended character. Pass --allow-auto-profile only for smoke tests.");
    return;
  }

  const port = await getFreePort();
  const bridge = await startBridge(port);

  try {
    const health = await requestJson(`${bridge.baseUrl}/health`);
    const dryRun = await requestJson(`${bridge.baseUrl}/v1/commands/dry-run`, {
      method: "POST",
      body: JSON.stringify(body),
    });

    const dryPrompt = dryRun.prompt || "";
    const requiredAnchors = Array.isArray(remix.e2ePromptAnchors) && remix.e2ePromptAnchors.length
      ? remix.e2ePromptAnchors
      : [body.characterName, "photorealistic"];
    for (const requiredText of requiredAnchors.map(cleanString).filter(Boolean)) {
      if (!dryPrompt.includes(requiredText)) {
        throw new Error(`Dry-run prompt is missing required character anchor: ${requiredText}`);
      }
    }

    const result = {
      ok: true,
      mode: shouldGenerate ? "live-generate" : "dry-run-only",
      generatedAt: new Date().toISOString(),
      bridge: {
        health: {
          ok: health.ok,
          service: health.service,
          version: health.version,
          apiBaseUrl: health.apiBaseUrl,
          hasApiKey: health.hasApiKey,
          defaultProfileId: health.defaultProfileId,
        },
      },
      request: {
        ...body,
        profileId: body.profileId || null,
      },
      dryRun: {
        warnings: dryRun.warnings || [],
        prompt: dryPrompt,
      },
      generation: null,
    };

    if (shouldGenerate) {
      const generation = await requestJson(`${bridge.baseUrl}/v1/commands/generate`, {
        method: "POST",
        body: JSON.stringify({
          ...body,
          yes: true,
        }),
      });
      const firstImage = generation.results?.find((item) => item?.ok && item?.imageUrl);
      if (!generation.ok || !firstImage?.imageUrl) {
        throw new Error(`Live generation did not return a successful image: ${JSON.stringify(generation)}`);
      }
      const imageCheck = await verifyImageUrl(firstImage.imageUrl);
      result.generation = {
        ok: generation.ok,
        markdown: generation.markdown,
        firstImage,
        imageCheck,
      };
    }

    await mkdir(outputDir, { recursive: true });
    const resultPath = path.join(outputDir, "result.json");
    await writeFile(resultPath, `${JSON.stringify(result, null, 2)}\n`);

    const reviewPath = path.join(outputDir, "review.md");
    await writeFile(
      reviewPath,
      [
        "# Remix.Camera SillyTavern Live E2E",
        "",
        `Mode: ${result.mode}`,
        `Generated at: ${result.generatedAt}`,
        `Profile ID: ${result.request.profileId || "auto-profile"}`,
        `Prompt includes visual anchors: yes`,
        result.generation?.markdown ? `Generated image: ${result.generation.markdown}` : "Generated image: not requested",
        "",
      ].join("\n"),
    );

    console.log(JSON.stringify({
      ok: true,
      mode: result.mode,
      resultPath,
      reviewPath,
      imageUrl: result.generation?.firstImage?.imageUrl || null,
    }, null, 2));
  } finally {
    await bridge.close();
  }
}

main().catch((error) => {
  fail(error instanceof Error ? error.message : String(error));
});
