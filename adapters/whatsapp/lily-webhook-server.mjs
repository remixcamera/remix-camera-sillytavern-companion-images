#!/usr/bin/env node

import http from "node:http";
import { createRemixWhatsAppTool } from "./remix-whatsapp-tool.mjs";

const LILY_PROFILE_ID = "GLUCbfOgIzOLe37Ft4G7S97B0fu2_lily";
const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || "";
const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || "";
const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN || "";
const graphApiBaseUrl = process.env.WHATSAPP_GRAPH_API_BASE_URL || "https://graph.facebook.com/v25.0";
const bridgeUrl = process.env.REMIX_BRIDGE_URL || "http://127.0.0.1:8787";
const port = Number(process.env.PORT || process.env.WHATSAPP_WEBHOOK_PORT || 8791);

if (!accessToken || !phoneNumberId || !verifyToken) {
  console.error("WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, and WHATSAPP_VERIFY_TOKEN are required.");
  process.exit(1);
}

const tool = createRemixWhatsAppTool({
  accessToken,
  phoneNumberId,
  graphApiBaseUrl,
  bridgeUrl,
  profileId: process.env.REMIX_PROFILE_ID || LILY_PROFILE_ID,
  characterName: process.env.REMIX_CHARACTER_NAME || "Lily",
  visualIdentity:
    process.env.REMIX_CHARACTER_VISUAL_IDENTITY ||
    "Lily is a clearly adult AI companion with consistent face, hair, body type, realistic phone-camera presence, and a warm, playful style based on her Remix.Camera profile photos.",
  snapTtlSeconds: Number(process.env.REMIX_PRIVATE_SNAP_TTL_SECONDS || 120),
});

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  if (!chunks.length) {
    return {};
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
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
    return true;
  }
  sendJson(res, 403, { ok: false, error: "Invalid WhatsApp verify token." });
  return true;
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, { ok: true, service: "remix-camera-whatsapp-lily", bridgeUrl, graphApiBaseUrl });
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

  try {
    const payload = await readJson(req);
    const results = await tool.handleWebhook(payload);
    sendJson(res, 200, { ok: true, handled: results.length });
  } catch (error) {
    console.warn(`WhatsApp webhook failed: ${error.message}`);
    sendJson(res, 200, { ok: true, handled: 0, warning: error.message });
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Remix.Camera Lily WhatsApp webhook listening on :${port}; bridge=${bridgeUrl}`);
});
