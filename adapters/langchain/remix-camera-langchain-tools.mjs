import {
  createFrameworkInputSchema,
  executeFrameworkBridgeTool,
  frameworkToolName,
  selectedFrameworkCommands,
} from "../shared/framework-tool-runner.mjs";

function requireToolFactory(toolFactory) {
  if (typeof toolFactory !== "function") {
    throw new Error("Pass LangChain's tool function as createRemixCameraLangChainTools({ tool, ... }).");
  }
  return toolFactory;
}

function toolDescription(command, action) {
  if (action === "generate") {
    return `${command.description} Generates a real Remix.Camera image only when yes=true is provided after explicit user confirmation.`;
  }
  return `${command.description} Previews the selected Remix.Camera prompt/template without spending credits; use this before generation.`;
}

function createLangChainTool(command, action, options) {
  const toolFactory = requireToolFactory(options.tool || options.toolFactory);
  const name = frameworkToolName(command.name, action);
  return toolFactory(
    async (input = {}, config = {}) => {
      const context = config?.context?.remixCamera || config?.configurable?.remixCamera || {};
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
      return options.returnStructured === true ? result : result.text;
    },
    {
      name,
      description: toolDescription(command, action),
      schema: createFrameworkInputSchema({
        z: options.z,
        commandName: command.name,
        action,
      }),
      returnDirect: options.returnDirect ?? true,
    },
  );
}

export function createRemixCameraLangChainTools(options = {}) {
  const commands = selectedFrameworkCommands(options.commands);
  const tools = [];
  if (options.includePreviewTools !== false) {
    for (const command of commands) {
      tools.push(createLangChainTool(command, "dry-run", options));
    }
  }
  if (options.includeGenerateTools !== false) {
    for (const command of commands) {
      tools.push(createLangChainTool(command, "generate", options));
    }
  }
  return tools;
}

export { frameworkToolName as remixCameraLangChainToolName };
