//@name remix_camera_companion_images
//@display-name Remix.Camera Companion Images
//@api 3.0
//@version 0.4.0-alpha.3
//@update-url https://raw.githubusercontent.com/remixcamera/remix-camera-sillytavern-companion-images/main/adapters/risu/remix-camera-companion-images.risu.js
//@arg bridge_url string Local bridge URL, default http://127.0.0.1:8787
//@arg profile_id string Optional Remix.Camera profile ID override
//@arg character_name string Optional character name override
//@link https://github.com/remixcamera/remix-camera-sillytavern-companion-images Documentation

(async () => {
  const COMMANDS = [
    {
      name: "send-selfie",
      toolName: "remix_send_selfie",
      description: "Preview or generate an in-character selfie with Remix.Camera.",
      required: [],
    },
    {
      name: "auto-selfie-from-chat",
      toolName: "remix_auto_selfie_from_chat",
      description: "Use recent chat context to preview or generate a spontaneous in-character selfie.",
      required: ["chatText"],
    },
    {
      name: "outfit-try-on",
      toolName: "remix_outfit_try_on",
      description: "Preview or generate an outfit look from a source image URL.",
      required: ["sourceImageUrl"],
    },
    {
      name: "couple-photo",
      toolName: "remix_couple_photo",
      description: "Preview or generate a shared image with the user after explicit consent.",
      required: ["userConsent"],
    },
    {
      name: "couples-vacation",
      toolName: "remix_couples_vacation",
      description: "Preview or generate a cohesive three-photo couples vacation set after explicit consent.",
      required: ["userConsent"],
    },
    {
      name: "date-night",
      toolName: "remix_date_night",
      description: "Preview or generate an in-character date-night image.",
      required: [],
    },
    {
      name: "daily-life-snap",
      toolName: "remix_daily_life_snap",
      description: "Preview or generate a casual daily-life snap.",
      required: [],
    },
    {
      name: "private-snap",
      toolName: "remix_private_snap",
      description: "Preview or generate an opted-in mature private snap.",
      required: [],
    },
  ];

  const COMMON_PROPERTIES = {
    yes: {
      type: "boolean",
      description: "Set true only after the user explicitly asks to spend a Remix.Camera generation. If false or omitted, the tool returns a dry-run preview.",
    },
    profileId: {
      type: "string",
      description: "Optional Remix.Camera profile ID override.",
    },
    characterName: {
      type: "string",
      description: "Optional character name override.",
    },
    visualIdentity: {
      type: "string",
      description: "Stable visual identity for the character.",
    },
    chatText: {
      type: "string",
      description: "Recent chat context.",
    },
    mood: {
      type: "string",
      description: "Mood or tone for the image.",
    },
    outfit: {
      type: "string",
      description: "Wardrobe or styling details.",
    },
    location: {
      type: "string",
      description: "Scene or setting.",
    },
    sourceImageUrl: {
      type: "string",
      description: "Source image URL for outfit/reference workflows.",
    },
    userConsent: {
      type: "string",
      description: "Affirmative user consent, required for couple tools.",
    },
    userDescription: {
      type: "string",
      description: "Description of the consenting adult user in couple images.",
    },
    userReferenceImageUrl: {
      type: "string",
      description: "Optional user reference photo URL for couple images.",
    },
    matureContent: {
      type: "boolean",
      description: "Set true for mature/adult requests so Remix.Camera routes the model correctly.",
    },
    maxGenerations: {
      type: "integer",
      description: "Maximum images to generate. Most tools use 1; couples-vacation may use 3.",
    },
  };

  function cleanUrl(value) {
    return String(value || "http://127.0.0.1:8787").replace(/\/+$/, "");
  }

  function cleanInput(input) {
    return Object.fromEntries(
      Object.entries(input || {}).filter(([, value]) => value !== undefined && value !== null && value !== ""),
    );
  }

  async function getCharacterNameFallback() {
    const configured = await Risuai.getArgument("character_name");
    if (configured) {
      return configured;
    }
    try {
      const character = await Risuai.getCharacter();
      return character?.name || "";
    } catch {
      return "";
    }
  }

  function publicImageMarkdown(payload, characterName) {
    const images = (Array.isArray(payload?.results) ? payload.results : [])
      .map(
        (result) =>
          [result?.productionImageUrl, result?.imageUrl].find((url) => /^https:\/\//i.test(url)) || "",
      )
      .filter(Boolean);
    const label = String(characterName || "").trim()
      .replace(/[\[\]\r\n]+/g, " ")
      .replace(/\s+/g, " ") || "Companion";
    return images
      .map((url, index) => {
        const suffix = images.length > 1 ? ` ${index + 1} of ${images.length}` : "";
        return `![${label} image${suffix}](${url})`;
      })
      .join("\n\n");
  }

  async function callBridge(command, content) {
    const bridgeUrl = cleanUrl(await Risuai.getArgument("bridge_url"));
    const profileId = await Risuai.getArgument("profile_id");
    const characterName = await getCharacterNameFallback();
    const action = content?.yes === true ? "generate" : "dry-run";
    const body = cleanInput({
      ...content,
      profileId: content?.profileId || profileId,
      characterName: content?.characterName || characterName,
    });

    const response = await Risuai.nativeFetch(`${bridgeUrl}/v1/tools/${encodeURIComponent(command)}/${action}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok || payload?.ok === false) {
      return [{ type: "text", text: payload?.error || `Remix.Camera bridge request failed with ${response.status}` }];
    }
    if (payload?.dryRun) {
      const template = payload.promptTemplate?.packTitle || payload.promptTemplate?.packId || "Remix.Camera template";
      return [
        {
          type: "text",
          text: `Remix.Camera preview ready: ${template}\n\n${payload.prompt || ""}\n\nTo spend a generation, call the same tool with yes=true after the user asks for the image.`,
        },
      ];
    }
    const imageMarkdown = publicImageMarkdown(payload, body.characterName);
    if (imageMarkdown || payload?.markdown) {
      return [{ type: "text", text: imageMarkdown || payload.markdown }];
    }
    return [{ type: "text", text: "Remix.Camera completed, but no image markdown was returned." }];
  }

  await Risuai.registerMCP(
    {
      identifier: "plugin:remix-camera-companion-images",
      name: "Remix.Camera Companion Images",
      version: "0.4.0-alpha.3",
      description: "AI companion image tools backed by Remix.Camera prompt templates and a local bridge.",
    },
    async () =>
      COMMANDS.map((command) => ({
        name: command.toolName,
        description: command.description,
        inputSchema: {
          type: "object",
          properties: COMMON_PROPERTIES,
          required: command.required,
        },
      })),
    async (toolName, content) => {
      const command = COMMANDS.find((item) => item.toolName === toolName);
      if (!command) {
        return [{ type: "text", text: `Unknown Remix.Camera tool: ${toolName}` }];
      }
      return callBridge(command.name, content || {});
    },
  );

  await Risuai.onUnload(async () => {
    await Risuai.unregisterMCP("plugin:remix-camera-companion-images");
  });
})();
