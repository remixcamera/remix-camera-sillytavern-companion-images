import { randomUUID } from "node:crypto";

const TELEMETRY_PATH = "/api/integrations/sillytavern/telemetry";
const INSTALLATION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ALLOWED_EVENTS = new Set([
  "sillytavern_install_started",
  "sillytavern_pairing_started",
  "sillytavern_pairing_completed",
  "sillytavern_setup_completed",
  "sillytavern_bridge_started",
  "sillytavern_first_image_completed",
]);

function trimTrailingSlash(value) {
  return String(value || "").replace(/\/+$/, "");
}

export function normalizeInstallSource(value, fallback = "github_unspecified") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "_")
    .slice(0, 80);
  return normalized || fallback;
}

export function validInstallationId(value) {
  return INSTALLATION_ID_PATTERN.test(String(value || "").trim());
}

export function createInstallationId(existingValue = "") {
  return validInstallationId(existingValue) ? String(existingValue).trim() : randomUUID();
}

export function telemetryEnabled({ disabled = false, env = process.env } = {}) {
  if (disabled) return false;
  const doNotTrack = String(env.DO_NOT_TRACK || "").trim().toLowerCase();
  const explicitlyDisabled = String(env.REMIX_TELEMETRY_DISABLED || "").trim().toLowerCase();
  return !["1", "true", "yes"].includes(doNotTrack) && !["1", "true", "yes"].includes(explicitlyDisabled);
}

export function createInstallTelemetryClient({
  apiBaseUrl,
  installationId,
  installSource,
  target,
  packageVersion,
  enabled = true,
  fetchImpl = globalThis.fetch,
}) {
  const normalizedId = validInstallationId(installationId) ? String(installationId).trim() : "";
  const normalizedSource = normalizeInstallSource(installSource);
  const normalizedTarget = normalizeInstallSource(target, "sillytavern").slice(0, 40);
  const normalizedVersion = normalizeInstallSource(packageVersion, "unknown").slice(0, 40);
  const isEnabled = Boolean(enabled && normalizedId && typeof fetchImpl === "function");

  return {
    enabled: isEnabled,
    installationId: normalizedId || null,
    installSource: normalizedSource,
    target: normalizedTarget,
    packageVersion: normalizedVersion,
    config: isEnabled
      ? {
          enabled: true,
          schemaVersion: "v1",
          installationId: normalizedId,
          installSource: normalizedSource,
          target: normalizedTarget,
          packageVersion: normalizedVersion,
        }
      : { enabled: false, schemaVersion: "v1" },
    async track(eventName) {
      if (!isEnabled || !ALLOWED_EVENTS.has(eventName)) return false;
      try {
        const response = await fetchImpl(`${trimTrailingSlash(apiBaseUrl)}${TELEMETRY_PATH}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            eventName,
            installationId: normalizedId,
            installSource: normalizedSource,
            target: normalizedTarget,
            packageVersion: normalizedVersion,
          }),
          signal: AbortSignal.timeout(2_500),
        });
        return response.ok;
      } catch (error) {
        if (process.env.REMIX_TELEMETRY_DEBUG === "1") {
          console.warn(`[Remix.Camera telemetry] ${eventName} was not recorded.`, error);
        }
        return false;
      }
    },
  };
}
