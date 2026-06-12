#!/usr/bin/env node

import http from "node:http";
import crypto from "node:crypto";
import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { URL } from "node:url";
import { createBridgeOpenApiDocument, createLobeManifest } from "../lib/companion-tools.mjs";

const SERVICE = "remix-camera-sillytavern-bridge";
const VERSION = "0.3.0";
const COMMANDS = new Set([
  "send-selfie",
  "generate-selfie",
  "auto-selfie-from-chat",
  "outfit-try-on",
  "couple-photo",
  "couples-vacation",
  "date-night",
  "daily-life-snap",
  "private-snap",
]);
const USER_INCLUDED_COMMANDS = new Set(["couple-photo", "couples-vacation"]);
const PRIVATE_SNAP_COMMANDS = new Set(["private-snap"]);
const PHOTO_SET_SHOTS = {
  "couples-vacation": [
    "Photo 1 of 3: a wide establishing couples vacation photo that clearly shows the destination, weather, and shared travel mood.",
    "Photo 2 of 3: a candid activity photo of the two adults together in the same destination, with natural body language and environment detail.",
    "Photo 3 of 3: a closer relaxed keepsake photo from later in the same trip, matching wardrobe, lighting, and vacation theme.",
  ],
};
const PROMPT_TEMPLATE_QUERIES = {
  "send-selfie": "realistic companion selfie phone camera mirror cafe bedroom natural social photo",
  "auto-selfie-from-chat": "realistic candid companion selfie chat context phone camera natural in the moment",
  "outfit-try-on": "fashion outfit try on mirror selfie full body clothing reference editorial phone photo",
  "couple-photo": "realistic couple selfie two adults date mirror affectionate phone camera",
  "couples-vacation": "couple vacation travel photo set beach hotel weekend cohesive romantic destination",
  "date-night": "date night restaurant bar romantic phone selfie dinner booth warm light",
  "daily-life-snap": "daily life candid selfie at home cafe errands phone camera natural update",
  "private-snap": "adult private snap bedroom mirror lingerie phone camera mature intimate selfie",
};
const PROMPT_TEMPLATE_SEARCH_PAGE_SIZE = 8;
const PROMPT_TEMPLATE_DETAIL_LIMIT = 6;
const PROMPT_TEMPLATE_MAX_TEXT_LENGTH = 1400;
const PROMPT_TEMPLATE_QUERY_MAX_LENGTH = 260;
const PREFERRED_PROMPT_TEMPLATE_QUALITY_STATUSES = new Set(["best", "excellent"]);
const PROMPT_TEMPLATE_QUALITY_SCORES = new Map([
  ["best", 160],
  ["excellent", 140],
  ["great", 35],
  ["good", 10],
  ["deprioritized", -120],
  ["low", -90],
  ["bad", -90],
  ["hide", -120],
]);
const DEFAULT_ALLOWED_ORIGINS = [
  "http://127.0.0.1:8000",
  "http://localhost:8000",
  "http://[::1]:8000",
];
const DEFAULT_CONFIG_PATH = path.join(os.homedir(), ".remix-camera", "sillytavern-bridge.json");
const persistedConfig = await loadBridgeConfig();

const config = {
  host: process.env.REMIX_BRIDGE_HOST || "127.0.0.1",
  port: Number(process.env.REMIX_BRIDGE_PORT || 8787),
  configPath: process.env.REMIX_CONFIG_FILE || DEFAULT_CONFIG_PATH,
  apiBaseUrl: trimTrailingSlash(process.env.REMIX_API_BASE_URL || persistedConfig.apiBaseUrl || "https://remix.camera"),
  apiKey: process.env.REMIX_API_KEY || "",
  sessionToken: process.env.REMIX_SESSION_TOKEN || persistedConfig.sessionToken || "",
  defaultProfileId: process.env.REMIX_PROFILE_ID || persistedConfig.profileId || persistedConfig.defaultProfileId || "",
  defaultModelId: process.env.REMIX_DEFAULT_MODEL_ID || "",
  defaultSfwModelId: process.env.REMIX_SFW_MODEL_ID || "nano-banana",
  defaultMatureModelId: process.env.REMIX_NSFW_MODEL_ID || "seedream-v4.5-edit",
  promptTemplatesEnabled: process.env.REMIX_PROMPT_TEMPLATES !== "false",
  allowAdHocPromptFallback: process.env.REMIX_ALLOW_AD_HOC_PROMPT_FALLBACK === "true",
  defaultVisualIdentity: process.env.REMIX_CHARACTER_VISUAL_IDENTITY || "",
  defaultNegativePrompt: process.env.REMIX_NEGATIVE_PROMPT || "",
  allowedOrigins: parseAllowedOrigins(
    process.env.REMIX_ALLOWED_ORIGINS ||
      (Array.isArray(persistedConfig.allowedOrigins) ? persistedConfig.allowedOrigins.join(",") : persistedConfig.allowedOrigins),
  ),
  pollTimeoutMs: Number(process.env.REMIX_POLL_TIMEOUT_MS || 180000),
  pollIntervalMs: Number(process.env.REMIX_POLL_INTERVAL_MS || 2000),
};
const proxiedImages = new Map();
const PROXIED_IMAGE_TTL_MS = 60 * 60 * 1000;
const JSON_BODY_MAX_BYTES = 7 * 1024 * 1024;
const REFERENCE_UPLOAD_MAX_BYTES = 4 * 1024 * 1024;

async function loadBridgeConfig() {
  const configPath = process.env.REMIX_CONFIG_FILE || DEFAULT_CONFIG_PATH;
  try {
    const parsed = JSON.parse(await readFile(configPath, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function parseAllowedOrigins(value) {
  const parsed = cleanString(value)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  return parsed.length ? parsed : DEFAULT_ALLOWED_ORIGINS;
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}

function absoluteRemixUrl(value) {
  const url = cleanString(value);
  if (!url) {
    return "";
  }
  if (/^https?:\/\//i.test(url)) {
    return url;
  }
  if (url.startsWith("/")) {
    return `${config.apiBaseUrl}${url}`;
  }
  return url;
}

function bridgeImageUrl(id) {
  return `http://${config.host}:${config.port}/v1/images/${encodeURIComponent(id)}`;
}

function registerProxiedImage(sourceUrl) {
  const url = absoluteRemixUrl(sourceUrl);
  if (!url) {
    return null;
  }
  cleanupProxiedImages();
  const id = crypto.randomUUID();
  proxiedImages.set(id, {
    sourceUrl: url,
    createdAt: Date.now(),
  });
  return {
    id,
    imageUrl: bridgeImageUrl(id),
    productionImageUrl: url,
  };
}

function cleanupProxiedImages() {
  const cutoff = Date.now() - PROXIED_IMAGE_TTL_MS;
  for (const [id, item] of proxiedImages) {
    if (!item || item.createdAt < cutoff) {
      proxiedImages.delete(id);
    }
  }
}

function requestOrigin(req) {
  return cleanString(req.headers.origin);
}

function isAllowedOrigin(origin) {
  return !origin || config.allowedOrigins.includes(origin);
}

function corsHeaders(req) {
  const origin = requestOrigin(req);
  const headers = {
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    Vary: "Origin",
  };
  if (origin && isAllowedOrigin(origin)) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

function requestBaseUrl(req) {
  const forwardedProto = cleanString(req.headers["x-forwarded-proto"]).split(",")[0].trim();
  const protocol = forwardedProto || "http";
  const host = cleanString(req.headers.host) || `${config.host}:${config.port}`;
  return `${protocol}://${host}`;
}

function sendJson(req, res, status, body) {
  const payload = JSON.stringify(body, null, 2);
  res.writeHead(status, {
    ...corsHeaders(req),
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(payload),
  });
  res.end(payload);
}

function sendOptions(req, res) {
  res.writeHead(204, {
    ...corsHeaders(req),
  });
  res.end();
}

function httpError(status, message, details = undefined) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.byteLength;
    if (size > JSON_BODY_MAX_BYTES) {
      throw httpError(413, "Request body is too large.");
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw);
  } catch {
    throw httpError(400, "Request body must be valid JSON.");
  }
}

function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function cleanProfileId(value) {
  const profileId = cleanString(value);
  return profileId === "profile_replace_me" ? "" : profileId;
}

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.max(min, Math.min(max, parsed));
}

function normalizeCommand(command) {
  const normalized = cleanString(command).toLowerCase();
  return normalized === "generate-selfie" ? "send-selfie" : normalized;
}

function isAffirmativeConsent(value) {
  return ["yes", "y", "true", "confirmed", "i consent"].includes(cleanString(value).toLowerCase());
}

function isTruthyValue(value) {
  if (value === true) {
    return true;
  }
  return ["true", "yes", "y", "1", "nsfw", "mature"].includes(cleanString(value).toLowerCase());
}

function nestedReferenceKey(value) {
  return value && typeof value === "object" ? cleanString(value.s3Key || value.key) : "";
}

function normalizeBody(body) {
  const command = normalizeCommand(body.command);
  if (!COMMANDS.has(command)) {
    throw httpError(400, "Unsupported command.", {
      supportedCommands: [...COMMANDS].filter((item) => item !== "generate-selfie"),
    });
  }

  return {
    command,
    profileId: cleanProfileId(body.profileId) || cleanProfileId(config.defaultProfileId),
    referenceImageKey: cleanString(body.referenceImageKey || body.primaryReferenceImageKey || body.uploadedReferenceImageKey),
    modelId: cleanString(body.modelId || config.defaultModelId),
    characterName: cleanString(body.characterName) || "Companion",
    gender: cleanString(body.gender),
    bio: cleanString(body.bio),
    mood: cleanString(body.mood),
    outfit: cleanString(body.outfit),
    location: cleanString(body.location),
    pose: cleanString(body.pose),
    style: cleanString(body.style),
    visualIdentity: cleanString(body.visualIdentity || body.characterVisualIdentity || config.defaultVisualIdentity),
    negativePrompt: cleanString(body.negativePrompt || config.defaultNegativePrompt),
    chatText: cleanString(body.chatText),
    memory: cleanString(body.memory),
    userDescription: cleanString(body.userDescription),
    userConsent: cleanString(body.userConsent),
    userReferenceImageKey: cleanString(
      body.userReferenceImageKey ||
        body.userPhotoReferenceImageKey ||
        body.userPhotoImageKey ||
        body.userImageKey,
    ) || nestedReferenceKey(body.userReferenceImage || body.userPhoto || body.userImage),
    userReferenceImageUrl: cleanString(
      body.userReferenceImageUrl ||
        body.userPhotoUrl ||
        body.userImageUrl,
    ),
    userReferenceImageDataUrl: cleanString(
      body.userReferenceImageDataUrl ||
        body.userPhotoDataUrl ||
        body.userImageDataUrl,
    ),
    userReferenceImageName: cleanString(
      body.userReferenceImageName ||
        body.userPhotoName ||
        body.userImageName,
    ),
    userReferenceImageMimeType: cleanString(
      body.userReferenceImageMimeType ||
        body.userPhotoMimeType ||
        body.userImageMimeType,
    ),
    theme: cleanString(body.theme || body.sceneTheme || body.vacationTheme),
    snapTtlSeconds: clampInteger(body.snapTtlSeconds, 5, 600, 45),
    sourceImageUrl: cleanString(body.sourceImageUrl),
    referenceImageUrl: cleanString(body.referenceImageUrl),
    maxGenerations: clampInteger(body.maxGenerations, 1, 4, command === "couples-vacation" ? 3 : 1),
    matureContent: PRIVATE_SNAP_COMMANDS.has(command) || isTruthyValue(body.matureContent || body.nsfw || body.contentRating),
    yes: body.yes === true || body.confirm === true || cleanString(body.yes).toLowerCase() === "true",
  };
}

function joinSentences(parts) {
  return parts.filter(Boolean).join(" ");
}

function ensureSentence(value) {
  const trimmed = cleanString(value);
  if (!trimmed) {
    return "";
  }
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

function clipText(value, maxLength = PROMPT_TEMPLATE_MAX_TEXT_LENGTH) {
  const trimmed = cleanString(value).replace(/\s+/g, " ");
  if (trimmed.length <= maxLength) {
    return trimmed;
  }
  return `${trimmed.slice(0, maxLength - 3).trim()}...`;
}

function tokenizeText(value) {
  return new Set(
    cleanString(value)
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, " ")
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length >= 3),
  );
}

function promptTemplateSearchQuery(input) {
  const commandQuery = PROMPT_TEMPLATE_QUERIES[input.command] || PROMPT_TEMPLATE_QUERIES["send-selfie"];
  const situation = [
    input.theme,
    input.location,
    input.outfit,
    input.mood,
    input.pose,
    input.chatText,
    input.memory,
  ]
    .map((part) => cleanString(part))
    .filter(Boolean)
    .join(" ");
  return clipText(`${commandQuery} ${situation}`, PROMPT_TEMPLATE_QUERY_MAX_LENGTH);
}

function normalizeTemplatePrompt(entry) {
  if (typeof entry === "string") {
    return { text: entry, index: 0 };
  }
  if (!entry || typeof entry !== "object") {
    return null;
  }
  const text = cleanString(entry.text || entry.prompt);
  if (!text) {
    return null;
  }
  return {
    text,
    index: Number.isInteger(entry.index) ? entry.index : 0,
    aspectRatio: cleanString(entry.aspectRatio) || null,
    cropStyle: cleanString(entry.cropStyle) || null,
    poseType: cleanString(entry.poseType) || null,
    modelType: cleanString(entry.modelType) || null,
  };
}

function normalizePromptTemplateQuality(value) {
  const normalized = cleanString(value).toLowerCase();
  return PROMPT_TEMPLATE_QUALITY_SCORES.has(normalized) ? normalized : "";
}

function promptTemplateQualityStatus(pack) {
  return normalizePromptTemplateQuality(pack?.adminPriorityStatus) || normalizePromptTemplateQuality(pack?.qualityRating);
}

function promptTemplateQualityScore(pack) {
  return PROMPT_TEMPLATE_QUALITY_SCORES.get(promptTemplateQualityStatus(pack)) || 0;
}

function isPreferredPromptTemplateQuality(pack) {
  return PREFERRED_PROMPT_TEMPLATE_QUALITY_STATUSES.has(promptTemplateQualityStatus(pack));
}

function sortPromptTemplatePackSummaries(packs) {
  return [...packs].sort((a, b) => {
    const qualityDiff = promptTemplateQualityScore(b) - promptTemplateQualityScore(a);
    if (qualityDiff !== 0) {
      return qualityDiff;
    }
    const aScore = typeof a.searchScore === "number" ? a.searchScore : 0;
    const bScore = typeof b.searchScore === "number" ? b.searchScore : 0;
    return bScore - aScore;
  });
}

function promptTemplateCommandFitScore(input, text) {
  const command = input.command;
  if (command.includes("selfie")) {
    return /\b(selfie|phone|mirror|camera)\b/.test(text) ? 6 : 0;
  }
  if (command === "outfit-try-on") {
    return /\b(outfit|dress|fashion|wardrobe|full[- ]body|mirror)\b/.test(text) ? 8 : 0;
  }
  if (command === "couples-vacation") {
    return /\b(vacation|travel|beach|hotel|trip|resort|weekend|couple|together|destination|coast|getaway)\b/.test(text)
      ? 10
      : 0;
  }
  if (USER_INCLUDED_COMMANDS.has(command)) {
    return /\b(couple|two|partner|date|together)\b/.test(text) ? 8 : 0;
  }
  if (command === "date-night") {
    return /\b(date|dinner|restaurant|bar|night|romantic)\b/.test(text) ? 8 : 0;
  }
  if (command === "daily-life-snap") {
    return /\b(candid|home|daily|casual|morning|coffee|errands)\b/.test(text) ? 8 : 0;
  }
  if (command === "private-snap") {
    return /\b(adult|private|bedroom|lingerie|sensual|intimate|mirror)\b/.test(text) ? 10 : 0;
  }
  return 0;
}

function scorePromptTemplate({ query, input, pack, prompt }) {
  const queryTokens = tokenizeText(query);
  const searchableText = [pack.title, pack.description, prompt.text].join(" ");
  const promptTokens = tokenizeText(searchableText);
  let textScore = 0;
  for (const token of queryTokens) {
    if (promptTokens.has(token)) {
      textScore += 2;
    }
  }
  const searchableLower = searchableText.toLowerCase();
  const commandScore = promptTemplateCommandFitScore(input, searchableLower);
  const lengthScore = prompt.text.length > 180 ? 2 : 0;
  const rawQualityScore = promptTemplateQualityScore(pack);
  const qualityScore = commandScore > 0 || textScore >= 8 ? rawQualityScore : Math.min(rawQualityScore, 10);
  const missingCommandPenalty = commandScore > 0 ? 0 : -12;
  const score = textScore + commandScore + lengthScore + qualityScore + missingCommandPenalty;
  return {
    score,
    textScore,
    commandScore,
    qualityScore,
    qualityStatus: promptTemplateQualityStatus(pack),
    preferredQuality: isPreferredPromptTemplateQuality(pack),
  };
}

async function fetchPromptTemplatePackDetail(pack) {
  const idOrSlug = cleanString(pack.id || pack.slug);
  if (!idOrSlug) {
    return null;
  }
  const payload = await remixFetch(`/api/v1/design/packs/${encodeURIComponent(idOrSlug)}`);
  const detail = payload?.pack && typeof payload.pack === "object" ? payload.pack : null;
  if (!detail) {
    return null;
  }
  return {
    id: cleanString(detail.id || pack.id),
    slug: cleanString(detail.slug || pack.slug) || null,
    title: cleanString(detail.title || pack.title) || "Remix.Camera prompt pack",
    description: cleanString(detail.description) || null,
    adminPriorityStatus: normalizePromptTemplateQuality(detail.adminPriorityStatus || pack.adminPriorityStatus) || null,
    qualityRating: normalizePromptTemplateQuality(detail.qualityRating || pack.qualityRating) || null,
    matchedText: cleanString(pack.matchedText) || null,
    prompts: Array.isArray(detail.prompts)
      ? detail.prompts.map(normalizeTemplatePrompt).filter(Boolean)
      : [],
  };
}

async function resolvePromptTemplate(input) {
  if (!config.promptTemplatesEnabled) {
    return null;
  }

  const query = promptTemplateSearchQuery(input);
  const searchPayload = await remixFetch("/api/v1/design/packs/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, pageSize: PROMPT_TEMPLATE_SEARCH_PAGE_SIZE }),
  });
  const packs = Array.isArray(searchPayload?.packs) ? searchPayload.packs : [];
  const rankedPacks = sortPromptTemplatePackSummaries(packs);
  let best = null;

  for (const packSummary of rankedPacks.slice(0, PROMPT_TEMPLATE_DETAIL_LIMIT)) {
    const pack = await fetchPromptTemplatePackDetail(packSummary).catch(() => null);
    if (!pack?.prompts?.length) {
      continue;
    }
    for (const prompt of pack.prompts) {
      const score = scorePromptTemplate({ query, input, pack, prompt });
      if (!best || score.score > best.score || (score.score === best.score && score.qualityScore > best.qualityScore)) {
        best = {
          ...score,
          query,
          packId: pack.id,
          packSlug: pack.slug,
          packTitle: pack.title,
          packDescription: pack.description,
          adminPriorityStatus: pack.adminPriorityStatus,
          qualityRating: pack.qualityRating,
          matchedText: pack.matchedText,
          promptIndex: prompt.index,
          prompt: clipText(prompt.text),
          aspectRatio: prompt.aspectRatio,
          cropStyle: prompt.cropStyle,
          poseType: prompt.poseType,
          modelType: prompt.modelType,
        };
      }
    }
  }

  if (best) {
    return best;
  }

  if (config.allowAdHocPromptFallback) {
    return null;
  }
  throw httpError(502, "No Remix.Camera prompt template was found for this SillyTavern image request.", {
    query,
    packsReturned: packs.length,
  });
}

function buildTemplateSection(input, promptTemplate) {
  if (!promptTemplate?.prompt) {
    return "";
  }
  const subjectRule = USER_INCLUDED_COMMANDS.has(input.command)
    ? `Replace the template's original subjects with ${input.characterName} and the consenting user references described below.`
    : `Replace the template's original subject with ${input.characterName}.`;
  return joinSentences([
    `Use this proven Remix.Camera prompt/template as the scene, composition, lighting, styling, and quality backbone instead of inventing a new generic scene: "${promptTemplate.prompt}"`,
    promptTemplate.packTitle ? `Template source: ${promptTemplate.packTitle}.` : "",
    subjectRule,
    "Keep the template's concrete visual specificity, camera language, setting detail, and composition logic, but adapt it to the current SillyTavern character and chat request.",
  ]);
}

function buildPrompt(input, promptTemplate = null) {
  const name = input.characterName;
  const style = input.style || "character-consistent portrait image, natural composition, polished detail";
  const mood = input.mood || "warm, attentive, in-character";
  const location = input.location || "a private place that fits the current conversation";
  const outfit = input.outfit || "the character's established outfit or a simple believable variation";
  const pose = input.pose || "relaxed selfie pose";
  const identity = input.visualIdentity
    ? `Character visual identity: ${ensureSentence(input.visualIdentity)}`
    : `Preserve ${name}'s established face, hairstyle, body type, wardrobe logic, and overall vibe from the selected Remix.Camera profile.`;
  const profileDetails = joinSentences([
    input.gender ? `Character gender: ${input.gender}.` : "",
    input.bio ? `Character profile bio: ${ensureSentence(input.bio)}` : "",
  ]);
  const referenceDetails = input.referenceImageKey
    ? `The uploaded companion reference image is ${name}. Preserve ${name}'s face, gender, age as clearly adult, hairstyle, and body identity from that reference. Use the reference for identity, not as a pose or background to copy unless the chat asks for that. Do not change ${name} into a different person or different gender.`
    : "";
  const qualityGuardrails = joinSentences([
    "Keep the image character-consistent, relevant to the chat, and plausible as an image sent in the moment.",
    "Follow the requested scene literally: show the requested place, activity, outfit, and relationship context instead of falling back to a generic close-up portrait.",
    "Use natural phone-camera composition with enough environment visible to prove the scene unless the user specifically asks for a tight portrait.",
    "No text overlays, UI, watermarks, duplicated faces, distorted hands, or unrelated people unless the command explicitly asks for the user.",
    input.negativePrompt ? `Avoid: ${ensureSentence(input.negativePrompt)}` : "",
  ]);
  const templateSection = buildTemplateSection(input, promptTemplate);

  if (input.command === "auto-selfie-from-chat") {
    return joinSentences([
      templateSection,
      `Adapt the template into a high-quality in-character selfie of ${name}.`,
      identity,
      profileDetails,
      referenceDetails,
      `Use the recent chat context as the actual scene direction, not loose inspiration. If the chat asks to show a couch, room, cafe, glade, outfit, or object, make that visibly present in the image.`,
      `Do not include chat bubbles or text overlays.`,
      input.chatText ? `Recent chat context: ${input.chatText}` : "",
      input.memory ? `Character memory: ${input.memory}` : "",
      `Mood: ${mood}.`,
      `Setting: ${location}.`,
      `Wardrobe: ${outfit}.`,
      `Pose: ${pose}.`,
      `Style: ${style}.`,
      qualityGuardrails,
    ]);
  }

  if (input.command === "outfit-try-on") {
    return joinSentences([
      templateSection,
      `Adapt the template into an attractive outfit try-on image of ${name}.`,
      identity,
      profileDetails,
      referenceDetails,
      input.sourceImageUrl
        ? "Use the provided source image only as the clothing, outfit, pose, composition, or styling reference. Use the companion reference image for the character identity."
        : "",
      input.chatText ? `Recent chat and outfit request: ${input.chatText}` : "",
      `Outfit goal: ${outfit}.`,
      `Mood: ${mood}.`,
      `Setting: ${location}.`,
      `Pose: ${pose || "clear half-body or full-body view that shows the outfit"}.`,
      `Style: ${style}.`,
      "Preserve the character identity while making the outfit look believable, fitted, and photographed naturally. Show the outfit clearly; do not crop to only the face.",
      qualityGuardrails,
    ]);
  }

  if (input.command === "couple-photo") {
    const hasUserReferenceImage = hasUserReference(input);
    return joinSentences([
      templateSection,
      hasUserReferenceImage
        ? `Create a tasteful couple photo featuring ${name} with the man from the uploaded user reference photo.`
        : `Create a tasteful couple photo featuring ${name} with the user.`,
      identity,
      profileDetails,
      referenceDetails,
      hasUserReferenceImage
        ? joinSentences([
            `The uploaded user reference image is the adult man who should appear with ${name}; preserve his face, age as clearly adult, hairstyle, skin tone, body identity, and visible personal features from that reference.`,
            `Keep ${name} and the uploaded-reference man as two distinct people; do not merge, swap, duplicate, feminize, or clone either face.`,
            input.userDescription ? `Additional user appearance note: ${input.userDescription}.` : "",
          ])
        : input.userDescription
        ? `User appearance: ${input.userDescription}. The user must look visibly distinct from ${name}; do not duplicate or clone ${name}'s face for the user.`
        : `Create a second adult person who is visibly distinct from ${name}; do not duplicate or clone ${name}'s face for the user.`,
      !hasUserReferenceImage && (input.referenceImageUrl || input.sourceImageUrl) ? "Use the provided reference image for the user or scene when available." : "",
      `Mood: ${mood}.`,
      `Setting: ${location}.`,
      `Wardrobe for ${name}: ${outfit}.`,
      `Pose: ${pose}.`,
      `Style: ${style}.`,
      "Make it look like a real shared photo with exactly two distinct adults, natural body language, and no text overlays.",
      qualityGuardrails,
    ]);
  }

  if (input.command === "couples-vacation") {
    const hasUserReferenceImage = hasUserReference(input);
    const theme = input.theme || input.location || "a cohesive romantic vacation destination";
    return joinSentences([
      templateSection,
      hasUserReferenceImage
        ? `Create a polished couples vacation photo set featuring ${name} with the man from the uploaded user reference photo.`
        : `Create a polished couples vacation photo set featuring ${name} with the user.`,
      identity,
      profileDetails,
      referenceDetails,
      hasUserReferenceImage
        ? joinSentences([
            `The uploaded user reference image is the adult man who should appear with ${name}; preserve his face, age as clearly adult, hairstyle, skin tone, body identity, and visible personal features from that reference.`,
            `Keep ${name} and the uploaded-reference man as two distinct adults; do not merge, swap, duplicate, feminize, or clone either face.`,
            input.userDescription ? `Additional user appearance note: ${input.userDescription}.` : "",
          ])
        : input.userDescription
        ? `User appearance: ${input.userDescription}. The user must look visibly distinct from ${name}; do not duplicate or clone ${name}'s face for the user.`
        : `Create a second adult person who is visibly distinct from ${name}; do not duplicate or clone ${name}'s face for the user.`,
      `Vacation theme: ${theme}.`,
      `Mood: ${mood || "romantic, relaxed, candid, travel-photo believable"}.`,
      `Wardrobe for ${name}: ${outfit}.`,
      `Pose: ${pose || "natural couple travel photo, close enough to feel personal, with enough environment to prove the destination"}.`,
      `Style: ${style}.`,
      "Make every image feel like it belongs to the same trip: consistent couple identity, destination, lighting, wardrobe logic, color palette, and relationship mood.",
      "Exactly two distinct adults should appear. Do not add tour groups, strangers, fake phones, text overlays, or duplicated faces.",
      qualityGuardrails,
    ]);
  }

  if (input.command === "date-night") {
    return joinSentences([
      templateSection,
      `Adapt the template into a high-quality date-night image of ${name}.`,
      identity,
      profileDetails,
      referenceDetails,
      input.chatText ? `Recent chat context: ${input.chatText}` : "",
      input.memory ? `Character memory: ${input.memory}` : "",
      `Date setting: ${location || "a realistic date-night setting that fits the conversation"}.`,
      `Mood: ${mood || "warm, flirtatious, present, camera-aware"}.`,
      `Wardrobe: ${outfit || "date-night outfit that fits the character and setting"}.`,
      `Pose: ${pose || "natural phone-camera photo with visible date setting, not a generic portrait"}.`,
      `Style: ${style}.`,
      "The image should feel like a photo sent during an actual date: specific place, real lighting, believable expression, and enough background detail to make the moment feel lived-in.",
      qualityGuardrails,
    ]);
  }

  if (input.command === "daily-life-snap") {
    return joinSentences([
      templateSection,
      `Adapt the template into a casual daily-life snap of ${name}.`,
      identity,
      profileDetails,
      referenceDetails,
      input.chatText ? `Use recent chat context to choose what ${name} is doing right now: ${input.chatText}` : "",
      input.memory ? `Character memory: ${input.memory}` : "",
      `Mood: ${mood || "natural, candid, in-the-moment"}.`,
      `Setting: ${location || "a realistic everyday place that fits the current conversation"}.`,
      `Wardrobe: ${outfit || "everyday outfit that fits the scene"}.`,
      `Pose: ${pose || "casual candid phone-camera snap with visible environment"}.`,
      `Style: ${style}.`,
      "Make it feel like a normal companion update photo rather than a posed glamour portrait.",
      qualityGuardrails,
    ]);
  }

  if (input.command === "private-snap") {
    return joinSentences([
      templateSection,
      `Adapt the template into an adult private snap of ${name} for an opted-in adult companion chat.`,
      identity,
      profileDetails,
      referenceDetails,
      input.chatText ? `Recent private chat context: ${input.chatText}` : "",
      input.memory ? `Character memory: ${input.memory}` : "",
      `Mood: ${mood || "risque, intimate, confident, directly camera-aware"}.`,
      `Setting: ${location || "private bedroom or mirror setting that fits the chat"}.`,
      `Wardrobe: ${outfit || "risque adult outfit that matches the user's request and the character's style"}.`,
      `Pose: ${pose || "private phone-camera snap, adult, consensual, character-consistent"}.`,
      `Style: ${style}.`,
      "All people depicted must be clearly adults. Keep the image private, consensual, and character-consistent. Do not include minors, teen-coded features, public exposure, text overlays, UI, or unrelated people.",
      qualityGuardrails,
    ]);
  }

  return joinSentences([
    templateSection,
    `Adapt the template into a high-quality selfie of ${name}.`,
    identity,
    profileDetails,
    referenceDetails,
    input.chatText ? `Recent chat request: ${input.chatText}` : "",
    `Mood: ${mood}.`,
    `Setting: ${location}.`,
    `Wardrobe: ${outfit}.`,
    `Pose: ${pose}.`,
    `Style: ${style}.`,
    input.memory ? `Character memory: ${input.memory}` : "",
    qualityGuardrails,
  ]);
}

function isMatureContentRequested(input) {
  if (input.matureContent || PRIVATE_SNAP_COMMANDS.has(input.command)) {
    return true;
  }
  const haystack = [
    input.prompt,
    input.chatText,
    input.memory,
    input.mood,
    input.outfit,
    input.location,
    input.pose,
    input.userDescription,
    input.userReferenceImageUrl,
    input.userReferenceImageName,
    input.sourceImageUrl,
    input.referenceImageUrl,
    input.referenceImageKey,
  ].join(" ").toLowerCase();
  return /\b(nsfw|nude|naked|explicit|topless|lingerie|undress|sensual|erotic|adult content)\b/.test(haystack);
}

function hasUserReference(input) {
  return Boolean(
    input.userReferenceImageKey ||
      input.userReferenceImageUrl ||
      input.userReferenceImageDataUrl,
  );
}

function resolveModelId(input) {
  const requested = cleanString(input.modelId);
  if (requested && requested !== "auto") {
    return requested;
  }
  return isMatureContentRequested(input) ? config.defaultMatureModelId : config.defaultSfwModelId;
}

async function buildPlan(input) {
  const promptTemplate = await resolvePromptTemplate(input);
  const prompt = buildPrompt(input, promptTemplate);
  const modelId = resolveModelId(input);
  const sourceImageUrl = input.sourceImageUrl || input.referenceImageUrl;
  const usesImageToImage = Boolean(
    sourceImageUrl && (input.command === "outfit-try-on" || USER_INCLUDED_COMMANDS.has(input.command)),
  );

  const warnings = [];
  if (!input.profileId) {
    warnings.push("No profileId supplied. The bridge will select the first ready Remix.Camera profile, which may not match this character.");
  }
  if (!input.visualIdentity) {
    warnings.push("No visualIdentity supplied. Add character-card remix_camera.visualIdentity for more consistent character images.");
  }
  if (input.command === "outfit-try-on" && !sourceImageUrl) {
    warnings.push("outfit-try-on works best with sourceImageUrl.");
  }
  if (USER_INCLUDED_COMMANDS.has(input.command) && !isAffirmativeConsent(input.userConsent)) {
    warnings.push(`${input.command} requires explicit affirmative user consent, for example userConsent: "yes".`);
  }
  if (!promptTemplate && config.promptTemplatesEnabled) {
    warnings.push("No Remix.Camera prompt template was used; enable template search or fix the template lookup before spending credits.");
  }

  return {
    command: input.command,
    characterName: input.characterName,
    profileId: input.profileId || null,
    modelId: modelId || null,
    matureContent: isMatureContentRequested(input),
    gender: input.gender || null,
    bio: input.bio || null,
    visualIdentity: input.visualIdentity || null,
    negativePrompt: input.negativePrompt || null,
    theme: input.theme || null,
    snapTtlSeconds: input.snapTtlSeconds || null,
    maxGenerations: input.maxGenerations,
    usesImageToImage,
    sourceImageUrl: sourceImageUrl || null,
    referenceImageKey: input.referenceImageKey || null,
    userReferenceImageKey: input.userReferenceImageKey || null,
    hasUserReferenceImage: hasUserReference(input),
    selectedReferenceImages:
      USER_INCLUDED_COMMANDS.has(input.command) &&
      input.profileId &&
      input.referenceImageKey &&
      input.userReferenceImageKey
        ? { [input.profileId]: input.referenceImageKey }
        : null,
    promptTemplate: promptTemplate
      ? {
          query: promptTemplate.query,
          packId: promptTemplate.packId || null,
          packSlug: promptTemplate.packSlug || null,
          packTitle: promptTemplate.packTitle || null,
          adminPriorityStatus: promptTemplate.adminPriorityStatus || null,
          qualityRating: promptTemplate.qualityRating || null,
          qualityStatus: promptTemplate.qualityStatus || null,
          preferredQuality: promptTemplate.preferredQuality === true,
          promptIndex: Number.isInteger(promptTemplate.promptIndex) ? promptTemplate.promptIndex : null,
          matchedText: promptTemplate.matchedText || null,
          score: typeof promptTemplate.score === "number" ? promptTemplate.score : null,
          textScore: typeof promptTemplate.textScore === "number" ? promptTemplate.textScore : null,
          commandScore: typeof promptTemplate.commandScore === "number" ? promptTemplate.commandScore : null,
          qualityScore: typeof promptTemplate.qualityScore === "number" ? promptTemplate.qualityScore : null,
          aspectRatio: promptTemplate.aspectRatio || null,
          cropStyle: promptTemplate.cropStyle || null,
          poseType: promptTemplate.poseType || null,
          modelType: promptTemplate.modelType || null,
          prompt: promptTemplate.prompt || null,
        }
      : null,
    prompt,
    warnings,
  };
}

function schemaResponse() {
  return {
    service: SERVICE,
    version: VERSION,
    commands: [
      {
        name: "send-selfie",
        description: "Generate an in-character selfie.",
        required: [],
        optional: ["profileId", "characterName", "mood", "outfit", "location", "pose", "style", "visualIdentity", "negativePrompt", "memory"],
      },
      {
        name: "auto-selfie-from-chat",
        description: "Use recent SillyTavern chat context to generate a spontaneous in-character selfie.",
        required: ["chatText"],
        optional: ["profileId", "characterName", "mood", "outfit", "location", "pose", "style", "visualIdentity", "negativePrompt", "memory"],
      },
      {
        name: "outfit-try-on",
        description: "Create an outfit image from a clothing or styling source image URL.",
        required: ["sourceImageUrl"],
        optional: ["profileId", "characterName", "mood", "outfit", "location", "pose", "style", "visualIdentity", "negativePrompt"],
      },
      {
        name: "couple-photo",
        description: "Generate a shared image with the user after explicit consent.",
        required: ["userConsent"],
        optional: ["profileId", "characterName", "userDescription", "userReferenceImageKey", "userReferenceImageUrl", "userReferenceImageDataUrl", "sourceImageUrl", "mood", "outfit", "location", "pose", "style", "visualIdentity", "negativePrompt"],
      },
      {
        name: "couples-vacation",
        description: "Generate a cohesive three-photo couples vacation set after explicit user consent.",
        required: ["userConsent"],
        optional: ["profileId", "characterName", "theme", "userDescription", "userReferenceImageKey", "userReferenceImageUrl", "userReferenceImageDataUrl", "mood", "outfit", "location", "pose", "style", "visualIdentity", "negativePrompt", "maxGenerations"],
      },
      {
        name: "date-night",
        description: "Generate an in-character date-night image that fits the current conversation.",
        required: [],
        optional: ["profileId", "characterName", "mood", "outfit", "location", "pose", "style", "visualIdentity", "negativePrompt", "memory", "chatText"],
      },
      {
        name: "daily-life-snap",
        description: "Generate a casual daily-life snap from recent chat context.",
        required: [],
        optional: ["profileId", "characterName", "mood", "outfit", "location", "pose", "style", "visualIdentity", "negativePrompt", "memory", "chatText"],
      },
      {
        name: "private-snap",
        description: "Generate an opted-in mature private snap with ephemeral display metadata.",
        required: [],
        optional: ["profileId", "characterName", "mood", "outfit", "location", "pose", "style", "visualIdentity", "negativePrompt", "memory", "chatText", "snapTtlSeconds"],
      },
    ],
  };
}

async function remixFetch(pathname, options = {}) {
  const authToken = config.sessionToken || config.apiKey;
  if (!authToken) {
    throw httpError(401, "Pair Remix.Camera first. Run npx @remix-camera/sillytavern-setup or set REMIX_SESSION_TOKEN.");
  }

  const headers = {
    Authorization: `Bearer ${authToken}`,
    Accept: "application/json",
    ...options.headers,
  };
  const response = await fetch(`${config.apiBaseUrl}${pathname}`, {
    ...options,
    headers,
  });

  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = { raw: text };
    }
  }

  if (!response.ok) {
    throw httpError(response.status, `Remix.Camera API request failed: ${response.status}`, data);
  }

  return data;
}

function assertReferenceImageBuffer(buffer, mimeType) {
  if (!mimeType.toLowerCase().startsWith("image/")) {
    throw httpError(400, "User reference photo must be an image.");
  }
  if (buffer.byteLength > REFERENCE_UPLOAD_MAX_BYTES) {
    throw httpError(413, "User reference photo must be 4MB or smaller after compression.");
  }
}

function decodeDataUrl(dataUrl, fallbackName, fallbackMimeType) {
  const match = cleanString(dataUrl).match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
  if (!match) {
    throw httpError(400, "userReferenceImageDataUrl must be a valid data URL.");
  }
  const mimeType = cleanString(match[1] || fallbackMimeType || "image/jpeg").toLowerCase();
  const isBase64 = Boolean(match[2]);
  const raw = match[3] || "";
  const buffer = isBase64 ? Buffer.from(raw, "base64") : Buffer.from(decodeURIComponent(raw), "utf8");
  assertReferenceImageBuffer(buffer, mimeType);
  return {
    buffer,
    mimeType,
    fileName: cleanString(fallbackName) || `user-reference.${mimeType.includes("png") ? "png" : "jpg"}`,
  };
}

async function fetchUserReferenceImage(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw httpError(400, "userReferenceImageUrl must be a valid URL.");
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    throw httpError(400, "userReferenceImageUrl must use http or https.");
  }

  const response = await fetch(parsed.toString(), {
    headers: {
      Accept: "image/avif,image/webp,image/png,image/jpeg,image/*;q=0.8",
    },
  });
  if (!response.ok) {
    throw httpError(response.status, `Failed to fetch user reference photo: ${response.status}`);
  }
  const mimeType = cleanString(response.headers.get("content-type") || "image/jpeg").split(";")[0].toLowerCase();
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > REFERENCE_UPLOAD_MAX_BYTES) {
    throw httpError(413, "User reference photo must be 4MB or smaller.");
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  assertReferenceImageBuffer(buffer, mimeType);
  const fileName = decodeURIComponent(parsed.pathname.split("/").filter(Boolean).pop() || "user-reference.jpg");
  return {
    buffer,
    mimeType,
    fileName,
  };
}

async function uploadReferenceImageBuffer({ buffer, mimeType, fileName }) {
  const formData = new FormData();
  formData.set("file", new Blob([buffer], { type: mimeType }), fileName || "user-reference.jpg");
  const payload = await remixFetch("/api/v1/design/media/reference-image", {
    method: "POST",
    body: formData,
  });
  const referenceImage = payload?.referenceImage;
  const s3Key = cleanString(referenceImage?.s3Key || payload?.s3Key);
  if (!s3Key) {
    throw httpError(502, "Reference upload response did not include an s3Key.", payload);
  }
  return {
    s3Key,
    url: cleanString(referenceImage?.url || payload?.url),
  };
}

async function resolveUserReferenceImage(input) {
  if (!USER_INCLUDED_COMMANDS.has(input.command)) {
    return input;
  }
  if (input.userReferenceImageKey || (!input.userReferenceImageDataUrl && !input.userReferenceImageUrl)) {
    return input;
  }

  const image = input.userReferenceImageDataUrl
    ? decodeDataUrl(input.userReferenceImageDataUrl, input.userReferenceImageName, input.userReferenceImageMimeType)
    : await fetchUserReferenceImage(input.userReferenceImageUrl);
  const uploaded = await uploadReferenceImageBuffer(image);
  return {
    ...input,
    userReferenceImageKey: uploaded.s3Key,
  };
}

async function resolveProfileId(profileId) {
  if (profileId) {
    return profileId;
  }

  const payload = await remixFetch("/api/v1/design/profiles");
  const profiles = Array.isArray(payload?.profiles) ? payload.profiles : [];
  const ready = profiles.find((profile) => {
    const status = String(profile.status || profile.trainingStatus || "").toLowerCase();
    return (status === "ready" || status === "trained" || status === "completed") && profile.fluxReady !== false;
  });
  const selected = ready || profiles[0];
  if (!selected?.id) {
    throw httpError(400, "No Remix.Camera profileId was provided and no API profile was available.");
  }
  return selected.id;
}

async function submitGeneration(plan) {
  const profileId = await resolveProfileId(plan.profileId);
  const commonBody = {
    profileId,
    prompt: plan.prompt,
  };

  if (plan.modelId && (!plan.usesImageToImage || plan.referenceImageKey)) {
    commonBody.modelId = plan.modelId;
  }
  const generationReferenceImageKey = plan.userReferenceImageKey || plan.referenceImageKey;
  if (generationReferenceImageKey) {
    commonBody.referenceImage = { s3Key: generationReferenceImageKey };
  }
  if (plan.selectedReferenceImages) {
    commonBody.selectedReferenceImages = plan.selectedReferenceImages;
  }

  if (plan.usesImageToImage && plan.sourceImageUrl) {
    if (plan.referenceImageKey) {
      return remixFetch("/api/v1/design/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...commonBody,
          sourceImageUrl: plan.sourceImageUrl,
        }),
      });
    }
    if (plan.modelId === "seedream-v4.5-edit" || plan.modelId === "seedream-v5-lite-edit") {
      commonBody.modelId = plan.modelId;
    }
    return remixFetch("/api/v1/design/remix-from-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...commonBody,
        imageUrl: plan.sourceImageUrl,
      }),
    });
  }

  return remixFetch("/api/v1/design/generations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(commonBody),
  });
}

function generationIdFromPayload(payload) {
  return payload?.id || payload?.generationId || payload?.generation?.id || null;
}

async function fetchGenerationStatus(id) {
  const payload = await remixFetch("/api/v1/design/generations/status", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: [id] }),
  });

  const generations = Array.isArray(payload?.generations) ? payload.generations : [];
  const generation = generations.find((item) => item?.id === id) || generations[0] || null;
  return { payload, generation };
}

async function pollGeneration(id) {
  const started = Date.now();
  while (Date.now() - started < config.pollTimeoutMs) {
    const { payload, generation } = await fetchGenerationStatus(id);
    const status = String(generation?.status || "").toLowerCase();
    const imageUrl = absoluteRemixUrl(generation?.imageUrl || generation?.result?.imageUrl);

    if (imageUrl && ["completed", "succeeded", "success", "ready"].includes(status)) {
      return {
        ok: true,
        id,
        status,
        imageUrl,
        raw: generation,
      };
    }

    if (["failed", "error", "canceled", "cancelled"].includes(status)) {
      return {
        ok: false,
        id,
        status,
        error: generation?.error || generation?.message || "Generation failed.",
        raw: generation || payload,
      };
    }

    await new Promise((resolve) => setTimeout(resolve, config.pollIntervalMs));
  }

  return {
    ok: false,
    id,
    status: "timeout",
    error: `Generation did not finish within ${config.pollTimeoutMs}ms.`,
  };
}

async function generate(input) {
  if (!input.yes) {
    throw httpError(400, 'Real generations require "yes": true.');
  }
  if (USER_INCLUDED_COMMANDS.has(input.command) && !isAffirmativeConsent(input.userConsent)) {
    throw httpError(400, `${input.command} requires affirmative userConsent such as "yes".`);
  }
  const preparedInput = await resolveUserReferenceImage(input);
  const plan = await buildPlan(preparedInput);
  const shotPrompts = PHOTO_SET_SHOTS[preparedInput.command] || [];

  const results = [];
  for (let index = 0; index < preparedInput.maxGenerations; index += 1) {
    const generationPlan = shotPrompts[index]
      ? { ...plan, prompt: joinSentences([plan.prompt, shotPrompts[index]]) }
      : plan;
    const submitted = await submitGeneration(generationPlan);
    const id = generationIdFromPayload(submitted);
    if (!id) {
      results.push({
        ok: false,
        prompt: generationPlan.prompt,
        error: "Remix.Camera response did not include a generation id.",
        raw: submitted,
      });
      continue;
    }
    results.push({
      ...(await pollGeneration(id)),
      prompt: generationPlan.prompt,
    });
  }

  const displayResults = results.map((result) => {
    if (!result.ok || !result.imageUrl) {
      return result;
    }
    const proxied = registerProxiedImage(result.imageUrl);
    if (!proxied) {
      return result;
    }
    return {
      ...result,
      productionImageUrl: proxied.productionImageUrl,
      bridgeImageId: proxied.id,
      imageUrl: proxied.imageUrl,
    };
  });
  const successfulImages = displayResults.filter((result) => result.ok && result.imageUrl);
  const markdown = successfulImages
    .map((result, index) => {
      const suffix = successfulImages.length > 1 ? ` ${index + 1} of ${successfulImages.length}` : "";
      return `![${input.characterName} ${input.command}${suffix}](${result.imageUrl})`;
    })
    .join("\n\n");
  return {
    ok: displayResults.some((result) => result.ok),
    ...plan,
    results: displayResults,
    markdown,
  };
}

async function serveProxiedImage(req, res, id) {
  cleanupProxiedImages();
  const item = proxiedImages.get(id);
  if (!item) {
    throw httpError(404, "Generated image proxy entry was not found or has expired.");
  }

  const fetchImage = (includeAuth) => {
    const headers = {
      Accept: "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
    };
    if (includeAuth && item.sourceUrl.startsWith(config.apiBaseUrl)) {
      headers.Authorization = `Bearer ${config.sessionToken || config.apiKey}`;
    }
    return fetch(item.sourceUrl, { headers });
  };

  let response = await fetchImage(true);
  if (!response.ok && (response.status === 401 || response.status === 403)) {
    response = await fetchImage(false);
  }
  if (!response.ok) {
    throw httpError(response.status, `Failed to load generated image: ${response.status}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  res.writeHead(200, {
    ...corsHeaders(req),
    "Content-Type": response.headers.get("content-type") || "image/jpeg",
    "Content-Length": buffer.byteLength,
    "Cache-Control": "private, max-age=300",
  });
  res.end(buffer);
}

async function route(req, res) {
  const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
  const origin = requestOrigin(req);

  if (!isAllowedOrigin(origin)) {
    sendJson(req, res, 403, {
      ok: false,
      error: "Origin is not allowed by this local bridge.",
      allowedOrigins: config.allowedOrigins,
    });
    return;
  }

  if (req.method === "OPTIONS") {
    sendOptions(req, res);
    return;
  }

  if (req.method === "GET" && url.pathname === "/health") {
    sendJson(req, res, 200, {
      ok: true,
      service: SERVICE,
      version: VERSION,
      hasApiKey: Boolean(config.apiKey),
      hasSessionToken: Boolean(config.sessionToken),
      authMode: config.sessionToken ? "design_api_session" : config.apiKey ? "api_key" : "missing",
      apiBaseUrl: config.apiBaseUrl,
      configPath: config.configPath,
      defaultProfileId: config.defaultProfileId || null,
      allowedOrigins: config.allowedOrigins,
    });
    return;
  }

  if (req.method === "GET" && url.pathname === "/schema") {
    sendJson(req, res, 200, schemaResponse());
    return;
  }

  if (
    req.method === "GET" &&
    ["/openapi.json", "/openwebui/openapi.json", "/librechat/openapi.json"].includes(url.pathname)
  ) {
    sendJson(req, res, 200, createBridgeOpenApiDocument(requestBaseUrl(req)));
    return;
  }

  if (req.method === "GET" && url.pathname === "/lobe/manifest.json") {
    sendJson(req, res, 200, createLobeManifest(requestBaseUrl(req)));
    return;
  }

  if (req.method === "GET" && url.pathname.startsWith("/v1/images/")) {
    await serveProxiedImage(req, res, decodeURIComponent(url.pathname.slice("/v1/images/".length)));
    return;
  }

  if (req.method === "POST" && url.pathname === "/v1/commands/dry-run") {
    const body = normalizeBody(await readJsonBody(req));
    sendJson(req, res, 200, {
      ok: true,
      dryRun: true,
      ...(await buildPlan(body)),
    });
    return;
  }

  const commandToolMatch = url.pathname.match(/^\/v1\/tools\/([^/]+)\/(dry-run|generate)$/);
  if (req.method === "POST" && commandToolMatch) {
    const command = decodeURIComponent(commandToolMatch[1]);
    const action = commandToolMatch[2];
    const body = normalizeBody({
      ...(await readJsonBody(req)),
      command,
    });
    if (action === "dry-run") {
      sendJson(req, res, 200, {
        ok: true,
        dryRun: true,
        ...(await buildPlan(body)),
      });
      return;
    }
    sendJson(req, res, 200, await generate(body));
    return;
  }

  if (req.method === "POST" && url.pathname === "/v1/commands/generate") {
    const body = normalizeBody(await readJsonBody(req));
    sendJson(req, res, 200, await generate(body));
    return;
  }

  sendJson(req, res, 404, {
    ok: false,
    error: "Not found.",
    routes: [
      "GET /health",
      "GET /schema",
      "GET /openapi.json",
      "GET /lobe/manifest.json",
      "GET /v1/images/:id",
      "POST /v1/commands/dry-run",
      "POST /v1/commands/generate",
      "POST /v1/tools/:command/dry-run",
      "POST /v1/tools/:command/generate",
    ],
  });
}

const server = http.createServer((req, res) => {
  route(req, res).catch((error) => {
    const status = Number.isInteger(error.status) ? error.status : 500;
    sendJson(req, res, status, {
      ok: false,
      error: error.message || "Unexpected bridge error.",
      details: error.details,
    });
  });
});

server.listen(config.port, config.host, () => {
  console.log(`${SERVICE} listening on http://${config.host}:${config.port}`);
});
