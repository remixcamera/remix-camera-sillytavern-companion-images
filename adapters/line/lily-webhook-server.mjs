#!/usr/bin/env node

import http from "node:http";
import { createRemixLineTool, verifyLineSignature } from "./remix-line-tool.mjs";

const LILY_PROFILE_ID = "GLUCbfOgIzOLe37Ft4G7S97B0fu2_lily";
const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN || "";
const channelSecret = process.env.LINE_CHANNEL_SECRET || "";
const lineApiBaseUrl = process.env.LINE_API_BASE_URL || "https://api.line.me";
const bridgeUrl = process.env.REMIX_BRIDGE_URL || "http://127.0.0.1:8787";
const port = Number(process.env.PORT || process.env.LINE_WEBHOOK_PORT || 8793);

if (!channelAccessToken || !channelSecret) {
  console.error("LINE_CHANNEL_ACCESS_TOKEN and LINE_CHANNEL_SECRET are required.");
  process.exit(1);
}

const tool = createRemixLineTool({
  channelAccessToken,
  lineApiBaseUrl,
  bridgeUrl,
  profileId: process.env.REMIX_PROFILE_ID || LILY_PROFILE_ID,
  characterName: process.env.REMIX_CHARACTER_NAME || "Lily",
  visualIdentity:
    process.env.REMIX_CHARACTER_VISUAL_IDENTITY ||
    "Lily is a clearly adult AI companion with consistent face, hair, body type, realistic phone-camera presence, and a warm, playful style based on her Remix.Camera profile photos.",
  snapTtlSeconds: Number(process.env.REMIX_PRIVATE_SNAP_TTL_SECONDS || 120),
});

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

async function handleWebhookPayload(payload) {
  try {
    await tool.handleWebhook(payload);
  } catch (error) {
    console.warn(`LINE webhook handling failed: ${error.message}`);
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, { ok: true, service: "remix-camera-line-lily", bridgeUrl, lineApiBaseUrl });
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 404, { ok: false, error: "Not found" });
    return;
  }

  const body = await readBody(req);
  const signature = req.headers["x-line-signature"];
  if (!verifyLineSignature({ channelSecret, signature, body })) {
    sendJson(res, 401, { ok: false, error: "Invalid LINE signature" });
    return;
  }

  let payload;
  try {
    payload = JSON.parse(body.toString("utf8") || "{}");
  } catch {
    sendJson(res, 400, { ok: false, error: "Invalid JSON body" });
    return;
  }
  sendJson(res, 200, { ok: true });
  void handleWebhookPayload(payload);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Remix.Camera Lily LINE webhook listening on :${port}; bridge=${bridgeUrl}`);
});
