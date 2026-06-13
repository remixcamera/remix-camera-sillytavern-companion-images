#!/usr/bin/env node

import http from "node:http";
import { createRemixKakaoSkill, kakaoHelpText } from "./remix-kakao-skill.mjs";

const port = Number(process.env.PORT || process.env.KAKAO_PORT || 3098);
const bridgeUrl = process.env.REMIX_BRIDGE_URL || "http://127.0.0.1:8787";
const characterName = process.env.LILY_CHARACTER_NAME || "Lily";

const skill = createRemixKakaoSkill({
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
      sendJson(res, 200, { ok: true, service: "remix-camera-kakao-lily", bridgeUrl });
      return;
    }

    if (req.method === "GET" && req.url === "/help") {
      sendJson(res, 200, { ok: true, text: kakaoHelpText(characterName) });
      return;
    }

    if (req.method === "POST" && (req.url === "/kakao/skill" || req.url === "/")) {
      const body = await readBody(req);
      const payload = JSON.parse(body.toString("utf8") || "{}");
      const details = await skill.handleSkillDetailed(payload);
      sendJson(res, 200, details.response);
      return;
    }

    sendJson(res, 404, { ok: false, error: "not-found" });
  } catch (error) {
    sendJson(res, 200, {
      version: "2.0",
      template: {
        outputs: [
          {
            simpleText: {
              text: error?.message || "Remix.Camera image skill failed.",
            },
          },
        ],
      },
    });
  }
});

server.listen(port, () => {
  console.log(`Remix.Camera Kakao Lily skill server listening on http://127.0.0.1:${port}`);
  console.log(`Set your Kakao i/Open Builder Skill URL to https://your-host.example/kakao/skill`);
});
