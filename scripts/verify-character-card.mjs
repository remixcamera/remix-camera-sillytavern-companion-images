#!/usr/bin/env node

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const charactersDir = path.join(packageRoot, "characters");

const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function readPngTextChunks(buffer) {
  assert(buffer.subarray(0, 8).equals(pngSignature), "Character card PNG has an invalid PNG signature.");

  const chunks = [];
  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    chunks.push({ type, data });
    offset += 12 + length;
    if (type === "IEND") {
      break;
    }
  }

  return chunks
    .filter((chunk) => chunk.type === "tEXt")
    .map((chunk) => {
      const separatorIndex = chunk.data.indexOf(0);
      assert(separatorIndex >= 0, "PNG tEXt chunk is missing a keyword separator.");
      return {
        keyword: chunk.data.subarray(0, separatorIndex).toString("latin1"),
        text: chunk.data.subarray(separatorIndex + 1).toString("latin1"),
      };
    });
}

function readCharacterCardFromPng(buffer) {
  const chara = readPngTextChunks(buffer).find((chunk) => chunk.keyword.toLowerCase() === "chara");
  assert(chara, "Character card PNG is missing a chara tEXt chunk.");
  return JSON.parse(Buffer.from(chara.text, "base64").toString("utf8"));
}

function verifyCommonCard(card, source) {
  assert(card.spec === "chara_card_v2", `${source} must be a Character Card V2 document.`);
  assert(card.spec_version === "2.0", `${source} must use spec_version 2.0.`);
  assert(card.data?.name, `${source} must define a character name.`);
  assert(card.data?.extensions?.remix_camera, `${source} must include data.extensions.remix_camera.`);

  const remix = card.data.extensions.remix_camera;
  assert(remix.bridgeUrl === "http://127.0.0.1:8787", `${source} must point to the local bridge by default.`);
  assert(remix.characterName === card.data.name, `${source} remix characterName must match the card name.`);
  assert(Array.isArray(remix.allowedTools), `${source} must list allowed Remix.Camera tools.`);
  for (const tool of ["send-selfie", "auto-selfie-from-chat", "outfit-try-on", "couple-photo"]) {
    assert(remix.allowedTools.includes(tool), `${source} must allow ${tool}.`);
  }
  assert(String(remix.visualIdentity || "").length > 80, `${source} must include a substantial visualIdentity.`);
  assert(String(remix.defaultStyle || "").length > 40, `${source} must include a useful defaultStyle.`);
  assert(String(remix.negativePrompt || "").includes("duplicated face"), `${source} must include a useful negative prompt.`);
}

function verifyMilaCard(card, source) {
  verifyCommonCard(card, source);
  const remix = card.data.extensions.remix_camera;
  assert(card.data.name === "Mila", `${source} must define Mila as the production character.`);
  assert(remix.profileId === "Izz7MdQXLlM0xqzrODpUoAwCNff1_mila", `${source} must carry the Mila Remix.Camera profile ID.`);
  assert(String(remix.visualIdentity || "").includes("soft brown hair"), `${source} visual identity must preserve Mila hair.`);
  assert(String(remix.visualIdentity || "").includes("warm expressive eyes"), `${source} visual identity must preserve Mila eyes.`);
  assert(String(remix.defaultStyle || "").includes("photorealistic"), `${source} default style must be photorealistic for Mila.`);
  assert(!String(remix.visualIdentity || "").includes("Seraphina"), `${source} must not mix Seraphina visual anchors into Mila.`);
}

function verifySeraphinaCard(card, source) {
  verifyCommonCard(card, source);
  const remix = card.data.extensions.remix_camera;
  assert(card.data.name === "Seraphina", `${source} must define Seraphina as the character name.`);
  assert(String(card.data?.creator || "").includes("OtisAlejandro"), `${source} must preserve the original Seraphina creator attribution.`);
  assert(remix.profileId === "profile_replace_me", `${source} must require a matching trained profile by default.`);
  assert(String(remix.visualIdentity || "").includes("pastel-pink hair"), `${source} visual identity must preserve Seraphina hair.`);
  assert(String(remix.visualIdentity || "").includes("amber eyes"), `${source} visual identity must preserve Seraphina eyes.`);
  assert(String(remix.visualIdentity || "").includes("anime fantasy"), `${source} visual identity must preserve the illustrated/anime character style.`);
  assert(String(remix.defaultLocation || "").includes("Eldoria"), `${source} default location must preserve Eldoria context.`);
  assert(String(remix.defaultStyle || "").includes("anime fantasy illustration"), `${source} default style must match the illustrated Seraphina card.`);
}

function verifyLilyCard(card, source) {
  verifyCommonCard(card, source);
  const remix = card.data.extensions.remix_camera;
  assert(card.data.name === "Lily", `${source} must define Lily as the production live demo character.`);
  assert(remix.profileId === "GLUCbfOgIzOLe37Ft4G7S97B0fu2_lily", `${source} must carry the ready Lily Remix.Camera profile ID.`);
  assert(remix.gender === "female", `${source} must carry Lily profile gender metadata.`);
  assert(String(remix.bio || "").includes("visual companion"), `${source} must carry a Remix.Camera-style character bio.`);
  assert(remix.matureContent === false, `${source} must default Lily to standard SFW mode.`);
  assert(String(remix.referenceImageKey || "").includes("GLUCbfOgIzOLe37Ft4G7S97B0fu2_lily"), `${source} must carry Lily's explicit Nano reference image key.`);
  assert(String(remix.visualIdentity || "").includes("dark brunette hair"), `${source} visual identity must preserve Lily hair.`);
  assert(String(remix.visualIdentity || "").includes("hazel green eyes"), `${source} visual identity must preserve Lily eyes.`);
  assert(String(remix.defaultStyle || "").includes("photorealistic"), `${source} default style must be photorealistic for Lily.`);
}

const verified = [];
for (const fileName of (await readdir(charactersDir)).filter((name) => name.endsWith(".character.json")).sort()) {
  const jsonPath = path.join(charactersDir, fileName);
  const pngPath = path.join(charactersDir, fileName.replace(/\.json$/, ".png"));
  const jsonCard = JSON.parse(await readFile(jsonPath, "utf8"));
  const pngCard = readCharacterCardFromPng(await readFile(pngPath));

  if (fileName.startsWith("mila-")) {
    verifyMilaCard(jsonCard, jsonPath);
    verifyMilaCard(pngCard, pngPath);
  } else if (fileName.startsWith("seraphina-")) {
    verifySeraphinaCard(jsonCard, jsonPath);
    verifySeraphinaCard(pngCard, pngPath);
  } else if (fileName.startsWith("lily-")) {
    verifyLilyCard(jsonCard, jsonPath);
    verifyLilyCard(pngCard, pngPath);
  } else {
    verifyCommonCard(jsonCard, jsonPath);
    verifyCommonCard(pngCard, pngPath);
  }

  assert(
    JSON.stringify(jsonCard.data.extensions.remix_camera) === JSON.stringify(pngCard.data.extensions.remix_camera),
    `${fileName} PNG and JSON cards must carry identical remix_camera metadata.`,
  );
  verified.push({
    jsonPath,
    pngPath,
    character: pngCard.data.name,
    hasRemixCameraMetadata: true,
  });
}

assert(verified.some((item) => item.character === "Mila"), "The package must include the production Mila character card.");
assert(verified.some((item) => item.character === "Lily"), "The package must include the production-ready Lily character card.");

console.log(JSON.stringify({
  ok: true,
  verified,
}, null, 2));
