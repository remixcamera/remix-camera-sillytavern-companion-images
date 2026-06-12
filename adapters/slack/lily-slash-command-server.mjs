#!/usr/bin/env node

import http from "node:http";
import {
  createRemixSlackTool,
  parseSlackCommand,
  slackHelpText,
  verifySlackSignature,
} from "./remix-slack-tool.mjs";

const LILY_PROFILE_ID = "GLUCbfOgIzOLe37Ft4G7S97B0fu2_lily";
const signingSecret = process.env.SLACK_SIGNING_SECRET || "";
const botToken = process.env.SLACK_BOT_TOKEN || "";
const bridgeUrl = process.env.REMIX_BRIDGE_URL || "http://127.0.0.1:8787";
const port = Number(process.env.PORT || process.env.SLACK_COMMAND_PORT || 8792);
const characterName = process.env.REMIX_CHARACTER_NAME || "Lily";

if (!signingSecret) {
  console.error("SLACK_SIGNING_SECRET is required.");
  process.exit(1);
}

const tool = createRemixSlackTool({
  botToken,
  bridgeUrl,
  profileId: process.env.REMIX_PROFILE_ID || LILY_PROFILE_ID,
  characterName,
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
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function slashPayloadFromBody(body) {
  return Object.fromEntries(new URLSearchParams(body.toString("utf8")));
}

async function handleSlackCommand(payload) {
  try {
    await tool.handleSlashCommand(payload);
  } catch (error) {
    if (payload.response_url) {
      await tool
        .send(
          {
            type: "text",
            text: `Lily could not make that image yet: ${error.message}`,
            imageUrls: [],
          },
          {
            responseUrl: payload.response_url,
            channelId: payload.channel_id,
          },
        )
        .catch(() => {});
    }
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/health") {
    sendJson(res, 200, { ok: true, service: "remix-camera-slack-lily", bridgeUrl });
    return;
  }

  if (req.method !== "POST") {
    sendJson(res, 404, { ok: false, error: "Not found" });
    return;
  }

  const body = await readBody(req);
  const timestamp = req.headers["x-slack-request-timestamp"];
  const signature = req.headers["x-slack-signature"];
  if (!verifySlackSignature({ signingSecret, timestamp, signature, body })) {
    sendJson(res, 401, { ok: false, error: "Invalid Slack signature" });
    return;
  }

  const payload = slashPayloadFromBody(body);
  const parsed = parseSlackCommand(payload.text || "");
  if (!parsed || parsed.type === "help") {
    sendJson(res, 200, {
      response_type: "ephemeral",
      text: slackHelpText(characterName),
    });
    return;
  }

  sendJson(res, 200, {
    response_type: "ephemeral",
    text: "Lily is making that with Remix.Camera...",
  });
  void handleSlackCommand(payload);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Remix.Camera Lily Slack slash-command server listening on :${port}; bridge=${bridgeUrl}`);
});
