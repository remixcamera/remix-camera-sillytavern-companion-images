import assert from "node:assert/strict";
import test from "node:test";
import {
  buildBridgeInputFromKakao,
  createRemixKakaoSkill,
  extractKakaoUtterance,
  kakaoSkillResponseForResult,
  parseKakaoCommand,
  runKakaoRemixCommand,
  shouldHandleKakaoSkill,
} from "../adapters/kakao/remix-kakao-skill.mjs";

test("Kakao parser maps utterances to bridge commands", () => {
  assert.deepEqual(parseKakaoCommand("selfie cozy couch"), {
    type: "image",
    action: "generate",
    command: "send-selfie",
    text: "cozy couch",
  });
  assert.deepEqual(parseKakaoCommand("preview vacation Amalfi coast"), {
    type: "image",
    action: "dry-run",
    command: "couples-vacation",
    text: "Amalfi coast",
  });
  assert.deepEqual(parseKakaoCommand("help"), { type: "help" });
});

test("Kakao extracts utterance from Skill payload shapes", () => {
  assert.equal(extractKakaoUtterance({ userRequest: { utterance: "selfie couch" } }), "selfie couch");
  assert.equal(extractKakaoUtterance({ action: { params: { prompt: "date dinner" } } }), "date dinner");
  assert.equal(
    shouldHandleKakaoSkill({
      userRequest: { utterance: "preview selfie couch" },
    }),
    true,
  );
});

test("Kakao bridge input requires explicit yes for couple and private generation", () => {
  const couple = buildBridgeInputFromKakao(parseKakaoCommand("couple yes coffee shop booth"), {
    profileId: "profile_1",
    characterName: "Lily",
  });
  assert.equal(couple.yes, true);
  assert.equal(couple.userConsent, "yes");
  assert.equal(couple.profileId, "profile_1");

  const snap = buildBridgeInputFromKakao(parseKakaoCommand("snap bedroom mirror"), {});
  assert.equal(snap.matureContent, true);
  assert.equal(snap.yes, undefined);
});

test("Kakao run returns instruction instead of spending when consent is missing", async () => {
  const result = await runKakaoRemixCommand(parseKakaoCommand("snap bedroom mirror"), {
    fetchImpl: () => {
      throw new Error("bridge should not be called");
    },
  });
  assert.equal(result.type, "text");
  assert.match(result.text, /explicit yes/);
});

test("Kakao run calls bridge and returns dry-run text", async () => {
  const calls = [];
  const result = await runKakaoRemixCommand(parseKakaoCommand("preview selfie cozy couch"), {
    bridgeUrl: "http://bridge.local",
    fetchImpl: async (url, options) => {
      calls.push({ url, body: JSON.parse(options.body) });
      return Response.json({
        ok: true,
        dryRun: true,
        prompt: "cozy prompt",
        promptTemplate: { packTitle: "Excellent selfie" },
      });
    },
  });
  assert.equal(calls[0].url, "http://bridge.local/v1/tools/send-selfie/dry-run");
  assert.equal(calls[0].body.yes, undefined);
  assert.equal(result.payload.dryRun, true);
  assert.match(result.text, /Preview ready/);
});

test("Kakao response returns simpleImage outputs for public production URLs", () => {
  const response = kakaoSkillResponseForResult({
    type: "bridge",
    imageUrls: ["http://127.0.0.1:8787/v1/images/abc"],
    payload: {
      results: [
        { productionImageUrl: "https://cdn.example/remix-1.jpg" },
        { productionImageUrl: "https://cdn.example/remix-2.jpg" },
      ],
    },
  });
  assert.equal(response.version, "2.0");
  assert.deepEqual(response.template.outputs, [
    { simpleImage: { imageUrl: "https://cdn.example/remix-1.jpg", altText: "Remix.Camera companion image" } },
    { simpleImage: { imageUrl: "https://cdn.example/remix-2.jpg", altText: "Remix.Camera companion image 2" } },
  ]);
});

test("Kakao response does not return local bridge URLs as simpleImage payloads", () => {
  const response = kakaoSkillResponseForResult({
    type: "bridge",
    imageUrls: ["http://127.0.0.1:8787/v1/images/abc"],
    payload: { results: [{ imageUrl: "http://127.0.0.1:8787/v1/images/abc" }] },
  });
  assert.equal(response.template.outputs[0].simpleText.text.includes("public HTTPS image URL"), true);
});

test("Kakao Skill handler returns version 2.0 response", async () => {
  const skill = createRemixKakaoSkill({
    bridgeUrl: "http://bridge.local",
    fetchImpl: async () =>
      Response.json({
        ok: true,
        dryRun: true,
        prompt: "cozy prompt",
        promptTemplate: { packTitle: "Excellent selfie" },
      }),
  });
  const details = await skill.handleSkillDetailed({
    userRequest: { utterance: "preview selfie couch" },
  });
  assert.equal(details.handled, true);
  assert.equal(details.response.version, "2.0");
  assert.match(details.response.template.outputs[0].simpleText.text, /Preview ready/);
});
