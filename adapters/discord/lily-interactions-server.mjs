#!/usr/bin/env node

import http from "node:http";
import {
  runDiscordRemixInteraction,
  sendDiscordWebhookResult,
  verifyDiscordSignature,
} from "./remix-discord-tool.mjs";

const LILY_PROFILE_ID = "GLUCbfOgIzOLe37Ft4G7S97B0fu2_lily";
const publicKey = process.env.DISCORD_PUBLIC_KEY || "";
const applicationId = process.env.DISCORD_APPLICATION_ID || "";
const bridgeUrl = process.env.REMIX_BRIDGE_URL || "http://127.0.0.1:8787";
const port = Number(process.env.PORT || process.env.DISCORD_INTERACTIONS_PORT || 8790);

const defaults = {
  bridgeUrl,
  profileId: process.env.REMIX_PROFILE_ID || LILY_PROFILE_ID,
  characterName: process.env.REMIX_CHARACTER_NAME || "Lily",
  visualIdentity:
    process.env.REMIX_CHARACTER_VISUAL_IDENTITY ||
    "Lily is a clearly adult AI companion with consistent face, hair, body type, realistic phone-camera presence, and a warm, playful style based on her Remix.Camera profile photos.",
  snapTtlSeconds: Number(process.env.REMIX_PRIVATE_SNAP_TTL_SECONDS || 120),
};

if (!publicKey || !applicationId) {
  console.error("DISCORD_PUBLIC_KEY and DISCORD_APPLICATION_ID are required.");
  process.exit(1);
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

async function handleInteraction(interaction) {
  const interactionToken = interaction?.token;
  if (!interactionToken) {
    return;
  }
  try {
    const result = await runDiscordRemixInteraction(interaction, defaults);
    await sendDiscordWebhookResult({
      applicationId,
      interactionToken,
      result,
    });
  } catch (error) {
    await sendDiscordWebhookResult({
      applicationId,
      interactionToken,
      result: {
        text: `Lily could not make that image yet: ${error.message}`,
        imageUrls: [],
      },
    }).catch(() => {});
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, { ok: true, service: "remix-camera-discord-lily", bridgeUrl });
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 404, { ok: false, error: "Not found" });
    return;
  }

  const body = await readBody(req);
  const signature = req.headers["x-signature-ed25519"];
  const timestamp = req.headers["x-signature-timestamp"];
  if (!verifyDiscordSignature({ publicKey, signature, timestamp, body })) {
    sendJson(res, 401, { ok: false, error: "Invalid Discord signature" });
    return;
  }

  const interaction = JSON.parse(body.toString("utf8"));
  if (interaction.type === 1) {
    sendJson(res, 200, { type: 1 });
    return;
  }

  if (interaction.type === 2) {
    sendJson(res, 200, {
      type: 5,
      data: {
        content: "Lily is making that with Remix.Camera...",
      },
    });
    void handleInteraction(interaction);
    return;
  }

  sendJson(res, 200, { type: 4, data: { content: "Unsupported Discord interaction." } });
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Remix.Camera Lily Discord interactions server listening on :${port}; bridge=${bridgeUrl}`);
});

