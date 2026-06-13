import crypto from "node:crypto";
import {
  callBridgeCommand,
  defaultInputForHost,
  imageUrlsFromBridgePayload,
  summarizeBridgePayload,
} from "../shared/bridge-client.mjs";

const COMMAND_BY_SLASH = new Map([
  ["selfie", "send-selfie"],
  ["auto_selfie", "auto-selfie-from-chat"],
  ["outfit", "outfit-try-on"],
  ["couple", "couple-photo"],
  ["vacation", "couples-vacation"],
  ["date", "date-night"],
  ["daily", "daily-life-snap"],
  ["snap", "private-snap"],
]);

const DISCORD_STRING = 3;
const DISCORD_BOOLEAN = 5;
const DISCORD_INTEGER = 4;

function stringOption(name, description, required = false) {
  return { type: DISCORD_STRING, name, description, required };
}

function boolOption(name, description, required = false) {
  return { type: DISCORD_BOOLEAN, name, description, required };
}

export function discordSlashCommands() {
  const common = [stringOption("prompt", "Mood, location, outfit, or chat context to adapt into the image.")];
  return [
    { name: "selfie", description: "Generate a Remix.Camera companion selfie.", options: common },
    { name: "auto_selfie", description: "Generate a selfie from recent chat context.", options: common },
    {
      name: "outfit",
      description: "Generate an outfit try-on image.",
      options: [stringOption("source_image_url", "Public outfit/reference image URL.", true), ...common],
    },
    {
      name: "couple",
      description: "Generate a couple photo after explicit consent.",
      options: [
        boolOption("yes", "Confirm the user explicitly asked to appear in this image.", true),
        ...common,
        stringOption("user_reference_image_url", "Optional user reference photo URL."),
      ],
    },
    {
      name: "vacation",
      description: "Generate a 3-photo couples vacation set after explicit consent.",
      options: [
        boolOption("yes", "Confirm the user explicitly asked for this shared photo set.", true),
        ...common,
      ],
    },
    { name: "date", description: "Generate a date-night companion image.", options: common },
    { name: "daily", description: "Generate a casual daily-life snap.", options: common },
    {
      name: "snap",
      description: "Generate an opted-in private snap.",
      options: [
        boolOption("yes", "Confirm the user explicitly asked for a mature/private image.", true),
        ...common,
        { type: DISCORD_INTEGER, name: "ttl_seconds", description: "Suggested deletion delay for compatible clients.", required: false },
      ],
    },
    {
      name: "preview",
      description: "Preview a Remix.Camera prompt without spending credits.",
      options: [
        {
          type: DISCORD_STRING,
          name: "tool",
          description: "Tool to preview.",
          required: true,
          choices: [...COMMAND_BY_SLASH.entries()].map(([name, command]) => ({ name, value: command })),
        },
        ...common,
      ],
    },
  ];
}

function optionMap(interaction) {
  const options = interaction?.data?.options || [];
  return Object.fromEntries(options.map((option) => [option.name, option.value]));
}

export function parseDiscordInteraction(interaction) {
  const name = interaction?.data?.name;
  const options = optionMap(interaction);
  if (name === "preview") {
    return {
      command: options.tool || "send-selfie",
      action: "dry-run",
      prompt: options.prompt || "",
      options,
    };
  }
  const command = COMMAND_BY_SLASH.get(name);
  if (!command) {
    return null;
  }
  return {
    command,
    action: "generate",
    prompt: options.prompt || "",
    options,
  };
}

export function isRemixDiscordInteraction(interaction) {
  return parseDiscordInteraction(interaction) !== null;
}

export function shouldHandleDiscordInteraction(interaction) {
  return interaction?.type === 2 && isRemixDiscordInteraction(interaction);
}

export function buildBridgeInputFromDiscord(parsed, options = {}) {
  const interactionOptions = parsed?.options || {};
  const prompt = parsed?.prompt || "";
  const input = {
    profileId: options.profileId,
    characterName: options.characterName,
    visualIdentity: options.visualIdentity,
    chatText: prompt,
    mood: prompt,
    location: prompt,
    outfit: parsed?.command === "outfit-try-on" ? prompt : undefined,
    sourceImageUrl: interactionOptions.source_image_url,
    userConsent: ["couple-photo", "couples-vacation"].includes(parsed?.command) && interactionOptions.yes === true ? "yes" : undefined,
    userReferenceImageUrl: interactionOptions.user_reference_image_url,
    theme: parsed?.command === "couples-vacation" ? prompt : undefined,
    matureContent: parsed?.command === "private-snap" ? true : options.matureContent,
    snapTtlSeconds: parsed?.command === "private-snap" ? Number(interactionOptions.ttl_seconds || options.snapTtlSeconds || 120) : undefined,
    maxGenerations: parsed?.command === "couples-vacation" ? 3 : 1,
  };
  if (parsed?.action === "generate") {
    input.yes = true;
  }
  if (parsed?.command === "private-snap" && interactionOptions.yes !== true) {
    delete input.yes;
  }
  return defaultInputForHost(input);
}

export async function runDiscordRemixInteraction(interaction, options = {}) {
  const parsed = parseDiscordInteraction(interaction);
  if (!parsed) {
    return { text: "Unknown Remix.Camera Discord command.", imageUrls: [] };
  }
  if (parsed.action === "generate" && ["couple-photo", "couples-vacation", "private-snap"].includes(parsed.command)) {
    if (parsed.options?.yes !== true) {
      return {
        text: `${parsed.command} needs yes=true before spending credits.`,
        imageUrls: [],
      };
    }
  }

  const input = buildBridgeInputFromDiscord(parsed, options);
  const payload = await callBridgeCommand({
    bridgeUrl: options.bridgeUrl,
    command: parsed.command,
    action: parsed.action,
    input,
    fetchImpl: options.fetchImpl,
  });
  return {
    command: parsed.command,
    input,
    payload,
    text: summarizeBridgePayload(payload),
    imageUrls: imageUrlsFromBridgePayload(payload),
  };
}

export function verifyDiscordSignature({ publicKey, signature, timestamp, body }) {
  if (!publicKey || !signature || !timestamp || !body) {
    return false;
  }
  const key = crypto.createPublicKey({
    key: Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), Buffer.from(publicKey, "hex")]),
    format: "der",
    type: "spki",
  });
  return crypto.verify(null, Buffer.concat([Buffer.from(timestamp), Buffer.from(body)]), key, Buffer.from(signature, "hex"));
}

async function appendDiscordFiles(form, imageUrls) {
  const attachments = [];
  let fileIndex = 0;
  for (const imageUrl of imageUrls) {
    if (/^https?:\/\/(127\.0\.0\.1|localhost|\[::1\])[:/]/i.test(imageUrl)) {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch local bridge image: ${response.status}`);
      }
      const mimeType = response.headers.get("content-type") || "image/jpeg";
      form.set(`files[${fileIndex}]`, new Blob([await response.arrayBuffer()], { type: mimeType }), `remix-camera-${fileIndex + 1}.jpg`);
      attachments.push({ id: fileIndex, filename: `remix-camera-${fileIndex + 1}.jpg` });
      fileIndex += 1;
    } else {
      attachments.push({ id: fileIndex, filename: imageUrl });
    }
  }
  return attachments;
}

export async function sendDiscordWebhookResult({ applicationId, interactionToken, result }) {
  const form = new FormData();
  const attachments = await appendDiscordFiles(form, result.imageUrls || []);
  form.set(
    "payload_json",
    JSON.stringify({
      content: result.imageUrls?.length ? "Remix.Camera" : result.text,
      attachments: attachments.filter((item) => !/^https?:\/\//i.test(item.filename)),
      embeds: attachments
        .filter((item) => /^https?:\/\//i.test(item.filename))
        .map((item) => ({
          image: { url: item.filename },
        })),
    }),
  );

  const response = await fetch(`https://discord.com/api/v10/webhooks/${applicationId}/${interactionToken}`, {
    method: "POST",
    body: form,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload?.message || `Discord webhook failed with ${response.status}`);
  }
  return payload;
}

export function createRemixDiscordTool(options = {}) {
  const handleInteractionDetailed = async (interaction, overrides = {}) => {
    const parsed = parseDiscordInteraction(interaction);
    if (!parsed) {
      return {
        handled: false,
        reason: "unknown-command",
        interactionId: interaction?.id,
        commandName: interaction?.data?.name,
        parsed: null,
        result: null,
        sentMessages: [],
      };
    }

    const merged = { ...options, ...overrides };
    const result = await runDiscordRemixInteraction(interaction, merged);
    const interactionToken = merged.interactionToken || interaction?.token;
    const sentMessages =
      merged.autoSend === false || !merged.applicationId || !interactionToken
        ? []
        : [
            await sendDiscordWebhookResult({
              applicationId: merged.applicationId,
              interactionToken,
              result,
            }),
          ];

    return {
      handled: true,
      interactionId: interaction?.id,
      interactionToken,
      commandName: interaction?.data?.name,
      parsed,
      result,
      sentMessages,
    };
  };

  return {
    slashCommands: discordSlashCommands,
    parseInteraction: parseDiscordInteraction,
    isInteraction: isRemixDiscordInteraction,
    shouldHandleInteraction: shouldHandleDiscordInteraction,
    buildInput: (parsed) => buildBridgeInputFromDiscord(parsed, options),
    run: (interaction, overrides = {}) => runDiscordRemixInteraction(interaction, { ...options, ...overrides }),
    send: (result, sendOptions = {}) => sendDiscordWebhookResult({ ...options, ...sendOptions, result }),
    handleInteractionDetailed,
    async handleInteraction(interaction, overrides = {}) {
      const details = await handleInteractionDetailed(interaction, overrides);
      return details.handled ? details.result : null;
    },
  };
}
