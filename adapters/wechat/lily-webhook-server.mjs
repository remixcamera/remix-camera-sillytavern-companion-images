#!/usr/bin/env node

import http from "node:http";
import { createRemixWeChatTool, verifyWeChatSignature, wechatHelpText } from "./remix-wechat-tool.mjs";

const port = Number(process.env.PORT || process.env.WECHAT_PORT || 3099);
const bridgeUrl = process.env.REMIX_BRIDGE_URL || "http://127.0.0.1:8787";
const accessToken = process.env.WECHAT_ACCESS_TOKEN || "";
const webhookToken = process.env.WECHAT_WEBHOOK_TOKEN || "";
const characterName = process.env.LILY_CHARACTER_NAME || "Lily";

const tool = createRemixWeChatTool({
  accessToken,
  bridgeUrl,
  characterName,
});

function sendText(res, statusCode, text) {
  res.writeHead(statusCode, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

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

function queryParams(req) {
  return new URL(req.url || "/", "http://127.0.0.1").searchParams;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/health") {
      sendJson(res, 200, { ok: true, service: "remix-camera-wechat-lily", bridgeUrl });
      return;
    }

    if (req.method === "GET" && (req.url || "").startsWith("/wechat/webhook")) {
      const params = queryParams(req);
      const signatureOk = verifyWeChatSignature({
        token: webhookToken,
        signature: params.get("signature"),
        timestamp: params.get("timestamp"),
        nonce: params.get("nonce"),
      });
      if (!signatureOk) {
        sendText(res, 401, "invalid signature");
        return;
      }
      sendText(res, 200, params.get("echostr") || "");
      return;
    }

    if (req.method === "POST" && (req.url || "").startsWith("/wechat/webhook")) {
      const params = queryParams(req);
      if (webhookToken) {
        const signatureOk = verifyWeChatSignature({
          token: webhookToken,
          signature: params.get("signature"),
          timestamp: params.get("timestamp"),
          nonce: params.get("nonce"),
        });
        if (!signatureOk) {
          sendText(res, 401, "invalid signature");
          return;
        }
      }

      const body = await readBody(req);
      const details = await tool.handleWebhookDetailed(body.toString("utf8"));
      sendText(res, 200, details.some((item) => item.handled) ? "success" : "");
      return;
    }

    if (req.method === "GET" && req.url === "/help") {
      sendJson(res, 200, { ok: true, text: wechatHelpText(characterName) });
      return;
    }

    sendJson(res, 404, { ok: false, error: "not-found" });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error?.message || String(error) });
  }
});

server.listen(port, () => {
  console.log(`Remix.Camera WeChat Lily webhook listening on http://127.0.0.1:${port}`);
  console.log("Set your WeChat Official Account callback URL to https://your-host.example/wechat/webhook");
});
