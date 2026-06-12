#!/usr/bin/env node

import {
  createRemixMatrixTool,
  extractMatrixTextEvents,
  matrixSync,
  matrixWhoAmI,
} from "./remix-matrix-tool.mjs";

const LILY_PROFILE_ID = "GLUCbfOgIzOLe37Ft4G7S97B0fu2_lily";
const homeserverUrl = process.env.MATRIX_HOMESERVER_URL || "";
const accessToken = process.env.MATRIX_ACCESS_TOKEN || "";
const bridgeUrl = process.env.REMIX_BRIDGE_URL || "http://127.0.0.1:8787";
const roomIdFilter = process.env.MATRIX_ROOM_ID || "";

if (!homeserverUrl || !accessToken) {
  console.error("MATRIX_HOMESERVER_URL and MATRIX_ACCESS_TOKEN are required.");
  process.exit(1);
}

const tool = createRemixMatrixTool({
  homeserverUrl,
  accessToken,
  bridgeUrl,
  profileId: process.env.REMIX_PROFILE_ID || LILY_PROFILE_ID,
  characterName: process.env.REMIX_CHARACTER_NAME || "Lily",
  visualIdentity:
    process.env.REMIX_CHARACTER_VISUAL_IDENTITY ||
    "Lily is a clearly adult AI companion with consistent face, hair, body type, realistic phone-camera presence, and a warm, playful style based on her Remix.Camera profile photos.",
  snapTtlSeconds: Number(process.env.REMIX_PRIVATE_SNAP_TTL_SECONDS || 120),
  requirePrefix: process.env.MATRIX_REQUIRE_PREFIX !== "false",
});

async function main() {
  const whoami = await matrixWhoAmI({ homeserverUrl, accessToken });
  let since = "";
  console.log(`Lily Matrix sync bot listening as ${whoami.user_id}; bridge=${bridgeUrl}`);
  while (true) {
    try {
      const payload = await matrixSync({ homeserverUrl, accessToken, since, timeoutMs: 30000 });
      since = payload.next_batch || since;
      const events = extractMatrixTextEvents(payload, {
        ownUserId: whoami.user_id,
        requirePrefix: process.env.MATRIX_REQUIRE_PREFIX !== "false",
      }).filter((event) => !roomIdFilter || event.roomId === roomIdFilter);
      for (const event of events) {
        try {
          await tool.handleTextEvent(event, { ownUserId: whoami.user_id });
        } catch (error) {
          console.warn(`Matrix event ${event.eventId || "unknown"} failed: ${error.message}`);
        }
      }
    } catch (error) {
      console.warn(`Matrix sync failed: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 2500));
    }
  }
}

main();
