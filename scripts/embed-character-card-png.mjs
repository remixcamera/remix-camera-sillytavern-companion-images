#!/usr/bin/env node

import { readdir, readFile, writeFile } from "node:fs/promises";
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

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
}

const crcTable = makeCrcTable();

function crc32(buffer) {
  let c = 0xffffffff;
  for (const byte of buffer) {
    c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function parseChunks(buffer) {
  assert(buffer.subarray(0, 8).equals(pngSignature), "Input file is not a PNG.");

  const chunks = [];
  let offset = 8;
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    const raw = buffer.subarray(offset, offset + 12 + length);
    chunks.push({ type, data, raw });
    offset += 12 + length;
    if (type === "IEND") {
      break;
    }
  }

  assert(chunks.some((item) => item.type === "IEND"), "PNG is missing IEND chunk.");
  return chunks;
}

function isCharaTextChunk(item) {
  if (item.type !== "tEXt") {
    return false;
  }
  const separator = item.data.indexOf(0);
  return separator > 0 && item.data.subarray(0, separator).toString("latin1").toLowerCase() === "chara";
}

function embedCard(pngBuffer, card) {
  const cardData = Buffer.from(`chara\0${Buffer.from(JSON.stringify(card), "utf8").toString("base64")}`, "latin1");
  const cardChunk = chunk("tEXt", cardData);
  const chunks = parseChunks(pngBuffer);
  const output = [pngSignature];

  for (const item of chunks) {
    if (isCharaTextChunk(item)) {
      continue;
    }
    if (item.type === "IEND") {
      output.push(cardChunk);
    }
    output.push(item.raw);
  }

  return Buffer.concat(output);
}

const embedded = [];
for (const fileName of (await readdir(charactersDir)).filter((name) => name.endsWith(".character.json")).sort()) {
  const jsonPath = path.join(charactersDir, fileName);
  const pngPath = path.join(charactersDir, fileName.replace(/\.json$/, ".png"));
  const card = JSON.parse(await readFile(jsonPath, "utf8"));
  await writeFile(pngPath, embedCard(await readFile(pngPath), card));
  embedded.push({ jsonPath, pngPath, character: card?.data?.name || null });
}

console.log(JSON.stringify({
  ok: true,
  embedded,
}, null, 2));
