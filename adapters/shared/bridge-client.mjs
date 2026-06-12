import { COMPANION_COMMAND_NAMES, commandDefinition } from "../../lib/companion-tools.mjs";

export const DEFAULT_BRIDGE_URL = "http://127.0.0.1:8787";

export function normalizeBridgeUrl(value = DEFAULT_BRIDGE_URL) {
  return String(value || DEFAULT_BRIDGE_URL).replace(/\/+$/, "");
}

export function assertKnownCommand(command) {
  if (!COMPANION_COMMAND_NAMES.includes(command)) {
    throw new Error(`Unknown Remix.Camera companion command: ${command}`);
  }
  return command;
}

export async function callBridgeCommand({
  bridgeUrl = DEFAULT_BRIDGE_URL,
  command,
  action = "dry-run",
  input = {},
  fetchImpl = globalThis.fetch,
}) {
  assertKnownCommand(command);
  if (!["dry-run", "generate"].includes(action)) {
    throw new Error(`Unsupported bridge action: ${action}`);
  }
  if (typeof fetchImpl !== "function") {
    throw new Error("A fetch implementation is required.");
  }

  const response = await fetchImpl(`${normalizeBridgeUrl(bridgeUrl)}/v1/tools/${command}/${action}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(input || {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.ok === false) {
    const message = payload?.error || payload?.message || `Bridge request failed with ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

export function imageUrlsFromBridgePayload(payload) {
  const results = Array.isArray(payload?.results) ? payload.results : [];
  return results
    .map((result) => result?.imageUrl || result?.productionImageUrl)
    .filter((url) => typeof url === "string" && /^https?:\/\//i.test(url));
}

export function summarizeBridgePayload(payload) {
  if (payload?.dryRun) {
    const template = payload.promptTemplate?.packTitle || payload.promptTemplate?.packId || "Remix.Camera template";
    return `Preview ready: ${template}\n\n${payload.prompt || ""}`.trim();
  }
  if (payload?.markdown) {
    return payload.markdown;
  }
  const urls = imageUrlsFromBridgePayload(payload);
  if (urls.length) {
    return urls.join("\n");
  }
  return payload?.ok ? "Remix.Camera image request completed." : "Remix.Camera image request did not complete.";
}

export function defaultInputForHost(input = {}) {
  return Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined && value !== null && value !== ""),
  );
}

export function commandHelpLines() {
  return COMPANION_COMMAND_NAMES.map((name) => {
    const definition = commandDefinition(name);
    return `${name}: ${definition?.description || "Remix.Camera companion image tool"}`;
  });
}

