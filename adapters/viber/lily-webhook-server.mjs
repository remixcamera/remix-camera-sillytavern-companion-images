#!/usr/bin/env node

import http from "node:http";
import { createRemixViberTool, viberHelpText, verifyViberSignature } from "./remix-viber-tool.mjs";

const port = Number(process.env.PORT || process.env.VIBER_PORT || 3097);
const bridgeUrl = process.env.REMIX_BRIDGE_URL || "http://127.0.0.1:8787";
const authToken = process.env.VIBER_AUTH_TOKEN || "";
const characterName = process.env.LILY_CHARACTER_NAME || "Lily";
const sender = {
  name: process.env.VIBER_SENDER_NAME || characterName,
  avatar: process.env.VIBER_SENDER_AVATAR || undefined,
};

const tool = createRemixViberTool({
  authToken,
  bridgeUrl,
  characterName,
  sender,
});

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      sendJson(res, 200, { ok: true, service: "remix-camera-viber-lily", bridgeUrl });
      return;
    }

    if (req.method === "POST" && (req.url === "/viber/webhook" || req.url === "/")) {
      const body = await readBody(req);
      const signature = req.headers["x-viber-content-signature"];
      if (authToken && !verifyViberSignature({ authToken, signature, body })) {
        sendJson(res, 401, { ok: false, error: "invalid-viber-signature" });
        return;
      }

      const payload = JSON.parse(body.toString("utf8") || "{}");
      if (payload.event === "webhook") {
        sendJson(res, 200, { status: 0, status_message: "ok" });
        return;
      }

      const results = await tool.handleWebhookDetailed(payload);
      sendJson(res, 200, { ok: true, handled: results.filter((item) => item.handled).length, results });
      return;
    }

    if (req.method === "GET" && req.url === "/help") {
      sendJson(res, 200, { ok: true, text: viberHelpText(characterName) });
      return;
    }

    sendJson(res, 404, { ok: false, error: "not-found" });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error?.message || String(error) });
  }
});

server.listen(port, () => {
  console.log(`Remix.Camera Viber Lily webhook listening on http://127.0.0.1:${port}`);
  console.log(`Set your Viber bot webhook to https://your-host.example/viber/webhook`);
});
