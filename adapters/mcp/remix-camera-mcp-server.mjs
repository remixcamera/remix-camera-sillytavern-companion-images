#!/usr/bin/env node

import readline from "node:readline";
import { pathToFileURL } from "node:url";
import {
  callBridgeCommand,
  imageUrlsFromBridgePayload,
  summarizeBridgePayload,
} from "../shared/bridge-client.mjs";
import {
  COMPANION_COMMANDS,
  createCommandInputSchema,
} from "../../lib/companion-tools.mjs";

export const MCP_PROTOCOL_VERSION = "2025-11-25";
export const MCP_SERVER_INFO = {
  name: "remix-camera-companion-images",
  version: "0.4.0",
};

const JSON_RPC_VERSION = "2.0";

function parseCliArgs(argv = process.argv.slice(2)) {
  const values = new Map();
  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const [key, ...rest] = arg.split("=");
    values.set(key, rest.length > 0 ? rest.join("=") : "true");
  }
  return values;
}

export function normalizeMcpToolName(commandName, action) {
  const suffix = action === "generate" ? "generate" : "preview";
  return `remix_camera_${commandName.replace(/-/g, "_")}_${suffix}`;
}

function mcpTitle(command, action) {
  return action === "generate"
    ? `${command.title} - Generate`
    : `${command.title} - Preview`;
}

function mcpDescription(command, action) {
  if (action === "generate") {
    return `${command.description} This spends Remix.Camera credits and requires yes=true from the user.`;
  }
  return `${command.description} This is a no-spend dry-run preview that selects the Remix.Camera prompt template.`;
}

export function createMcpToolDefinitions() {
  return COMPANION_COMMANDS.flatMap((command) => [
    {
      name: normalizeMcpToolName(command.name, "dry-run"),
      title: mcpTitle(command, "dry-run"),
      description: mcpDescription(command, "dry-run"),
      inputSchema: createCommandInputSchema(command.name, {
        includeSpendGuard: false,
      }),
      _remix: {
        command: command.name,
        action: "dry-run",
      },
    },
    {
      name: normalizeMcpToolName(command.name, "generate"),
      title: mcpTitle(command, "generate"),
      description: mcpDescription(command, "generate"),
      inputSchema: createCommandInputSchema(command.name, {
        includeSpendGuard: true,
        requireSpendGuard: true,
      }),
      _remix: {
        command: command.name,
        action: "generate",
      },
    },
  ]);
}

export function publicMcpTools() {
  return createMcpToolDefinitions().map(({ _remix, ...tool }) => tool);
}

function toolByName(name) {
  return createMcpToolDefinitions().find((tool) => tool.name === name) || null;
}

function resultResponse(id, result) {
  return {
    jsonrpc: JSON_RPC_VERSION,
    id,
    result,
  };
}

function errorResponse(id, code, message, data = undefined) {
  return {
    jsonrpc: JSON_RPC_VERSION,
    ...(id !== undefined ? { id } : {}),
    error: {
      code,
      message,
      ...(data !== undefined ? { data } : {}),
    },
  };
}

function toolExecutionError(id, message, structuredContent = {}) {
  return resultResponse(id, {
    content: [
      {
        type: "text",
        text: message,
      },
    ],
    structuredContent,
    isError: true,
  });
}

function contentFromBridgePayload(payload) {
  const text = summarizeBridgePayload(payload);
  const imageUrls = imageUrlsFromBridgePayload(payload);
  return [
    {
      type: "text",
      text,
    },
    ...imageUrls.map((url, index) => ({
      type: "resource_link",
      uri: url,
      name: `Remix.Camera generated image ${index + 1}`,
      description: "Generated companion image URL returned by Remix.Camera.",
      mimeType: "image/png",
    })),
  ];
}

export async function callMcpTool({
  name,
  arguments: toolArguments = {},
  bridgeUrl = process.env.REMIX_BRIDGE_URL || "http://127.0.0.1:8787",
  profileId = process.env.REMIX_PROFILE_ID || "",
  characterName = process.env.REMIX_CHARACTER_NAME || "Lily",
  fetchImpl = globalThis.fetch,
} = {}) {
  const tool = toolByName(name);
  if (!tool) {
    throw new Error(`Unknown MCP tool: ${name}`);
  }
  const { command, action } = tool._remix;
  const input = {
    characterName,
    profileId,
    ...toolArguments,
  };
  if (action === "generate" && input.yes !== true) {
    return {
      content: [
        {
          type: "text",
          text: "Generation blocked. Re-run with yes=true only after the user explicitly confirms spending Remix.Camera credits.",
        },
      ],
      structuredContent: {
        toolName: name,
        command,
        action,
        blocked: true,
        reason: "missing-explicit-yes",
      },
      isError: true,
    };
  }

  const payload = await callBridgeCommand({
    bridgeUrl,
    command,
    action,
    input,
    fetchImpl,
  });
  return {
    content: contentFromBridgePayload(payload),
    structuredContent: {
      toolName: name,
      command,
      action,
      imageUrls: imageUrlsFromBridgePayload(payload),
      payload,
    },
    isError: false,
  };
}

export async function handleMcpRequest(message, options = {}) {
  if (!message || typeof message !== "object") {
    return errorResponse(undefined, -32600, "Invalid JSON-RPC request.");
  }
  const id = message.id;
  const isNotification = id === undefined;

  try {
    switch (message.method) {
      case "initialize":
        return resultResponse(id, {
          protocolVersion: message.params?.protocolVersion || MCP_PROTOCOL_VERSION,
          capabilities: {
            tools: {
              listChanged: false,
            },
          },
          serverInfo: MCP_SERVER_INFO,
        });
      case "notifications/initialized":
        return null;
      case "ping":
        return isNotification ? null : resultResponse(id, {});
      case "tools/list":
        return resultResponse(id, {
          tools: publicMcpTools(),
        });
      case "tools/call": {
        const toolName = message.params?.name;
        if (!toolByName(toolName)) {
          return errorResponse(id, -32602, `Unknown tool: ${toolName || ""}`.trim());
        }
        const result = await callMcpTool({
          name: toolName,
          arguments: message.params?.arguments || {},
          ...options,
        });
        return resultResponse(id, result);
      }
      default:
        return isNotification ? null : errorResponse(id, -32601, `Method not found: ${message.method || ""}`.trim());
    }
  } catch (error) {
    return toolExecutionError(id, error instanceof Error ? error.message : String(error), {
      method: message.method,
      failed: true,
    });
  }
}

export async function handleMcpJsonLine(line, options = {}) {
  let message;
  try {
    message = JSON.parse(line);
  } catch (error) {
    return errorResponse(undefined, -32700, "Parse error.", error instanceof Error ? error.message : String(error));
  }
  return handleMcpRequest(message, options);
}

export function startStdioMcpServer(options = {}) {
  const rl = readline.createInterface({
    input: process.stdin,
    crlfDelay: Infinity,
  });
  rl.on("line", async (line) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    const response = await handleMcpJsonLine(trimmed, options);
    if (response) {
      process.stdout.write(`${JSON.stringify(response)}\n`);
    }
  });
  return rl;
}

const cliArgs = parseCliArgs();
if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  startStdioMcpServer({
    bridgeUrl: cliArgs.get("--bridge-url") || process.env.REMIX_BRIDGE_URL || "http://127.0.0.1:8787",
    profileId: cliArgs.get("--profile-id") || process.env.REMIX_PROFILE_ID || "",
    characterName: cliArgs.get("--character-name") || process.env.REMIX_CHARACTER_NAME || "Lily",
  });
}
