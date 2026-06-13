#!/usr/bin/env node

import http from "node:http";
import { createRemixZaloTool, verifyZaloMac, zaloHelpText } from "./remix-zalo-tool.mjs";

const port = Number(process.env.PORT || process.env.ZALO_PORT || 3100);
const bridgeUrl = process.env.REMIX_BRIDGE_URL || "http://127.0.0.1:8787";
const accessToken = process.env.ZALO_ACCESS_TOKEN || "";
const appSecret = process.env.ZALO_APP_SECRET || "";
const characterName = process.env.LILY_CHARACTER_NAME || "Lily";

const tool = createRemixZaloTool({
  accessToken,
  bridgeUrl,
  characterName,
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
      sendJson(res, 200, { ok: true, service: "remix-camera-zalo-lily", bridgeUrl });
      return;
    }

    if (req.method === "GET" && req.url === "/help") {
      sendJson(res, 200, { ok: true, text: zaloHelpText(characterName) });
      return;
    }

    if (req.method === "POST" && (req.url === "/zalo/webhook" || req.url === "/")) {
      const body = await readBody(req);
      if (appSecret) {
        const mac =
          req.headers["x-zalo-signature"] ||
          req.headers["x-zalo-mac"] ||
          req.headers["x-hub-signature-256"] ||
          "";
        const timestamp = req.headers["x-zalo-timestamp"] || req.headers["x-timestamp"] || "";
        if (!verifyZaloMac({ appSecret, mac: String(mac).replace(/^sha256=/i, ""), timestamp, body })) {
          sendJson(res, 401, { ok: false, error: "invalid-zalo-signature" });
          return;
        }
      }

      const payload = JSON.parse(body.toString("utf8") || "{}");
      const results = await tool.handleWebhookDetailed(payload);
      sendJson(res, 200, { ok: true, handled: results.filter((item) => item.handled).length, results });
      return;
    }

    sendJson(res, 404, { ok: false, error: "not-found" });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error?.message || String(error) });
  }
});

server.listen(port, () => {
  console.log(`Remix.Camera Zalo Lily webhook listening on http://127.0.0.1:${port}`);
  console.log("Set your Zalo OA webhook URL to https://your-host.example/zalo/webhook");
});
