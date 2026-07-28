export const COMPANION_COMMANDS = [
  {
    name: "send-selfie",
    toolName: "sendSelfie",
    title: "Send Selfie",
    description: "Generate an in-character selfie using the Remix.Camera prompt library and the paired character profile.",
    required: [],
  },
  {
    name: "auto-selfie-from-chat",
    toolName: "autoSelfieFromChat",
    title: "Auto Selfie From Chat",
    description: "Turn recent companion chat context into a natural in-character selfie.",
    required: ["chatText"],
  },
  {
    name: "outfit-try-on",
    toolName: "outfitTryOn",
    title: "Outfit Try-On",
    description: "Create an outfit image from a reviewed reference id or a clothing/styling source image URL.",
    required: [],
  },
  {
    name: "couple-photo",
    toolName: "couplePhoto",
    title: "Couple Photo",
    description: "Generate one shared image with the user after explicit consent.",
    required: ["userConsent"],
  },
  {
    name: "couples-vacation",
    toolName: "couplesVacation",
    title: "Couples Vacation",
    description: "Generate a cohesive three-photo couples vacation set after explicit consent.",
    required: ["userConsent"],
  },
  {
    name: "date-night",
    toolName: "dateNight",
    title: "Date Night",
    description: "Generate an in-character date-night image that fits the current conversation.",
    required: [],
  },
  {
    name: "daily-life-snap",
    toolName: "dailyLifeSnap",
    title: "Daily Life Snap",
    description: "Generate a casual daily-life snap from recent chat context.",
    required: [],
  },
  {
    name: "private-snap",
    toolName: "privateSnap",
    title: "Private Snap",
    description: "Generate an opted-in mature private snap that stays visible in chat unless the user deletes it.",
    required: [],
  },
];

export const COMPANION_COMMAND_NAMES = COMPANION_COMMANDS.map((command) => command.name);

const COMMON_PROPERTIES = {
  profileId: {
    type: "string",
    description: "Remix.Camera character profile ID. If omitted, the paired bridge default is used.",
  },
  characterName: {
    type: "string",
    description: "Companion character name shown in returned chat markdown.",
  },
  visualIdentity: {
    type: "string",
    description: "Stable visual identity for the character, normally derived from the Remix.Camera profile.",
  },
  referenceImageKey: {
    type: "string",
    description: "Optional Remix.Camera reference image key for the character.",
  },
  mood: {
    type: "string",
    description: "Current mood or emotional tone.",
  },
  outfit: {
    type: "string",
    description: "Desired wardrobe or styling details.",
  },
  location: {
    type: "string",
    description: "Scene or setting to adapt into the selected Remix.Camera prompt template.",
  },
  pose: {
    type: "string",
    description: "Pose or framing preference.",
  },
  style: {
    type: "string",
    description: "Photographic style preference, such as realistic phone-camera selfie.",
  },
  negativePrompt: {
    type: "string",
    description: "Extra negative prompt constraints.",
  },
  memory: {
    type: "string",
    description: "Relevant character memory or relationship context.",
  },
  chatText: {
    type: "string",
    description: "Recent chat context used to choose and adapt the image prompt.",
  },
  sourceImageUrl: {
    type: "string",
    format: "uri",
    description: "Source image URL that the bridge fetches, uploads, and safety-reviews before image-to-image generation.",
  },
  sourceReferenceImageId: {
    type: "string",
    description: "Previously uploaded and reviewed Remix.Camera reference image id for image-to-image workflows.",
  },
  theme: {
    type: "string",
    description: "Theme for a multi-photo set, such as beach weekend, city break, or ski lodge.",
  },
  userConsent: {
    type: "string",
    description: "Required affirmative consent for images that include the user. Use yes only when the user explicitly asked.",
  },
  userDescription: {
    type: "string",
    description: "Description of the consenting adult user who should appear in couple images.",
  },
  userReferenceImageKey: {
    type: "string",
    description: "Legacy Remix.Camera uploaded reference image key retained as bridge metadata.",
  },
  userReferenceImageId: {
    type: "string",
    description: "Reviewed Remix.Camera reference image id for the consenting user in couple images.",
  },
  userReferenceImageUrl: {
    type: "string",
    format: "uri",
    description: "Public image URL to upload as the user's reference photo for couple images.",
  },
  userReferenceImageDataUrl: {
    type: "string",
    description: "Data URL for the user's reference photo; must be compressed before sending.",
  },
  matureContent: {
    type: "boolean",
    description: "Set true for mature/adult requests so the bridge routes to the mature model.",
  },
  maxGenerations: {
    type: "integer",
    minimum: 1,
    maximum: 3,
    description: "Maximum number of images to spend. Most tools use 1; couples-vacation may use 3.",
  },
};

export function commandDefinition(commandName) {
  return COMPANION_COMMANDS.find((command) => command.name === commandName) || null;
}

export function createCommandInputSchema(commandName, options = {}) {
  const command = commandDefinition(commandName);
  if (!command) {
    throw new Error(`Unknown companion command: ${commandName}`);
  }

  const properties = {
    ...COMMON_PROPERTIES,
  };
  const required = [...command.required];

  if (options.includeCommand) {
    properties.command = {
      type: "string",
      enum: [command.name],
      description: "Companion image command.",
    };
    required.unshift("command");
  }

  if (options.includeSpendGuard) {
    properties.yes = {
      type: "boolean",
      description: "Must be true to spend Remix.Camera generation credits. Omit or false for dry-run preview.",
    };
    if (options.requireSpendGuard) {
      required.unshift("yes");
    }
  }

  return {
    type: "object",
    additionalProperties: false,
    properties,
    required,
  };
}

function normalizePathPrefix(value) {
  const cleaned = String(value || "").trim().replace(/^\/+|\/+$/g, "");
  return cleaned ? `/${cleaned}` : "";
}

function withPathPrefix(pathPrefix, pathname) {
  return `${normalizePathPrefix(pathPrefix)}${pathname}`;
}

function maybeSecurity(options) {
  return options.includeSecurity ? { security: [{ bearerAuth: [] }] } : {};
}

export function createBridgeOpenApiDocument(baseUrl = "http://127.0.0.1:8787", options = {}) {
  const pathPrefix = normalizePathPrefix(options.pathPrefix);
  const info = {
    title: options.title || "Remix.Camera Companion Images",
    version: options.version || "0.4.0",
    description:
      options.description ||
      "Companion-image tools backed by Remix.Camera prompt templates and a local scoped bridge token.",
  };
  const paths = {
    [withPathPrefix(pathPrefix, "/health")]: {
      get: {
        operationId: "healthCheck",
        summary: "Check the local Remix.Camera companion bridge.",
        ...maybeSecurity(options),
        responses: {
          200: {
            description: "Bridge status.",
          },
        },
      },
    },
  };

  for (const command of COMPANION_COMMANDS) {
    paths[withPathPrefix(pathPrefix, `/v1/tools/${command.name}/dry-run`)] = {
      post: {
        operationId: `${command.toolName}DryRun`,
        summary: `Preview ${command.title}`,
        description: `${command.description} This endpoint does not spend generation credits.`,
        ...maybeSecurity(options),
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: createCommandInputSchema(command.name, {
                includeSpendGuard: false,
              }),
            },
          },
        },
        responses: {
          200: {
            description: "Prompt preview and selected Remix.Camera template.",
          },
        },
      },
    };
    paths[withPathPrefix(pathPrefix, `/v1/tools/${command.name}/generate`)] = {
      post: {
        operationId: command.toolName,
        summary: command.title,
        description: `${command.description} Requires yes=true so hosts cannot spend credits accidentally.`,
        ...maybeSecurity(options),
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: createCommandInputSchema(command.name, {
                includeSpendGuard: true,
                requireSpendGuard: true,
              }),
            },
          },
        },
        responses: {
          200: {
            description: "Generated image result with chat markdown.",
          },
        },
      },
    };
  }

  const document = {
    openapi: "3.1.0",
    info,
    servers: [
      {
        url: baseUrl,
      },
    ],
    paths,
  };

  if (options.includeSecurity) {
    document.components = {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "REMIX_ACTION_API_KEY",
          description: "Set this in ChatGPT Actions as API Key authentication with Auth Type: Bearer.",
        },
      },
    };
  }

  return document;
}

export function createChatGptActionsOpenApiDocument(baseUrl = "https://your-public-bridge.example.com") {
  return createBridgeOpenApiDocument(baseUrl, {
    pathPrefix: "/chatgpt-actions",
    includeSecurity: true,
    title: "Remix.Camera ChatGPT Companion Image Actions",
    description:
      "ChatGPT Actions schema for Remix.Camera companion-image previews and guarded generation. Preview endpoints never spend credits; generate endpoints require yes=true plus API-key authentication.",
  });
}

export function createLobeManifest(baseUrl = "http://127.0.0.1:8787") {
  const api = COMPANION_COMMANDS.flatMap((command) => [
    {
      url: `${baseUrl}/v1/tools/${command.name}/dry-run`,
      name: `${command.toolName}Preview`,
      description: `Preview ${command.title} with Remix.Camera. This never spends generation credits.`,
      parameters: createCommandInputSchema(command.name, {
        includeSpendGuard: false,
      }),
    },
    {
      url: `${baseUrl}/v1/tools/${command.name}/generate`,
      name: command.toolName,
      description: `${command.description} Pass yes=true only after the user explicitly asks for an image.`,
      parameters: createCommandInputSchema(command.name, {
        includeSpendGuard: true,
        requireSpendGuard: true,
      }),
    },
  ]);

  return {
    $schema: "https://chat-plugin-sdk.lobehub.com/schema.json",
    identifier: "remix-camera-companion-images",
    author: "Remix.Camera",
    createdAt: "2026-06-12",
    homepage: "https://github.com/remixcamera/remix-camera-sillytavern-companion-images",
    gateway: `${baseUrl}/lobe/gateway`,
    meta: {
      avatar: "https://remix.camera/favicon.ico",
      title: "Remix.Camera Companion Images",
      description: "Give an AI companion realistic selfies, date photos, couple photos, travel sets, and private snaps through Remix.Camera.",
      tags: ["image", "companion", "roleplay", "remix-camera"],
    },
    version: "1",
    api,
  };
}
