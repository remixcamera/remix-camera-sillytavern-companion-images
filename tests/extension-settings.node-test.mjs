import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const extensionPath = path.join(packageRoot, "extension", "remix-camera-companion-images", "index.js");
const manifestPath = path.join(packageRoot, "extension", "remix-camera-companion-images", "manifest.json");
const stylePath = path.join(packageRoot, "extension", "remix-camera-companion-images", "style.css");
const rootStylePath = path.join(packageRoot, "style.css");
const sharedParserPath = path.join(packageRoot, "shared", "companion-command-parser.mjs");
const extensionParserPath = path.join(packageRoot, "extension", "remix-camera-companion-images", "shared", "companion-command-parser.mjs");
const quickTryAssets = [
  "quick-try-selfie.jpg",
  "quick-try-scene.jpg",
  "quick-try-outfit.jpg",
  "quick-try-couple.jpg",
  "quick-try-vacation.jpg",
  "quick-try-date.jpg",
  "quick-try-daily.jpg",
  "quick-try-snap.png",
];

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
    "remix-camera-first-run",
    "remix-camera-source-image-url",
    "remix-camera-date-location",
    "remix-camera-vacation-theme",
    "remix-camera-user-consent",
    "remix-camera-private-consent",
    "remix-camera-proactive-active-chat",
  ].forEach((needle) => {
    assert.match(source, new RegExp(needle.replaceAll("-", "\\-")), `${needle} should be present in the extension source.`);
  });

  assert.match(source, /<\/details>/, "advanced settings should close before the status log.");
  assert.doesNotMatch(source, /window\.prompt|window\.confirm/, "launch quick actions should use native extension fields, not browser dialogs.");
  assert.match(source, /More like this/, "positive feedback should use companion-friendly copy.");
  assert.match(source, /Not quite/, "negative feedback should use companion-friendly copy.");
  assert.doesNotMatch(source, />Good<\/button>|>Bad<\/button>/, "feedback buttons should not use clinical Good/Bad labels.");
  assert.match(source, /withinQuietHours/, "proactive private snaps should respect quiet hours.");
  assert.match(source, /hasActiveVisibleChat/, "proactive private snaps should require an active visible chat by default.");
});

test("extension accepts a dropped or selected source image for Remix from image", async () => {
  const source = await readFile(extensionPath, "utf8");

  [
    "remix-camera-source-image-dropzone",
    "remix-camera-source-image-file",
    "remix-camera-source-image-status",
    "remix-camera-source-image-clear",
    "sourceReferenceImageId",
    "/v1/media/reference-image",
    "waiting for its safety check",
    "This reviewed upload will be reused",
  ].forEach((needle) => {
    assert.match(source, new RegExp(needle.replaceAll("-", "\\-")), `${needle} should be present in the extension source.`);
  });

  assert.match(source, /addEventListener\("drop"/, "the source image target should handle file drops.");
  assert.match(source, /await sourceReferenceArgs\(\)/, "Outfit should prepare the selected local source image before generation.");
  assert.match(source, /This file will be used instead of the URL/, "the UI should explain local-file precedence.");
  assert.match(source, /formData\.set\("file"/, "the extension should send the file as multipart data instead of base64 JSON.");
  assert.match(source, /userReferenceImageId/, "couple and vacation uploads should use the reviewed reference id.");
  assert.doesNotMatch(source, /readAsDataURL|toDataURL/, "reference upload preparation should not create base64 data URLs.");
  assert.doesNotMatch(source, /image\/gif/, "the file picker should not advertise unsupported GIF references.");
});

test("extension packages visual examples for every quick try button", async () => {
  const [styleSource, rootStyleSource] = await Promise.all([
    readFile(stylePath, "utf8"),
    readFile(rootStylePath, "utf8"),
  ]);

  assert.equal(rootStyleSource, styleSource, "root and nested extension styles should match.");

  await Promise.all(
    quickTryAssets.flatMap((asset) => [
      access(path.join(packageRoot, "assets", asset)),
      access(path.join(packageRoot, "extension", "remix-camera-companion-images", "assets", asset)),
    ]),
  );

  for (const asset of quickTryAssets) {
    assert.match(styleSource, new RegExp(asset.replace(".", "\\.")), `${asset} should be referenced by the quick-try CSS.`);
  }
});

test("extension registers opt-in natural language image interceptor", async () => {
  const [source, manifestSource, styleSource, sharedParserSource, extensionParserSource] = await Promise.all([
    readFile(extensionPath, "utf8"),
    readFile(manifestPath, "utf8"),
    readFile(stylePath, "utf8"),
    readFile(sharedParserPath, "utf8"),
    readFile(extensionParserPath, "utf8"),
  ]);
  const manifest = JSON.parse(manifestSource);

  assert.equal(
    manifest.generate_interceptor,
    "remixCameraCompanionImagesGenerateInterceptor",
    "manifest should expose the SillyTavern generate interceptor hook.",
  );
  assert.match(
    source,
    /window\.remixCameraCompanionImagesGenerateInterceptor = naturalLanguageImageInterceptor;/,
    "extension should publish the interceptor function on window for SillyTavern.",
  );
  assert.match(
    source,
    /if \(!settings\(\)\.allowToolCalls \|\| naturalLanguageGenerationInProgress\)/,
    "natural language image generation should stay gated behind the existing tool-call opt-in.",
  );
  assert.match(
    source,
    /parseNaturalCompanionImageRequest/,
    "extension should use the shared companion parser for explicit user image requests.",
  );
  assert.equal(extensionParserSource, sharedParserSource, "installed extension parser copy should match the package shared parser.");
  assert.match(
    source,
    /USER_INCLUDED_COMMANDS\.has\(request\.command\) && request\.args\?\.userConsent !== "yes"/,
    "extension should block natural couple/vacation generation until explicit user-inclusion consent is present.",
  );
  assert.match(
    source,
    /isFollowupImageRequest/,
    "extension should classify contextual follow-up prompts like send it.",
  );
  assert.match(
    source,
    /previousClassifiedImageRequest/,
    "contextual follow-up prompts should reuse the most recent explicit image request.",
  );
  assert.doesNotMatch(
    source,
    /const hasMatureImageIntent|const hasImageNoun|const hasImageVerb/,
    "extension should not keep a separate natural-language classifier that can drift from shared adapters.",
  );
  assert.match(
    source,
    /lastGeneratedImageUrl/,
    "contextual follow-up image requests should have access to the last generated image URL.",
  );
  assert.match(
    source,
    /progressReplyForCommand/,
    "natural language image generation should send a short companion acknowledgement before generation starts.",
  );
  assert.match(
    source,
    /Mmm\. Give me a minute - I'll make it worth the wait\./,
    "private-snap acknowledgement should feel conversational instead of literal.",
  );
  assert.match(
    source,
    /is making this one just for you/,
    "private-snap pending text should avoid robotic tool-status wording.",
  );
  assert.doesNotMatch(
    source,
    /is taking a private snap|I'm taking that for you now/,
    "private-snap waiting copy should not use literal tool-status wording.",
  );
  assert.doesNotMatch(
    source,
    /scheduleSnapExpiry|expiredSnapMessageHtml|snapExpired|Snap expired|snapTtlSeconds|remix-camera-snap-ttl/,
    "private snaps should persist in chat instead of auto-expiring.",
  );
  assert.doesNotMatch(
    styleSource,
    /remix-camera-snap-expired/,
    "extension CSS should not include expired private-snap states.",
  );
  assert.match(
    source,
    /GENERATION_TIMEOUT_MS/,
    "generation requests should have a timeout so pending bubbles cannot hang forever.",
  );
  assert.match(
    source,
    /markStalePendingMessages/,
    "stale pending image messages should be marked retryable after reloads or interruptions.",
  );
  assert.match(
    source,
    /scheduleStalePendingCleanup/,
    "stale pending cleanup should retry after SillyTavern finishes hydrating the active chat.",
  );
  assert.match(
    source,
    /insertPendingImageMessage/,
    "natural language image generation should insert a pending image message while Remix.Camera runs.",
  );
  assert.match(
    styleSource,
    /\.remix-camera-pending/,
    "extension CSS should style the pending image message.",
  );
});
