import { automationToolResultForChat, runAutomationBridgeTool } from "../shared/automation-tool-runner.mjs";

export async function runRemixCameraMakeTool(input = {}, options = {}) {
  return automationToolResultForChat(await runAutomationBridgeTool(input, options));
}

