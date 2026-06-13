import { automationToolResultForChat, runAutomationBridgeTool } from "../shared/automation-tool-runner.mjs";

export async function runRemixCameraWatsonxAssistantTool(input = {}, options = {}) {
  return automationToolResultForChat(await runAutomationBridgeTool(input, options));
}
