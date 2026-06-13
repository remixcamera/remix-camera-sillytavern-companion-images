import {
  createFrameworkInputSchema,
  executeFrameworkBridgeTool,
  frameworkToolName,
  selectedFrameworkCommands,
} from "../shared/framework-tool-runner.mjs";

function requireToolFactory(toolFactory) {
  if (typeof toolFactory !== "function") {
    throw new Error("Pass the AI SDK tool helper as createRemixCameraAiSdkTools({ tool, ... }).");
  }
  return toolFactory;
}

function toolDescription(command, action) {
  if (action === "generate") {
    return `${command.description} Generates a real Remix.Camera image only when yes=true is provided after explicit user confirmation.`;
  }
  return `${command.description} Previews the selected Remix.Camera prompt/template without spending credits; use this before generation.`;
}

function createAiSdkTool(command, action, options) {
  const toolFactory = requireToolFactory(options.tool || options.toolFactory);
  return toolFactory({
    description: toolDescription(command, action),
    inputSchema: createFrameworkInputSchema({
      z: options.z,
      commandName: command.name,
      action,
    }),
    execute: async (input = {}, executionOptions = {}) => {
      const context = executionOptions?.context?.remixCamera || executionOptions?.experimental_context?.remixCamera || {};
      const result = await executeFrameworkBridgeTool({
        bridgeUrl: context.bridgeUrl || options.bridgeUrl,
        profileId: context.profileId || options.profileId,
        characterName: context.characterName || options.characterName,
        visualIdentity: context.visualIdentity || options.visualIdentity,
        fetchImpl: context.fetchImpl || options.fetchImpl,
        command: command.name,
        action,
        input,
      });
      return options.returnText === true ? result.text : result;
    },
  });
}

export function createRemixCameraAiSdkTools(options = {}) {
  const commands = selectedFrameworkCommands(options.commands);
  const tools = {};
  if (options.includePreviewTools !== false) {
    for (const command of commands) {
      tools[frameworkToolName(command.name, "dry-run")] = createAiSdkTool(command, "dry-run", options);
    }
  }
  if (options.includeGenerateTools !== false) {
    for (const command of commands) {
      tools[frameworkToolName(command.name, "generate")] = createAiSdkTool(command, "generate", options);
    }
  }
  return tools;
}

export { frameworkToolName as remixCameraAiSdkToolName };
