import { automationToolResultForChat, runAutomationBridgeTool } from "../shared/automation-tool-runner.mjs";

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function parameterValue(value) {
  if (value && typeof value === "object") {
    if (typeof value.resolvedValue === "string") return value.resolvedValue;
    if (typeof value.originalValue === "string") return value.originalValue;
  }
  return value;
}

function parametersFromDialogflowCxRequest(requestBody = {}) {
  return {
    ...(requestBody.sessionInfo?.parameters || {}),
    ...(requestBody.intentInfo?.parameters || {}),
    ...(requestBody.payload || {}),
  };
}

function commandFromTag(tag = "") {
  const normalized = String(tag || "").toLowerCase().replace(/_/g, "-");
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

function actionFromTag(tag = "") {
  const normalized = String(tag || "").toLowerCase();
  if (normalized.includes("generate")) return "generate";
  if (normalized.includes("preview") || normalized.includes("dry")) return "dry-run";
  return "";
}

export function dialogflowCxInputFromRequest(requestBody = {}, options = {}) {
  const params = parametersFromDialogflowCxRequest(requestBody);
  const tag = requestBody.fulfillmentInfo?.tag || "";
  const command = parameterValue(params.command) || commandFromTag(tag) || options.command || "send-selfie";
  const action = parameterValue(params.action) || actionFromTag(tag) || options.action || "dry-run";
  const prompt = firstString(
    parameterValue(params.prompt),
    parameterValue(params.mood),
    parameterValue(params.location),
    requestBody.text,
    requestBody.transcript,
  );
  return {
    bridgeUrl: parameterValue(params.bridgeUrl) || options.bridgeUrl,
    command,
    action,
    yes: parameterValue(params.yes) === true || String(parameterValue(params.yes)).toLowerCase() === "true",
    prompt,
    chatText: firstString(parameterValue(params.chatText), prompt),
    characterName: firstString(parameterValue(params.characterName), parameterValue(params.character_name), options.characterName),
    profileId: firstString(parameterValue(params.profileId), parameterValue(params.profile_id), options.profileId),
    visualIdentity: firstString(parameterValue(params.visualIdentity), parameterValue(params.visual_identity), options.visualIdentity),
    sourceImageUrl: firstString(parameterValue(params.sourceImageUrl), parameterValue(params.source_image_url)),
    userReferenceImageUrl: firstString(parameterValue(params.userReferenceImageUrl), parameterValue(params.user_reference_image_url)),
    userConsent: firstString(parameterValue(params.userConsent), parameterValue(params.user_consent)),
    userDescription: firstString(parameterValue(params.userDescription), parameterValue(params.user_description)),
    outfit: firstString(parameterValue(params.outfit)),
    theme: firstString(parameterValue(params.theme)),
    matureContent: parameterValue(params.matureContent) === true || String(parameterValue(params.mature_content)).toLowerCase() === "true",
  };
}

export async function runRemixCameraDialogflowCxWebhook(requestBody = {}, options = {}) {
  const input = dialogflowCxInputFromRequest(requestBody, options);
  const result = automationToolResultForChat(await runAutomationBridgeTool(input, options));
  const imageUrl = result.imageUrls[0] || result.payload?.results?.[0]?.productionImageUrl || "";
  const messages = [
    {
      text: {
        text: [result.text],
      },
    },
  ];
  if (imageUrl) {
    messages.push({
      payload: {
        remixCamera: {
          imageUrl,
          imageUrls: result.imageUrls,
          command: result.command,
          action: result.action,
          dryRun: result.dryRun,
        },
      },
    });
  }

  return {
    fulfillment_response: {
      messages,
    },
    session_info: {
      parameters: {
        remix_command: result.command,
        remix_action: result.action,
        remix_dry_run: result.dryRun,
        remix_text: result.text,
        remix_prompt_preview: result.payload?.prompt || "",
        remix_image_url: imageUrl,
      },
    },
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
