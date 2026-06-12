#!/usr/bin/env node

import { discordSlashCommands } from "./remix-discord-tool.mjs";

const botToken = process.env.DISCORD_BOT_TOKEN || "";
const applicationId = process.env.DISCORD_APPLICATION_ID || "";
const guildId = process.env.DISCORD_GUILD_ID || "";

if (!botToken || !applicationId) {
  console.error("DISCORD_BOT_TOKEN and DISCORD_APPLICATION_ID are required.");
  process.exit(1);
}

const route = guildId
  ? `applications/${applicationId}/guilds/${guildId}/commands`
  : `applications/${applicationId}/commands`;

const response = await fetch(`https://discord.com/api/v10/${route}`, {
  method: "PUT",
  headers: {
    Authorization: `Bot ${botToken}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(discordSlashCommands()),
});

const payload = await response.json().catch(() => ({}));
if (!response.ok) {
  console.error(payload?.message || `Discord command registration failed with ${response.status}`);
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, route, commandCount: payload.length }, null, 2));

