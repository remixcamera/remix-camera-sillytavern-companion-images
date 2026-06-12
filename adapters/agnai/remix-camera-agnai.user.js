// ==UserScript==
// @name         Remix.Camera Companion Images for Agnai
// @namespace    https://remix.camera/
// @version      0.4.0
// @description  Adds Remix.Camera companion image buttons to Agnai via the local Remix.Camera bridge.
// @author       Remix.Camera
// @match        https://agnai.chat/*
// @match        http://localhost:3001/*
// @match        http://127.0.0.1:3001/*
// @grant        GM_setClipboard
// ==/UserScript==

(function remixCameraAgnai() {
  const STORAGE_KEY = "remixCameraAgnaiSettings";
  const DEFAULTS = {
    bridgeUrl: "http://127.0.0.1:8787",
    characterName: "Lily",
    profileId: "",
    visualIdentity: "",
  };
  const COMMANDS = [
    ["Selfie", "send-selfie", false],
    ["Date", "date-night", false],
    ["Daily", "daily-life-snap", false],
    ["Couple", "couple-photo", true],
    ["Vacation", "couples-vacation", true],
    ["Private", "private-snap", true],
  ];

  function readSettings() {
    try {
      return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") };
    } catch {
      return { ...DEFAULTS };
    }
  }

  function writeSettings(settings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  function recentChatText() {
    return document.body.innerText.split("\n").filter(Boolean).slice(-40).join("\n").slice(-4000);
  }

  function visiblePrompt() {
    const selection = String(window.getSelection?.() || "").trim();
    if (selection) {
      return selection;
    }
    const input = document.querySelector("textarea:focus,input:focus");
    return input?.value || recentChatText();
  }

  async function callBridge(command, generate) {
    const settings = readSettings();
    const prompt = visiblePrompt();
    const body = {
      profileId: settings.profileId || undefined,
      characterName: settings.characterName || undefined,
      visualIdentity: settings.visualIdentity || undefined,
      chatText: prompt,
      mood: prompt,
      location: prompt,
      userConsent: ["couple-photo", "couples-vacation"].includes(command) ? "yes" : undefined,
      matureContent: command === "private-snap" ? true : undefined,
      maxGenerations: command === "couples-vacation" ? 3 : 1,
      snapTtlSeconds: command === "private-snap" ? 120 : undefined,
      yes: generate ? true : undefined,
    };
    const response = await fetch(`${settings.bridgeUrl.replace(/\/+$/, "")}/v1/tools/${command}/${generate ? "generate" : "dry-run"}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined && value !== ""))),
    });
    const payload = await response.json();
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || `Bridge request failed with ${response.status}`);
    }
    return payload;
  }

  function copyText(text) {
    if (typeof GM_setClipboard === "function") {
      GM_setClipboard(text);
      return;
    }
    navigator.clipboard?.writeText(text);
  }

  function insertIntoFocusedInput(text) {
    const input = document.querySelector("textarea:focus,input:focus");
    if (!input) {
      return false;
    }
    input.value = `${input.value || ""}${input.value ? "\n" : ""}${text}`;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    return true;
  }

  function showResult(text) {
    copyText(text);
    if (!insertIntoFocusedInput(text)) {
      alert(`Copied Remix.Camera result to clipboard:\n\n${text}`);
    }
  }

  async function run(command, generate) {
    try {
      const payload = await callBridge(command, generate);
      if (payload.markdown) {
        showResult(payload.markdown);
        return;
      }
      const template = payload.promptTemplate?.packTitle || payload.promptTemplate?.packId || "Remix.Camera template";
      showResult(`Preview ready: ${template}\n\n${payload.prompt || ""}`);
    } catch (error) {
      alert(`Remix.Camera failed: ${error.message}`);
    }
  }

  function openSettings() {
    const settings = readSettings();
    const bridgeUrl = prompt("Remix.Camera bridge URL", settings.bridgeUrl);
    if (bridgeUrl === null) return;
    const characterName = prompt("Character name", settings.characterName);
    if (characterName === null) return;
    const profileId = prompt("Remix.Camera profile ID", settings.profileId);
    if (profileId === null) return;
    const visualIdentity = prompt("Visual identity", settings.visualIdentity);
    if (visualIdentity === null) return;
    writeSettings({ bridgeUrl, characterName, profileId, visualIdentity });
  }

  function mount() {
    if (document.getElementById("remix-camera-agnai-panel")) {
      return;
    }
    const panel = document.createElement("div");
    panel.id = "remix-camera-agnai-panel";
    panel.style.cssText = [
      "position:fixed",
      "right:16px",
      "bottom:16px",
      "z-index:99999",
      "display:flex",
      "gap:6px",
      "flex-wrap:wrap",
      "max-width:360px",
      "padding:10px",
      "background:#171717",
      "border:1px solid #333",
      "border-radius:8px",
      "box-shadow:0 8px 30px rgba(0,0,0,.35)",
      "font-family:system-ui,sans-serif",
    ].join(";");
    for (const [label, command, sensitive] of COMMANDS) {
      const preview = document.createElement("button");
      preview.textContent = `${label} preview`;
      preview.style.cssText = buttonStyle("#222", "#f7f7f8");
      preview.addEventListener("click", () => run(command, false));
      panel.appendChild(preview);

      const generate = document.createElement("button");
      generate.textContent = sensitive ? `${label} yes` : label;
      generate.style.cssText = buttonStyle("#d1fe17", "#171717");
      generate.addEventListener("click", () => run(command, true));
      panel.appendChild(generate);
    }
    const settings = document.createElement("button");
    settings.textContent = "Settings";
    settings.style.cssText = buttonStyle("#333", "#f7f7f8");
    settings.addEventListener("click", openSettings);
    panel.appendChild(settings);
    document.body.appendChild(panel);
  }

  function buttonStyle(background, color) {
    return [
      "border:1px solid #444",
      "border-radius:6px",
      "padding:6px 8px",
      `background:${background}`,
      `color:${color}`,
      "font-size:12px",
      "font-weight:600",
      "cursor:pointer",
    ].join(";");
  }

  const observer = new MutationObserver(mount);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  mount();
})();

