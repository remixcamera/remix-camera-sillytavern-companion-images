#!/usr/bin/env node

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { COMPANION_COMMANDS } from "../lib/companion-tools.mjs";
import { runDiscordRemixInteraction } from "../adapters/discord/remix-discord-tool.mjs";
import { parseTelegramCommand, runTelegramRemixCommand } from "../adapters/telegram/remix-telegram-tool.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const packageRoot = path.resolve(__dirname, "..");
const args = new Map(
  process.argv
    .slice(2)
    .filter((arg) => arg.startsWith("--") && arg.includes("="))
    .map((arg) => {
      const [key, ...rest] = arg.split("=");
      return [key, rest.join("=")];
    }),
);
const bridgeUrl = String(args.get("--bridge-url") || process.env.REMIX_BRIDGE_URL || "").replace(/\/+$/, "");
const outputDir = path.resolve(args.get("--output-dir") || path.join(packageRoot, "tmp", "adapter-demo-verification"));

const targets = [
  {
    id: "sillytavern",
    title: "SillyTavern",
    adapterFiles: ["extension/remix-camera-companion-images/index.js", "extension/remix-camera-companion-images/manifest.json"],
    demoFile: "demos/sillytavern/demo.md",
    setupCommand: "--target=sillytavern",
    markers: ["Health Check", "Preview Prompt", "real image messages"],
  },
  {
    id: "risu",
    title: "RisuAI",
    adapterFiles: ["adapters/risu/remix-camera-companion-images.risu.js"],
    demoFile: "demos/risu/demo.md",
    setupCommand: "--target=risu",
    markers: ["registerMCP", "plugin:remix-camera-companion-images", "yes=true"],
  },
  {
    id: "openwebui",
    title: "Open WebUI",
    adapterFiles: ["adapters/openwebui/remix_camera_companion_images.py"],
    demoFile: "demos/openwebui/demo.md",
    setupCommand: "--target=openwebui",
    markers: ["class Tools", "yes=True", "BRIDGE_URL"],
  },
  {
    id: "librechat",
    title: "LibreChat",
    adapterFiles: ["adapters/librechat/README.md"],
    demoFile: "demos/librechat/demo.md",
    setupCommand: "--target=librechat",
    markers: ["/librechat/openapi.json", "yes=true", "dry-run"],
  },
  {
    id: "lobechat",
    title: "LobeChat",
    adapterFiles: ["adapters/lobe/README.md"],
    demoFile: "demos/lobechat/demo.md",
    setupCommand: "--target=lobechat",
    markers: ["/lobe/manifest.json", "yes=true"],
  },
  {
    id: "agnai",
    title: "Agnai",
    adapterFiles: ["adapters/agnai/remix-camera-agnai.user.js"],
    demoFile: "demos/agnai/demo.md",
    setupCommand: "--target=agnai",
    markers: ["@match        https://agnai.chat/*", "Selfie preview", "yes"],
  },
  {
    id: "telegram",
    title: "Telegram",
    adapterFiles: ["adapters/telegram/remix-telegram-tool.mjs", "adapters/telegram/lily-bot.mjs"],
    demoFile: "demos/telegram/demo.md",
    setupCommand: "--target=telegram",
    markers: ["createRemixTelegramTool", "LILY_PROFILE_ID", "uploads local bridge images"],
  },
  {
    id: "discord",
    title: "Discord",
    adapterFiles: ["adapters/discord/remix-discord-tool.mjs", "adapters/discord/lily-interactions-server.mjs"],
    demoFile: "demos/discord/demo.md",
    setupCommand: "--target=discord",
    markers: ["verifyDiscordSignature", "sendDiscordWebhookResult", "yes:true"],
  },
];

const commandInputs = {
  "send-selfie": {
    characterName: "Lily",
    mood: "cozy couch with lamp light",
    location: "cozy couch with lamp light",
    visualIdentity: "clearly adult companion, realistic phone-camera presence, consistent Lily profile",
  },
  "auto-selfie-from-chat": {
    characterName: "Lily",
    chatText: "User: show me the couch setup tonight. Lily: Fine, but the lamp is doing half the work.",
    visualIdentity: "clearly adult companion, realistic phone-camera presence, consistent Lily profile",
  },
  "outfit-try-on": {
    characterName: "Lily",
    sourceImageUrl: "https://remix.camera/examples/ai-companion-image-toolset/outfit-try-on-input.jpg",
    outfit: "red sundress and white sneakers",
    visualIdentity: "clearly adult companion, realistic phone-camera presence, consistent Lily profile",
  },
  "couple-photo": {
    characterName: "Lily",
    userConsent: "yes",
    userDescription: "consenting adult man, casual black t-shirt",
    location: "coffee shop booth",
    visualIdentity: "clearly adult companion, realistic phone-camera presence, consistent Lily profile",
  },
  "couples-vacation": {
    characterName: "Lily",
    userConsent: "yes",
    userDescription: "consenting adult man, casual travel outfit",
    theme: "Amalfi coast weekend",
    maxGenerations: 3,
    visualIdentity: "clearly adult companion, realistic phone-camera presence, consistent Lily profile",
  },
  "date-night": {
    characterName: "Lily",
    location: "quiet restaurant booth",
    mood: "warm date-night",
    visualIdentity: "clearly adult companion, realistic phone-camera presence, consistent Lily profile",
  },
  "daily-life-snap": {
    characterName: "Lily",
    chatText: "morning coffee on the couch",
    location: "morning coffee on the couch",
    visualIdentity: "clearly adult companion, realistic phone-camera presence, consistent Lily profile",
  },
  "private-snap": {
    characterName: "Lily",
    matureContent: true,
    location: "warm bedroom mirror snap",
    snapTtlSeconds: 120,
    visualIdentity: "clearly adult companion, realistic phone-camera presence, consistent Lily profile",
  },
};

function rel(filePath) {
  return path.relative(packageRoot, filePath);
}

async function fileExists(filePath) {
  try {
    const info = await stat(filePath);
    return info.isFile();
  } catch {
    return false;
  }
}

async function readRelative(relativePath) {
  return readFile(path.join(packageRoot, relativePath), "utf8");
}

function okCheck(name, ok, details = {}) {
  return {
    name,
    ok: Boolean(ok),
    ...details,
  };
}

async function verifyStaticTarget(target) {
  const checks = [];
  for (const adapterFile of target.adapterFiles) {
    const absolutePath = path.join(packageRoot, adapterFile);
    checks.push(okCheck(`adapter exists: ${adapterFile}`, await fileExists(absolutePath), { path: adapterFile }));
  }

  const demoPath = path.join(packageRoot, target.demoFile);
  const hasDemo = await fileExists(demoPath);
  checks.push(okCheck(`demo runbook exists: ${target.demoFile}`, hasDemo, { path: target.demoFile }));
  if (hasDemo) {
    const demoText = await readFile(demoPath, "utf8");
    checks.push(okCheck("demo includes setup target", demoText.includes(target.setupCommand), { expected: target.setupCommand }));
  }

  const allTextParts = [];
  for (const file of [...target.adapterFiles, target.demoFile]) {
    if (await fileExists(path.join(packageRoot, file))) {
      allTextParts.push(await readRelative(file));
    }
  }
  const allText = allTextParts.join("\n\n");
  for (const marker of target.markers) {
    checks.push(okCheck(`marker present: ${marker}`, allText.includes(marker), { marker }));
  }

  return checks;
}

async function requestBridge(pathname, options = {}) {
  if (!bridgeUrl) {
    return null;
  }
  const response = await fetch(`${bridgeUrl}${pathname}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...options.headers,
    },
  });
  const payload = await response.json().catch(() => ({}));
  return {
    ok: response.ok && payload?.ok !== false,
    status: response.status,
    payload,
  };
}

async function verifyBridgeContracts() {
  if (!bridgeUrl) {
    return [
      okCheck("bridge dry-run previews", false, {
        skipped: true,
        reason: "Set REMIX_BRIDGE_URL or pass --bridge-url=http://127.0.0.1:8787 to run real dry-run previews.",
      }),
    ];
  }

  const checks = [];
  const health = await requestBridge("/health");
  checks.push(okCheck("bridge health", health?.ok, { status: health?.status, authMode: health?.payload?.authMode }));

  const openApi = await requestBridge("/openapi.json");
  checks.push(
    okCheck("OpenAPI exposes all generate endpoints", COMPANION_COMMANDS.every((command) => openApi?.payload?.paths?.[`/v1/tools/${command.name}/generate`]), {
      status: openApi?.status,
    }),
  );

  const lobe = await requestBridge("/lobe/manifest.json");
  checks.push(okCheck("Lobe manifest exposes all tools", Array.isArray(lobe?.payload?.api) && lobe.payload.api.length === COMPANION_COMMANDS.length, { status: lobe?.status }));

  for (const command of COMPANION_COMMANDS) {
    const preview = await requestBridge(`/v1/tools/${command.name}/dry-run`, {
      method: "POST",
      body: JSON.stringify(commandInputs[command.name]),
    });
    checks.push(
      okCheck(`bridge dry-run: ${command.name}`, preview?.ok && preview?.payload?.dryRun === true && typeof preview?.payload?.prompt === "string", {
        status: preview?.status,
        promptTemplate: preview?.payload?.promptTemplate?.packTitle || preview?.payload?.promptTemplate?.packId || null,
      }),
    );
  }

  return checks;
}

async function verifyHostAdapterDryRuns() {
  const checks = [];
  if (!bridgeUrl) {
    checks.push(
      okCheck("Telegram adapter real dry-run", false, {
        skipped: true,
        reason: "No bridge URL provided.",
      }),
    );
    checks.push(
      okCheck("Discord adapter real dry-run", false, {
        skipped: true,
        reason: "No bridge URL provided.",
      }),
    );
    return checks;
  }

  const telegram = await runTelegramRemixCommand(parseTelegramCommand("/preview selfie cozy couch with lamp light"), {
    bridgeUrl,
    profileId: process.env.REMIX_PROFILE_ID || "",
    characterName: "Lily",
  });
  checks.push(
    okCheck("Telegram adapter real dry-run", telegram?.payload?.dryRun === true && /Preview ready/i.test(telegram.text), {
      command: telegram?.command,
    }),
  );

  const discord = await runDiscordRemixInteraction(
    {
      data: {
        name: "preview",
        options: [
          { name: "tool", value: "send-selfie" },
          { name: "prompt", value: "cozy couch with lamp light" },
        ],
      },
    },
    {
      bridgeUrl,
      profileId: process.env.REMIX_PROFILE_ID || "",
      characterName: "Lily",
    },
  );
  checks.push(
    okCheck("Discord adapter real dry-run", discord?.payload?.dryRun === true && /Preview ready/i.test(discord.text), {
      command: discord?.command,
    }),
  );

  return checks;
}

function renderMarkdownReport(evidence) {
  const detailText = (check) => {
    const details = [];
    if (check.status) details.push(`status ${check.status}`);
    if (check.authMode) details.push(`auth ${check.authMode}`);
    if (check.promptTemplate) details.push(`template: ${check.promptTemplate}`);
    if (check.command) details.push(`command: ${check.command}`);
    return details.length ? ` (${details.join("; ")})` : "";
  };
  const lines = [
    "# Remix.Camera Adapter Demo Verification",
    "",
    `Generated at: ${evidence.generatedAt}`,
    `Mode: ${evidence.mode}`,
    `Bridge URL: ${evidence.bridgeUrl || "not provided"}`,
    "",
    "## Targets",
    "",
  ];
  for (const target of evidence.targets) {
    lines.push(`### ${target.title}`);
    for (const check of target.checks) {
      const marker = check.ok ? "[x]" : check.skipped ? "[ ]" : "[!]";
      const suffix = check.reason ? ` - ${check.reason}` : "";
      lines.push(`- ${marker} ${check.name}${detailText(check)}${suffix}`);
    }
    lines.push("");
  }
  lines.push("## Bridge Contracts", "");
  for (const check of evidence.bridgeChecks) {
    const marker = check.ok ? "[x]" : check.skipped ? "[ ]" : "[!]";
    const suffix = check.reason ? ` - ${check.reason}` : "";
    lines.push(`- ${marker} ${check.name}${detailText(check)}${suffix}`);
  }
  lines.push("", "## Host Adapter Dry-Runs", "");
  for (const check of evidence.hostAdapterChecks) {
    const marker = check.ok ? "[x]" : check.skipped ? "[ ]" : "[!]";
    const suffix = check.reason ? ` - ${check.reason}` : "";
    lines.push(`- ${marker} ${check.name}${detailText(check)}${suffix}`);
  }
  lines.push("");
  return lines.join("\n");
}

function renderHtmlReport(evidence) {
  const esc = (value) =>
    String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  const detailHtml = (check) => {
    const details = [];
    if (check.status) details.push(`status ${check.status}`);
    if (check.authMode) details.push(`auth ${check.authMode}`);
    if (check.promptTemplate) details.push(`template: ${check.promptTemplate}`);
    if (check.command) details.push(`command: ${check.command}`);
    if (check.reason) details.push(check.reason);
    return details.length ? ` <small>${esc(details.join("; "))}</small>` : "";
  };
  const targetCards = evidence.targets
    .map(
      (target) => `
        <section>
          <h2>${esc(target.title)}</h2>
          <ul>${target.checks
            .map((check) => `<li class="${check.ok ? "ok" : check.skipped ? "skip" : "fail"}">${check.ok ? "OK" : check.skipped ? "SKIP" : "FAIL"} ${esc(check.name)}${detailHtml(check)}</li>`)
            .join("")}</ul>
        </section>`,
    )
    .join("");
  const bridgeItems = [...evidence.bridgeChecks, ...evidence.hostAdapterChecks]
    .map((check) => `<li class="${check.ok ? "ok" : check.skipped ? "skip" : "fail"}">${check.ok ? "OK" : check.skipped ? "SKIP" : "FAIL"} ${esc(check.name)}${detailHtml(check)}</li>`)
    .join("");
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Remix.Camera Adapter Demo Verification</title>
  <style>
    body { margin: 0; font-family: Inter, ui-sans-serif, system-ui, sans-serif; background: #171717; color: #f7f7f8; }
    main { max-width: 1120px; margin: 0 auto; padding: 32px 20px; }
    h1 { margin: 0 0 8px; font-size: 32px; }
    p { color: #b8b8b8; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; margin-top: 24px; }
    section { border: 1px solid #333; background: #222; border-radius: 8px; padding: 16px; }
    h2 { margin: 0 0 12px; font-size: 18px; }
    ul { padding-left: 0; list-style: none; margin: 0; display: grid; gap: 8px; }
    li { border-left: 4px solid #666; padding-left: 10px; color: #ddd; }
    li.ok { border-color: #d1fe17; }
    li.skip { border-color: #888; color: #aaa; }
    li.fail { border-color: #ff6b6b; color: #ffd4d4; }
    small { display: block; color: #999; margin-top: 2px; }
  </style>
</head>
<body>
  <main>
    <h1>Remix.Camera Adapter Demo Verification</h1>
    <p>Generated at ${esc(evidence.generatedAt)}. Mode: ${esc(evidence.mode)}. Bridge: ${esc(evidence.bridgeUrl || "not provided")}.</p>
    <div class="grid">${targetCards}</div>
    <section style="margin-top:14px">
      <h2>Bridge and Host Adapter Checks</h2>
      <ul>${bridgeItems}</ul>
    </section>
  </main>
</body>
</html>`;
}

const evidence = {
  ok: false,
  generatedAt: new Date().toISOString(),
  mode: bridgeUrl ? "bridge-dry-run" : "static-adapter-demo-preflight",
  bridgeUrl: bridgeUrl || null,
  targets: [],
  bridgeChecks: [],
  hostAdapterChecks: [],
  outputs: {},
};

for (const target of targets) {
  evidence.targets.push({
    id: target.id,
    title: target.title,
    checks: await verifyStaticTarget(target),
  });
}
evidence.bridgeChecks = await verifyBridgeContracts();
evidence.hostAdapterChecks = await verifyHostAdapterDryRuns();

const allChecks = [
  ...evidence.targets.flatMap((target) => target.checks),
  ...evidence.bridgeChecks.filter((check) => !check.skipped),
  ...evidence.hostAdapterChecks.filter((check) => !check.skipped),
];
evidence.ok = allChecks.every((check) => check.ok);

await mkdir(outputDir, { recursive: true });
const jsonPath = path.join(outputDir, "adapter-demo-evidence.json");
const markdownPath = path.join(outputDir, "adapter-demo-evidence.md");
const htmlPath = path.join(outputDir, "adapter-demo-evidence.html");
await writeFile(jsonPath, `${JSON.stringify(evidence, null, 2)}\n`);
await writeFile(markdownPath, renderMarkdownReport(evidence));
await writeFile(htmlPath, renderHtmlReport(evidence));
evidence.outputs = {
  jsonPath: rel(jsonPath),
  markdownPath: rel(markdownPath),
  htmlPath: rel(htmlPath),
};
await writeFile(jsonPath, `${JSON.stringify(evidence, null, 2)}\n`);

console.log(JSON.stringify(evidence, null, 2));
if (!evidence.ok) {
  process.exitCode = 1;
}
