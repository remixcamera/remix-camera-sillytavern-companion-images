#!/usr/bin/env node

import http from "node:http";
import { createRemixMessengerTool, verifyMessengerSignature } from "./remix-messenger-tool.mjs";

const LILY_PROFILE_ID = "GLUCbfOgIzOLe37Ft4G7S97B0fu2_lily";
const pageAccessToken = process.env.MESSENGER_PAGE_ACCESS_TOKEN || "";
const appSecret = process.env.MESSENGER_APP_SECRET || "";
const verifyToken = process.env.MESSENGER_VERIFY_TOKEN || "";
const graphApiBaseUrl = process.env.MESSENGER_GRAPH_API_BASE_URL || "https://graph.facebook.com/v25.0";
const bridgeUrl = process.env.REMIX_BRIDGE_URL || "http://127.0.0.1:8787";
const port = Number(process.env.PORT || process.env.MESSENGER_WEBHOOK_PORT || 8794);

if (!pageAccessToken || !appSecret || !verifyToken) {
  console.error("MESSENGER_PAGE_ACCESS_TOKEN, MESSENGER_APP_SECRET, and MESSENGER_VERIFY_TOKEN are required.");
  process.exit(1);
}

const tool = createRemixMessengerTool({
  pageAccessToken,
  graphApiBaseUrl,
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

function handleVerification(req, res) {
  const url = new URL(req.url || "/", "http://127.0.0.1");
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge") || "";
  if (mode === "subscribe" && token === verifyToken) {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end(challenge);
    return;
  }
  sendJson(res, 403, { ok: false, error: "Invalid Messenger verify token." });
}

async function handleWebhookPayload(payload) {
  try {
    await tool.handleWebhook(payload);
  } catch (error) {
    console.warn(`Messenger webhook handling failed: ${error.message}`);
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, { ok: true, service: "remix-camera-messenger-lily", bridgeUrl, graphApiBaseUrl });
    return;
  }

  if (req.method === "GET") {
    handleVerification(req, res);
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 404, { ok: false, error: "Not found" });
    return;
  }

  const body = await readBody(req);
  const signature = req.headers["x-hub-signature-256"];
  if (!verifyMessengerSignature({ appSecret, signature, body })) {
    sendJson(res, 401, { ok: false, error: "Invalid Messenger signature" });
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
  console.log(`Remix.Camera Lily Messenger webhook listening on :${port}; bridge=${bridgeUrl}`);
});
