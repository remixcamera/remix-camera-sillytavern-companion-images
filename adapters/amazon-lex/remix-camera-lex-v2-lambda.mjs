import { automationToolResultForChat, runAutomationBridgeTool } from "../shared/automation-tool-runner.mjs";

function truthy(value) {
  return value === true || ["true", "yes", "y", "1", "confirm"].includes(String(value || "").trim().toLowerCase());
}

function firstString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function slotValue(slot) {
  const value = slot?.value || slot;
  return firstString(value?.interpretedValue, value?.originalValue, value?.resolvedValues?.[0], typeof value === "string" ? value : "");
}

function commandFromLabel(label = "") {
  const normalized = String(label || "").toLowerCase().replace(/_/g, "-");
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

function actionFromLabel(label = "") {
  const normalized = String(label || "").toLowerCase();
  if (normalized.includes("generate")) return "generate";
  if (normalized.includes("preview") || normalized.includes("dry")) return "dry-run";
  return "";
}

export function lexInputFromEvent(event = {}, options = {}) {
  const slots = event.sessionState?.intent?.slots || {};
  const sessionAttributes = event.sessionState?.sessionAttributes || {};
  const requestAttributes = event.requestAttributes || {};
  const lookup = (name) => firstString(slotValue(slots[name]), sessionAttributes[name], requestAttributes[name]);
  const invocationLabel = firstString(event.invocationLabel, event.sessionState?.intent?.name);
  const command = lookup("remix_command") || lookup("command") || commandFromLabel(invocationLabel) || options.command || "send-selfie";
  const action = lookup("remix_action") || lookup("action") || actionFromLabel(invocationLabel) || options.action || "dry-run";
  const prompt = firstString(
    lookup("remix_prompt"),
    lookup("prompt"),
    lookup("mood"),
    lookup("location"),
    event.inputTranscript,
  );
  return {
    bridgeUrl: lookup("bridgeUrl") || options.bridgeUrl,
    command,
    action,
    yes: truthy(lookup("remix_yes") || lookup("yes")),
    prompt,
    chatText: firstString(lookup("chatText"), lookup("remix_chat_text"), prompt),
    characterName: firstString(lookup("characterName"), lookup("remix_character_name"), options.characterName),
    profileId: firstString(lookup("profileId"), lookup("remix_profile_id"), options.profileId),
    visualIdentity: firstString(lookup("visualIdentity"), lookup("remix_visual_identity"), options.visualIdentity),
    sourceImageUrl: firstString(lookup("sourceImageUrl"), lookup("remix_source_image_url")),
    userReferenceImageUrl: firstString(lookup("userReferenceImageUrl"), lookup("remix_user_reference_image_url")),
    userConsent: firstString(lookup("userConsent"), lookup("remix_user_consent")),
    userDescription: firstString(lookup("userDescription"), lookup("remix_user_description")),
    outfit: firstString(lookup("outfit"), lookup("remix_outfit")),
    theme: firstString(lookup("theme"), lookup("remix_theme")),
    matureContent: truthy(lookup("matureContent") || lookup("remix_mature_content")),
  };
}

export async function runRemixCameraLexV2Lambda(event = {}, options = {}) {
  const input = lexInputFromEvent(event, options);
  const result = automationToolResultForChat(await runAutomationBridgeTool(input, options));
  const imageUrl = result.imageUrls[0] || result.payload?.results?.[0]?.productionImageUrl || "";
  const intent = event.sessionState?.intent || { name: "RemixCameraCompanionImage" };
  const messages = [
    {
      contentType: "PlainText",
      content: result.text,
    },
  ];
  if (imageUrl) {
    messages.push({
      contentType: "ImageResponseCard",
      imageResponseCard: {
        title: "Remix.Camera image",
        subtitle: result.dryRun ? "Preview only" : "Generated image",
        imageUrl,
      },
    });
  }

  return {
    sessionState: {
      dialogAction: {
        type: "Close",
      },
      intent: {
        ...intent,
        state: "Fulfilled",
      },
      sessionAttributes: {
        ...(event.sessionState?.sessionAttributes || {}),
        remix_command: result.command,
        remix_action: result.action,
        remix_dry_run: String(result.dryRun),
        remix_text: result.text,
        remix_prompt_preview: result.payload?.prompt || "",
        remix_image_url: imageUrl,
      },
    },
    messages,
    requestAttributes: event.requestAttributes || {},
  };
}

export const handler = runRemixCameraLexV2Lambda;
