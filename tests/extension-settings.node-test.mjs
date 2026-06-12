import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const extensionPath = path.join(packageRoot, "extension", "remix-camera-companion-images", "index.js");

test("extension scopes character overrides by SillyTavern card identity before placeholder profile id", async () => {
  const source = await readFile(extensionPath, "utf8");
  const functionStart = source.indexOf("function activeCharacterKey");
  const functionEnd = source.indexOf("function hasCardSettings", functionStart);
  assert.ok(functionStart >= 0, "activeCharacterKey helper should exist.");
  assert.ok(functionEnd > functionStart, "activeCharacterKey helper should be followed by hasCardSettings.");

  const body = source.slice(functionStart, functionEnd);
  const avatarIndex = body.indexOf("cleanString(character?.avatar)");
  const nameIndex = body.indexOf("cleanString(character?.name)");
  const fallbackIndex = body.indexOf("profileId ||");

  assert.ok(avatarIndex >= 0, "activeCharacterKey should include SillyTavern avatar identity.");
  assert.ok(nameIndex >= 0, "activeCharacterKey should include SillyTavern character name identity.");
  assert.ok(fallbackIndex >= 0, "activeCharacterKey should use a normalized profile id fallback.");
  assert.ok(avatarIndex < fallbackIndex, "avatar identity should be preferred before profile id fallback.");
  assert.ok(nameIndex < fallbackIndex, "character name identity should be preferred before profile id fallback.");
});

test("extension ignores stale flat character fields when active card has remix metadata", async () => {
  const source = await readFile(extensionPath, "utf8");

  assert.match(
    source,
    /const legacy = cardHasSettings \? "" : cleanString\(saved\[key\]\);/,
    "flat saved character fields should not override card metadata once a card declares remix_camera.",
  );
  assert.match(
    source,
    /cleanString\(scoped\[key\]\) \|\| cleanString\(card\[key\]\) \|\| legacy/,
    "scoped per-character overrides should beat card metadata, and card metadata should beat legacy flat settings.",
  );
});

test("extension treats packaged placeholder profile id as empty", async () => {
  const source = await readFile(extensionPath, "utf8");

  assert.match(
    source,
    /function cleanProfileId\(value\) \{[\s\S]*?profileId === "profile_replace_me" \? "" : profileId;[\s\S]*?\}/,
    "extension should normalize profile_replace_me to an empty profile id.",
  );
  assert.match(
    source,
    /profileId: cleanProfileId\(remix\.profileId\)/,
    "character-card profile ids should be normalized before hydrating settings.",
  );
  assert.match(
    source,
    /profileId: cleanProfileId\(inputValue\("remix-camera-profile-id"\)\)/,
    "profile ids typed into the extension UI should be normalized before saving.",
  );
});

test("extension exposes moment tools and snap controls", async () => {
  const source = await readFile(extensionPath, "utf8");

  [
    "remix_couples_vacation",
    "remix_date_night",
    "remix_daily_life_snap",
    "remix_private_snap",
    "couples-vacation",
    "date-night",
    "daily-life-snap",
    "private-snap",
    "remix-camera-vacation-button",
    "remix-camera-date-button",
    "remix-camera-daily-snap-button",
    "remix-camera-private-snap-button",
    "remix-camera-proactive-snaps",
    "remix-camera-snap-ttl",
  ].forEach((needle) => {
    assert.match(source, new RegExp(needle.replaceAll("-", "\\-")), `${needle} should be present in the extension source.`);
  });
});
