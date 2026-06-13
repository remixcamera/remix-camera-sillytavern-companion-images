import { automationToolResultForChat, runAutomationBridgeTool } from "../shared/automation-tool-runner.mjs";

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function truthy(value) {
  return value === true || ["true", "yes", "y", "1", "confirm"].includes(String(value || "").trim().toLowerCase());
}

function commandFromIntent(displayName = "") {
  const normalized = String(displayName || "").toLowerCase().replace(/_/g, "-");
  if (normalized.includes("couples-vacation")) return "couples-vacation";
  if (normalized.includes("couple-photo")) return "couple-photo";
  if (normalized.includes("private-snap")) return "private-snap";
  if (normalized.includes("daily-life-snap")) return "daily-life-snap";
  if (normalized.includes("date-night")) return "date-night";
  if (normalized.includes("outfit-try-on")) return "outfit-try-on";
  if (normalized.includes("auto-selfie")) return "auto-selfie-from-chat";
  if (normalized.includes("selfie")) return "send-selfie";
  return "";
}

function actionFromIntent(displayName = "") {
  const normalized = String(displayName || "").toLowerCase();
  if (normalized.includes("generate")) return "generate";
  if (normalized.includes("preview") || normalized.includes("dry")) return "dry-run";
  return "";
}

function parameterValue(value) {
  if (Array.isArray(value)) return value[0];
  if (value && typeof value === "object") {
    if (typeof value.stringValue === "string") return value.stringValue;
    if (typeof value.original === "string") return value.original;
    if (typeof value.resolved === "string") return value.resolved;
  }
  return value;
}

function parametersFromDialogflowEsRequest(requestBody = {}) {
  return {
    ...(requestBody.queryResult?.parameters || {}),
    ...(requestBody.originalDetectIntentRequest?.payload || {}),
    ...(requestBody.payload || {}),
  };
}

export function dialogflowEsInputFromRequest(requestBody = {}, options = {}) {
  const params = parametersFromDialogflowEsRequest(requestBody);
  const intentName = requestBody.queryResult?.intent?.displayName || "";
  const command = parameterValue(params.command) || commandFromIntent(intentName) || options.command || "send-selfie";
  const action = parameterValue(params.action) || actionFromIntent(intentName) || options.action || "dry-run";
  const prompt = firstString(
    parameterValue(params.prompt),
    parameterValue(params.mood),
    parameterValue(params.location),
    requestBody.queryResult?.queryText,
  );
  return {
    bridgeUrl: parameterValue(params.bridgeUrl) || options.bridgeUrl,
    command,
    action,
    yes: truthy(parameterValue(params.yes) || parameterValue(params.remix_yes)),
    prompt,
    chatText: firstString(parameterValue(params.chatText), parameterValue(params.chat_text), prompt),
    characterName: firstString(parameterValue(params.characterName), parameterValue(params.character_name), options.characterName),
    profileId: firstString(parameterValue(params.profileId), parameterValue(params.profile_id), options.profileId),
    visualIdentity: firstString(parameterValue(params.visualIdentity), parameterValue(params.visual_identity), options.visualIdentity),
    sourceImageUrl: firstString(parameterValue(params.sourceImageUrl), parameterValue(params.source_image_url)),
    userReferenceImageUrl: firstString(parameterValue(params.userReferenceImageUrl), parameterValue(params.user_reference_image_url)),
    userConsent: firstString(parameterValue(params.userConsent), parameterValue(params.user_consent)),
    userDescription: firstString(parameterValue(params.userDescription), parameterValue(params.user_description)),
    outfit: firstString(parameterValue(params.outfit)),
    theme: firstString(parameterValue(params.theme)),
    matureContent: truthy(parameterValue(params.matureContent) || parameterValue(params.mature_content)),
  };
}

export async function runRemixCameraDialogflowEsWebhook(requestBody = {}, options = {}) {
  const input = dialogflowEsInputFromRequest(requestBody, options);
  const result = automationToolResultForChat(await runAutomationBridgeTool(input, options));
  const imageUrl = result.imageUrls[0] || result.payload?.results?.[0]?.productionImageUrl || "";
  const fulfillmentMessages = [
    {
      text: {
        text: [result.text],
      },
    },
  ];
  if (imageUrl) {
    fulfillmentMessages.push({
      card: {
        title: "Remix.Camera companion image",
        subtitle: result.dryRun ? "Preview only" : "Generated image",
        imageUri: imageUrl,
        buttons: [
          {
            text: "Open image",
            postback: imageUrl,
          },
        ],
      },
    });
  }
  fulfillmentMessages.push({
    payload: {
      remixCamera: {
        dryRun: result.dryRun,
        command: result.command,
        action: result.action,
        imageUrls: result.imageUrls,
        imageUrl,
      },
    },
  });

  const outputContexts = [];
  if (requestBody.session) {
    outputContexts.push({
      name: `${requestBody.session}/contexts/remix_camera`,
      lifespanCount: 5,
      parameters: {
        remix_command: result.command,
        remix_action: result.action,
        remix_dry_run: result.dryRun,
        remix_text: result.text,
        remix_prompt_preview: result.payload?.prompt || "",
        remix_image_url: imageUrl,
      },
    });
  }

  return {
    fulfillmentText: result.text,
    fulfillmentMessages,
    outputContexts,
    payload: {
      remixCamera: {
        dryRun: result.dryRun,
        command: result.command,
        action: result.action,
        imageUrls: result.imageUrls,
      },
    },
  };
}
