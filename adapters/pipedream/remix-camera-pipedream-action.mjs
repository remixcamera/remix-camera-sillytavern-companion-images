import { automationToolResultForChat, runAutomationBridgeTool } from "../shared/automation-tool-runner.mjs";
import { COMPANION_COMMAND_NAMES } from "../../lib/companion-tools.mjs";

export async function runRemixCameraPipedreamAction(input = {}, options = {}) {
  return automationToolResultForChat(await runAutomationBridgeTool(input, options));
}

export default {
  key: "remix_camera_companion_image",
  name: "Remix.Camera Companion Image",
  description: "Preview or generate companion images through a local Remix.Camera bridge.",
  version: "0.0.1",
  type: "action",
  props: {
    bridgeUrl: {
      type: "string",
      label: "Bridge URL",
      default: "http://127.0.0.1:8787",
    },
    command: {
      type: "string",
      label: "Command",
      options: COMPANION_COMMAND_NAMES,
      default: "send-selfie",
    },
    prompt: {
      type: "string",
      label: "Prompt or chat context",
      optional: true,
    },
    characterName: {
      type: "string",
      label: "Character Name",
      optional: true,
      default: "Lily",
    },
    profileId: {
      type: "string",
      label: "Remix.Camera Profile ID",
      optional: true,
    },
    sourceImageUrl: {
      type: "string",
      label: "Source Image URL",
      optional: true,
    },
    userReferenceImageUrl: {
      type: "string",
      label: "User Reference Image URL",
      optional: true,
    },
    userConsent: {
      type: "string",
      label: "User Consent",
      optional: true,
    },
    matureContent: {
      type: "boolean",
      label: "Mature Content",
      optional: true,
      default: false,
    },
    action: {
      type: "string",
      label: "Action",
      options: ["dry-run", "generate"],
      default: "dry-run",
    },
    yes: {
      type: "boolean",
      label: "Confirm Generation",
      optional: true,
      default: false,
    },
  },
  async run({ $ } = {}) {
    const result = await runRemixCameraPipedreamAction({
      bridgeUrl: this.bridgeUrl,
      command: this.command,
      prompt: this.prompt,
      characterName: this.characterName,
      profileId: this.profileId,
      sourceImageUrl: this.sourceImageUrl,
      userReferenceImageUrl: this.userReferenceImageUrl,
      userConsent: this.userConsent,
      matureContent: this.matureContent,
      action: this.action,
      yes: this.yes,
    }, {
      fetchImpl: this.fetchImpl,
    });
    if ($ && typeof $.export === "function") {
      $.export("$summary", result.text);
    }
    return result;
  },
};
