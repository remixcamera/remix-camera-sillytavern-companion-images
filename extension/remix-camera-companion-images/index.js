import { extension_settings, getContext as getSillyTavernContext } from "../../../extensions.js";
import { saveSettingsDebounced } from "../../../../script.js";
import {
  USER_INCLUDED_COMMANDS,
  firstUrl,
  parseNaturalCompanionImageRequest,
  withoutFirstUrl,
} from "./shared/companion-command-parser.mjs";

(function remixCameraCompanionImages() {
  const EXTENSION_NAME = "remix-camera-companion-images";
  const SETTINGS_KEY = "remixCameraCompanionImages";
  const TOOL_NAMES = [
    "remix_send_selfie",
    "remix_auto_selfie_from_chat",
    "remix_outfit_try_on",
    "remix_couple_photo",
    "remix_couples_vacation",
    "remix_date_night",
    "remix_daily_life_snap",
    "remix_private_snap",
  ];
  const DEFAULT_SETTINGS = {
    bridgeUrl: "http://127.0.0.1:8787",
    profileId: "",
    referenceImageKey: "",
    characterName: "",
    gender: "",
    bio: "",
    mood: "warm, attentive, in-character",
    outfit: "",
    location: "",
    style: "character-consistent portrait image, natural composition, polished detail",
    visualIdentity: "",
    negativePrompt: "text overlays, UI, watermark, distorted hands, duplicated face, unrelated people",
    maxGenerations: 1,
    matureContent: false,
    allowToolCalls: false,
    autoInsertResult: true,
    proactiveSnapsEnabled: false,
    proactiveSnapIntervalMinutes: 240,
    proactiveSnapDailyLimit: 1,
    proactiveSnapDate: "",
    proactiveSnapCount: 0,
    proactiveSnapLastSentAt: 0,
    proactiveSnapQuietStart: "22:00",
    proactiveSnapQuietEnd: "08:00",
    proactiveSnapRequireActiveChat: true,
  };
  const CHARACTER_SETTINGS_KEYS = [
    "profileId",
    "referenceImageKey",
    "characterName",
    "gender",
    "bio",
    "mood",
    "outfit",
    "location",
    "style",
    "visualIdentity",
    "negativePrompt",
    "matureContent",
  ];
  const REFERENCE_UPLOAD_TARGET_BYTES = Math.floor(3.6 * 1024 * 1024);
  const REFERENCE_UPLOAD_MAX_DIMENSION = 2048;
  const REFERENCE_UPLOAD_INPUT_MAX_BYTES = 20 * 1024 * 1024;
  const REFERENCE_UPLOAD_TIMEOUT_MS = 60_000;
  const REFERENCE_IMAGE_MIME_PATTERN = /^image\/(jpeg|jpg|png|webp|avif|heic|heif)$/i;
  const GENERATION_TIMEOUT_MS = 4 * 60 * 1000;
  const STALE_PENDING_MS = 5 * 60 * 1000;
  let functionToolsRegistered = false;
  let lifecycleEventsBound = false;
  let feedbackEventsBound = false;
  let sourceReferenceFile = null;
  let sourceReferenceUpload = null;
  let coupleReferenceFile = null;
  let coupleReferenceUpload = null;
  let proactiveSnapTimer = null;
  let naturalLanguageGenerationInProgress = false;
  let lastNaturalLanguageImageRequest = "";
  let lastGeneratedImageUrl = "";

  function getContext() {
    try {
      const context = getSillyTavernContext();
      if (context) {
        return context;
      }
    } catch {
      // Fall through to globals for older SillyTavern builds.
    }
    if (window.SillyTavern && typeof window.SillyTavern.getContext === "function") {
      return window.SillyTavern.getContext();
    }
    if (typeof window.getContext === "function") {
      return window.getContext();
    }
    return null;
  }

  function getSettingsRoot() {
    const context = getContext();
    if (context?.extensionSettings) {
      return context.extensionSettings;
    }

    if (extension_settings) {
      return extension_settings;
    }

    if (!window.extension_settings) {
      window.extension_settings = {};
    }
    return window.extension_settings;
  }

  function getRootSettings() {
    const root = getSettingsRoot();
    if (!root[SETTINGS_KEY]) {
      root[SETTINGS_KEY] = {};
    }
    return root[SETTINGS_KEY];
  }

  function currentCharacterData() {
    const context = getContext();
    const character = context?.characters?.[context?.characterId];
    if (!character) {
      return null;
    }
    if (character.data && typeof character.data === "object") {
      return character.data;
    }
    if (typeof character.json_data === "string") {
      try {
        const parsed = JSON.parse(character.json_data);
        return parsed?.data || parsed;
      } catch {
        return null;
      }
    }
    return null;
  }

  function characterCardSettings() {
    const data = currentCharacterData();
    const remix = data?.extensions?.remix_camera;
    if (!remix || typeof remix !== "object") {
      return {};
    }

    return {
      bridgeUrl: cleanString(remix.bridgeUrl),
      profileId: cleanProfileId(remix.profileId),
      referenceImageKey: cleanString(remix.referenceImageKey || remix.primaryReferenceImageKey || remix.uploadedReferenceImageKey),
      characterName: cleanString(remix.characterName || data?.name),
      gender: cleanString(remix.gender),
      bio: cleanString(remix.bio || data?.personality || data?.description),
      mood: cleanString(remix.defaultMood || remix.mood),
      outfit: cleanString(remix.defaultOutfit || remix.outfit),
      location: cleanString(remix.defaultLocation || remix.location),
      style: cleanString(remix.defaultStyle || remix.style),
      visualIdentity: cleanString(remix.visualIdentity || remix.characterVisualIdentity),
      negativePrompt: cleanString(remix.negativePrompt),
      matureContent: typeof remix.matureContent === "boolean" ? remix.matureContent : undefined,
      allowToolCalls: typeof remix.allowToolCalls === "boolean" ? remix.allowToolCalls : undefined,
    };
  }

  function activeCharacterKey(card = characterCardSettings()) {
    const context = getContext();
    const character = context?.characters?.[context?.characterId];
    const profileId = cleanProfileId(card.profileId);
    return (
      cleanString(character?.avatar) ||
      cleanString(character?.name) ||
      cleanString(card.characterName) ||
      profileId ||
      "__global__"
    );
  }

  function hasCardSettings(card) {
    return Object.values(card).some((value) => value !== undefined && cleanString(value));
  }

  function characterOverrides(root, card) {
    const key = activeCharacterKey(card);
    const characters = root.characters && typeof root.characters === "object" ? root.characters : {};
    const scoped = characters[key];
    return scoped && typeof scoped === "object" ? scoped : {};
  }

  function cleanString(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function cleanProfileId(value) {
    const profileId = cleanString(value);
    return profileId === "profile_replace_me" ? "" : profileId;
  }

  function loadImage(file) {
    return new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(image);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        reject(new Error("Could not decode the selected photo."));
      };
      image.src = objectUrl;
    });
  }

  function canvasJpegBlob(canvas, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => blob ? resolve(blob) : reject(new Error("Could not compress the selected photo.")),
        "image/jpeg",
        quality,
      );
    });
  }

  function referenceFileName(file, mimeType) {
    const original = cleanString(file?.name) || "reference-image";
    return mimeType === "image/jpeg"
      ? original.replace(/\.[^.]+$/, "") + ".jpg"
      : original;
  }

  function referenceMimeType(file) {
    const declared = cleanString(file?.type).toLowerCase();
    if (REFERENCE_IMAGE_MIME_PATTERN.test(declared)) {
      return declared;
    }
    const extension = cleanString(file?.name).toLowerCase().split(".").pop();
    return {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      avif: "image/avif",
      heic: "image/heic",
      heif: "image/heif",
    }[extension] || "";
  }

  async function prepareReferencePhoto(file) {
    if (file.size > REFERENCE_UPLOAD_INPUT_MAX_BYTES) {
      throw new Error("The selected photo must be 20MB or smaller before compression.");
    }
    const mimeType = referenceMimeType(file);
    if (file.size <= REFERENCE_UPLOAD_TARGET_BYTES && isSupportedReferencePhoto(file)) {
      return {
        blob: file.type === mimeType ? file : file.slice(0, file.size, mimeType),
        fileName: referenceFileName(file, mimeType),
        mimeType,
      };
    }

    const image = await loadImage(file);
    const scale = Math.min(1, REFERENCE_UPLOAD_MAX_DIMENSION / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
    const width = Math.max(1, Math.round((image.naturalWidth || image.width) * scale));
    const height = Math.max(1, Math.round((image.naturalHeight || image.height) * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not prepare the selected photo.");
    }
    context.drawImage(image, 0, 0, width, height);

    for (const quality of [0.88, 0.82, 0.76, 0.7, 0.64]) {
      const blob = await canvasJpegBlob(canvas, quality);
      if (blob.size <= REFERENCE_UPLOAD_TARGET_BYTES) {
        return {
          blob,
          fileName: referenceFileName(file, "image/jpeg"),
          mimeType: "image/jpeg",
        };
      }
    }

    throw new Error("The selected photo is too large. Crop or compress it under 4MB and try again.");
  }

  function isSupportedReferencePhoto(file) {
    return Boolean(file && referenceMimeType(file));
  }

  function stringSetting(saved, card, key, scoped = {}, cardHasSettings = false) {
    const legacy = cardHasSettings ? "" : cleanString(saved[key]);
    return cleanString(scoped[key]) || cleanString(card[key]) || legacy || cleanString(DEFAULT_SETTINGS[key]);
  }

  function settings() {
    const saved = getRootSettings();
    const card = characterCardSettings();
    const scoped = characterOverrides(saved, card);
    const cardHasSettings = hasCardSettings(card);
    return {
      bridgeUrl: cleanString(scoped.bridgeUrl) || cleanString(saved.bridgeUrl) || cleanString(card.bridgeUrl) || DEFAULT_SETTINGS.bridgeUrl,
      profileId: stringSetting(saved, card, "profileId", scoped, cardHasSettings),
      referenceImageKey: stringSetting(saved, card, "referenceImageKey", scoped, cardHasSettings),
      characterName: stringSetting(saved, card, "characterName", scoped, cardHasSettings),
      gender: stringSetting(saved, card, "gender", scoped, cardHasSettings),
      bio: stringSetting(saved, card, "bio", scoped, cardHasSettings),
      mood: stringSetting(saved, card, "mood", scoped, cardHasSettings),
      outfit: stringSetting(saved, card, "outfit", scoped, cardHasSettings),
      location: stringSetting(saved, card, "location", scoped, cardHasSettings),
      style: stringSetting(saved, card, "style", scoped, cardHasSettings),
      visualIdentity: stringSetting(saved, card, "visualIdentity", scoped, cardHasSettings),
      negativePrompt: stringSetting(saved, card, "negativePrompt", scoped, cardHasSettings),
      maxGenerations: Math.max(1, Math.min(4, Number(saved.maxGenerations || DEFAULT_SETTINGS.maxGenerations))),
      matureContent:
        typeof scoped.matureContent === "boolean"
          ? scoped.matureContent
          : typeof saved.matureContent === "boolean"
            ? saved.matureContent
            : typeof card.matureContent === "boolean"
              ? card.matureContent
              : DEFAULT_SETTINGS.matureContent,
      allowToolCalls:
        typeof saved.allowToolCalls === "boolean"
          ? saved.allowToolCalls
          : typeof card.allowToolCalls === "boolean"
            ? card.allowToolCalls
            : DEFAULT_SETTINGS.allowToolCalls,
      autoInsertResult:
        typeof saved.autoInsertResult === "boolean"
          ? saved.autoInsertResult
          : DEFAULT_SETTINGS.autoInsertResult,
      proactiveSnapsEnabled:
        typeof saved.proactiveSnapsEnabled === "boolean"
          ? saved.proactiveSnapsEnabled
          : DEFAULT_SETTINGS.proactiveSnapsEnabled,
      proactiveSnapIntervalMinutes: Math.max(30, Math.min(1440, Number(saved.proactiveSnapIntervalMinutes || DEFAULT_SETTINGS.proactiveSnapIntervalMinutes))),
      proactiveSnapDailyLimit: Math.max(0, Math.min(6, Number(saved.proactiveSnapDailyLimit || DEFAULT_SETTINGS.proactiveSnapDailyLimit))),
      proactiveSnapDate: cleanString(saved.proactiveSnapDate),
      proactiveSnapCount: Math.max(0, Number(saved.proactiveSnapCount || 0)),
      proactiveSnapLastSentAt: Math.max(0, Number(saved.proactiveSnapLastSentAt || 0)),
      proactiveSnapQuietStart: cleanString(saved.proactiveSnapQuietStart) || DEFAULT_SETTINGS.proactiveSnapQuietStart,
      proactiveSnapQuietEnd: cleanString(saved.proactiveSnapQuietEnd) || DEFAULT_SETTINGS.proactiveSnapQuietEnd,
      proactiveSnapRequireActiveChat:
        typeof saved.proactiveSnapRequireActiveChat === "boolean"
          ? saved.proactiveSnapRequireActiveChat
          : DEFAULT_SETTINGS.proactiveSnapRequireActiveChat,
    };
  }

  function updateSettings(patch) {
    const root = getSettingsRoot();
    const currentRoot = root[SETTINGS_KEY] && typeof root[SETTINGS_KEY] === "object" ? root[SETTINGS_KEY] : {};
    const card = characterCardSettings();
    const key = activeCharacterKey(card);
    const globalPatch = {};
    const scopedPatch = {};
    Object.entries(patch).forEach(([patchKey, value]) => {
      if (CHARACTER_SETTINGS_KEYS.includes(patchKey)) {
        scopedPatch[patchKey] = value;
      } else {
        globalPatch[patchKey] = value;
      }
    });
    root[SETTINGS_KEY] = {
      ...currentRoot,
      ...globalPatch,
      characters: {
        ...(currentRoot.characters && typeof currentRoot.characters === "object" ? currentRoot.characters : {}),
        [key]: {
          ...characterOverrides(currentRoot, card),
          ...scopedPatch,
        },
      },
    };
    const context = getContext();
    if (typeof saveSettingsDebounced === "function") {
      saveSettingsDebounced();
    } else if (typeof context?.saveSettingsDebounced === "function") {
      context.saveSettingsDebounced();
    } else if (typeof window.saveSettingsDebounced === "function") {
      window.saveSettingsDebounced();
    }
  }

  function inputValue(id) {
    const node = document.getElementById(id);
    return node ? node.value.trim() : "";
  }

  function inputChecked(id) {
    const node = document.getElementById(id);
    return node ? Boolean(node.checked) : false;
  }

  function setInputValue(id, value) {
    const node = document.getElementById(id);
    if (node) {
      node.value = value || "";
    }
  }

  function setInputChecked(id, checked) {
    const node = document.getElementById(id);
    if (node) {
      node.checked = Boolean(checked);
    }
  }

  function setLog(message, type = "info") {
    const log = document.getElementById("remix-camera-log");
    if (!log) {
      return;
    }
    log.textContent = message;
    log.dataset.type = type;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  function successfulGeneratedImages(payload) {
    if (!Array.isArray(payload?.results)) {
      return [];
    }
    return payload.results
      .filter((result) => result?.ok && cleanString(result.imageUrl))
      .map((result) => ({
        id: cleanString(result.id),
        imageUrl: cleanString(result.imageUrl),
        productionImageUrl: cleanString(result.productionImageUrl),
        bridgeImageId: cleanString(result.bridgeImageId),
      }));
  }

  function generatedImageFeedbackHtml(generationId, command) {
    const id = cleanString(generationId);
    if (!id) {
      return "";
    }
    return [
      `<div class="remix-camera-feedback" data-remix-camera-generation-id="${escapeHtml(id)}" data-remix-camera-command="${escapeHtml(command || "image")}">`,
      `<button class="remix-camera-feedback-button" type="button" data-remix-camera-feedback-signal="thumbs_up" title="More like this" aria-label="More like this">More like this</button>`,
      `<button class="remix-camera-feedback-button" type="button" data-remix-camera-feedback-signal="thumbs_down" title="Not quite" aria-label="Not quite">Not quite</button>`,
      "</div>",
    ].join("");
  }

  function setFirstRunStep(step, state) {
    const item = document.querySelector(`[data-remix-camera-first-run="${step}"]`);
    if (!item) {
      return;
    }
    item.dataset.state = state;
  }

  function refreshFirstRunChecklist(current = settings()) {
    setFirstRunStep("profile", current.profileId || current.referenceImageKey ? "done" : "todo");
  }

  function generatedImageMessageHtml(markdown, images, command) {
    const items = (Array.isArray(images) ? images : [{ imageUrl: images }])
      .map((image) => ({
        imageUrl: cleanString(typeof image === "string" ? image : image?.imageUrl),
        id: cleanString(typeof image === "string" ? "" : image?.id),
      }))
      .filter((image) => image.imageUrl);
    if (!items.length) {
      return markdown;
    }
    const label = `${settings().characterName || "Remix.Camera"} ${command || "image"}`.trim();
    return items
      .map((item, index) => {
        const url = item.imageUrl;
        const imageLabel = items.length > 1 ? `${label} ${index + 1}` : label;
        const imageHtml = [
          `<a class="remix-camera-chat-image-link" href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">`,
          `<img class="remix-camera-chat-image" src="${escapeHtml(url)}" alt="${escapeHtml(imageLabel)}" loading="eager" decoding="sync">`,
          "</a>",
        ].join("");
        const feedbackHtml = generatedImageFeedbackHtml(item.id, command);
        if (command !== "private-snap") {
          return imageHtml + feedbackHtml;
        }
        return [
          `<div class="remix-camera-snap" data-remix-camera-image-url="${escapeHtml(url)}">`,
          imageHtml,
          `<span class="remix-camera-snap-badge">Snap</span>`,
          "</div>",
          feedbackHtml,
        ].join("");
      })
      .join("");
  }

  function hydrateGeneratedImage(imageUrl, command, inserted = null) {
    const url = cleanString(imageUrl);
    if (!url) {
      return;
    }
    window.setTimeout(async () => {
      const target = inserted?.element?.isConnected ? inserted.element : inserted?.message ? messageElementFor(inserted.message) : null;
      const messages = [...document.querySelectorAll("#chat .mes")];
      const message = target || messages.at(-1);
      const body = message?.querySelector(".mes_text") || message?.querySelector(".mes_block") || message;
      if (
        !body ||
        [...body.querySelectorAll("img[src]")].some((image) => image.getAttribute("src") === url || image.src === url)
      ) {
        return;
      }

      const label = `${settings().characterName || "Remix.Camera"} ${command || "image"}`.trim();
      let link = [...body.querySelectorAll("a[href]")].find((item) => item.getAttribute("href") === url || item.href === url);
      if (!link) {
        link = document.createElement("a");
        link.href = url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        body.appendChild(link);
      }
      link.classList.add("remix-camera-chat-image-link");
      const image = document.createElement("img");
      image.className = "remix-camera-chat-image";
      image.alt = label;
      image.loading = "eager";
      image.decoding = "sync";
      link.appendChild(image);
      image.src = url;
    }, 0);
  }

  function recentChatText() {
    const context = getContext();
    const chat = Array.isArray(context?.chat) ? context.chat : [];
    return chat
      .slice(-12)
      .map((message) => {
        const name = message.is_user ? "User" : message.name || settings().characterName || "Character";
        const text = String(message.mes || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
        return text ? `${name}: ${text}` : "";
      })
      .filter(Boolean)
      .join("\n");
  }

  function requestBody(command, args = {}) {
    const current = settings();
    return {
      yes: true,
      command,
      profileId: args.profileId || current.profileId,
      referenceImageKey: args.referenceImageKey || current.referenceImageKey,
      characterName: args.characterName || current.characterName || getContext()?.name2 || "Companion",
      gender: args.gender || current.gender,
      bio: args.bio || current.bio,
      mood: args.mood || current.mood,
      outfit: args.outfit || current.outfit,
      location: args.location || current.location,
      pose: args.pose || "",
      style: args.style || current.style,
      visualIdentity: args.visualIdentity || current.visualIdentity,
      negativePrompt: args.negativePrompt || current.negativePrompt,
      sourceImageUrl: args.sourceImageUrl || "",
      sourceReferenceImageId: args.sourceReferenceImageId || "",
      referenceImageUrl: args.referenceImageUrl || "",
      userDescription: args.userDescription || "",
      userConsent: args.userConsent || "",
      userReferenceImageKey: args.userReferenceImageKey || "",
      userReferenceImageId: args.userReferenceImageId || "",
      userReferenceImageUrl: args.userReferenceImageUrl || "",
      userReferenceImageDataUrl: args.userReferenceImageDataUrl || "",
      userReferenceImageName: args.userReferenceImageName || "",
      userReferenceImageMimeType: args.userReferenceImageMimeType || "",
      theme: args.theme || "",
      matureContent: typeof args.matureContent === "boolean" ? args.matureContent : current.matureContent,
      chatText: args.chatText || recentChatText(),
      memory: args.memory || "",
      maxGenerations: Number(args.maxGenerations || current.maxGenerations || 1),
    };
  }

  async function bridgeFetch(pathname, body, options = {}) {
    const current = settings();
    const timeoutMs = Math.max(0, Number(options.timeoutMs || 0));
    const controller = timeoutMs ? new AbortController() : null;
    const timeout = controller
      ? window.setTimeout(() => controller.abort(), timeoutMs)
      : null;
    try {
      const response = await fetch(`${current.bridgeUrl.replace(/\/+$/, "")}${pathname}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller?.signal,
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || `Bridge request failed with ${response.status}`);
      }
      return payload;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error("Remix.Camera is taking longer than expected. Try sending it again.");
      }
      throw error;
    } finally {
      if (timeout) {
        window.clearTimeout(timeout);
      }
    }
  }

  async function uploadReferenceFile(file, purpose) {
    const prepared = await prepareReferencePhoto(file);
    const formData = new FormData();
    formData.set("file", prepared.blob, prepared.fileName);
    const current = settings();
    const controller = new AbortController();
    const timeout = window.setTimeout(
      () => controller.abort(),
      REFERENCE_UPLOAD_TIMEOUT_MS,
    );
    try {
      setLog(`Uploading ${purpose} and waiting for its safety check...`);
      const response = await fetch(
        `${current.bridgeUrl.replace(/\/+$/, "")}/v1/media/reference-image`,
        {
          method: "POST",
          body: formData,
          signal: controller.signal,
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(payload?.error || `Reference upload failed with ${response.status}`);
      }
      const referenceImage = payload?.referenceImage;
      if (!referenceImage?.id || referenceImage.status !== "clear") {
        throw new Error("Reference upload did not finish its safety check.");
      }
      return referenceImage;
    } catch (error) {
      if (error?.name === "AbortError") {
        throw new Error("The reference image safety check is still running. Try again shortly; the bridge will reuse the upload.");
      }
      throw error;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async function sendImageFeedback(button) {
    const container = button.closest(".remix-camera-feedback");
    const generationId = cleanString(container?.dataset?.remixCameraGenerationId);
    const signal = cleanString(button.dataset?.remixCameraFeedbackSignal);
    if (!generationId || !["thumbs_up", "thumbs_down"].includes(signal)) {
      return;
    }

    const buttons = [...container.querySelectorAll(".remix-camera-feedback-button")];
    buttons.forEach((item) => {
      item.disabled = true;
      item.removeAttribute("data-selected");
    });
    try {
      await bridgeFetch("/v1/feedback", {
        generationId,
        signal,
        command: cleanString(container.dataset?.remixCameraCommand),
        surface: "sillytavern",
        sourceRoute: "sillytavern_inline_feedback",
      }, { timeoutMs: 30_000 });
      button.dataset.selected = "true";
      container.dataset.feedbackState = "saved";
      setLog("Feedback saved.", "success");
    } catch (error) {
      buttons.forEach((item) => {
        item.disabled = false;
      });
      container.dataset.feedbackState = "error";
      setLog(error.message || "Feedback failed.", "error");
    }
  }

  function bindFeedbackEvents() {
    if (feedbackEventsBound) {
      return;
    }
    document.addEventListener("click", (event) => {
      const button = event.target?.closest?.(".remix-camera-feedback-button");
      if (!button) {
        return;
      }
      event.preventDefault();
      void sendImageFeedback(button);
    });
    feedbackEventsBound = true;
  }

  async function checkHealth() {
    const current = settings();
    const response = await fetch(`${current.bridgeUrl.replace(/\/+$/, "")}/health`);
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || `Health check failed with ${response.status}`);
    }
    return payload;
  }

  function lastChatMessageElement() {
    return [...document.querySelectorAll("#chat .mes")].at(-1) || null;
  }

  function messageElementFor(message) {
    const elements = [...document.querySelectorAll("#chat .mes")];
    return elements.find((element) => element.__remixCameraMessage === message) || null;
  }

  function insertCompanionMessage(content, options = {}) {
    const context = getContext();
    if (!context || typeof context.addOneMessage !== "function") {
      return null;
    }
    const message = {
      name: settings().characterName || "Remix.Camera",
      is_user: false,
      is_system: false,
      mes: options.html ? String(content || "") : escapeHtml(content),
      send_date: new Date().toISOString(),
      extra: options.extra && typeof options.extra === "object" ? options.extra : {},
    };
    if (Array.isArray(context.chat)) {
      context.chat.push(message);
    }
    context.addOneMessage(message);
    const element = lastChatMessageElement();
    if (element) {
      element.__remixCameraMessage = message;
    }
    if (typeof context.saveChat === "function") {
      context.saveChat();
    }
    return { message, element };
  }

  function pendingImageMessageHtml(command) {
    const characterName = settings().characterName || "Remix.Camera";
    const action = command === "private-snap"
      ? "is making this one just for you"
      : command === "couples-vacation"
        ? "is bringing the trip to life"
        : "is making the photo feel right";
    return [
      `<div class="remix-camera-pending" data-remix-camera-command="${escapeHtml(command || "image")}">`,
      `<span class="remix-camera-pending-name">${escapeHtml(characterName)}</span> ${escapeHtml(action)}`,
      `<span class="remix-camera-pending-dots" aria-hidden="true"></span>`,
      "</div>",
    ].join("");
  }

  function insertPendingImageMessage(command) {
    return insertCompanionMessage(pendingImageMessageHtml(command), {
      html: true,
      extra: {
        type: "remix_camera_pending",
        generationType: command || "remix-camera",
      },
    });
  }

  function updateInsertedMessage(inserted, html, extra = {}) {
    if (!inserted?.message) {
      return false;
    }

    inserted.message.mes = html;
    inserted.message.extra = {
      ...(inserted.message.extra && typeof inserted.message.extra === "object" ? inserted.message.extra : {}),
      ...extra,
    };

    const element = inserted.element?.isConnected ? inserted.element : messageElementFor(inserted.message);
    const body = element?.querySelector(".mes_text") || element?.querySelector(".mes_block") || element;
    if (body) {
      body.innerHTML = html;
    }

    const context = getContext();
    if (typeof context?.saveChat === "function") {
      context.saveChat();
    }
    return Boolean(body);
  }

  function imageResultExtra(payload, generatedImages, markdown, imageUrls, productionImageUrls, bridgeImageIds, generationIds, imageUrl, productionImageUrl) {
    return {
      type: "remix_camera_image",
      image: imageUrl || undefined,
      images: imageUrls.length ? imageUrls : undefined,
      productionImageUrl: productionImageUrl || undefined,
      productionImageUrls: productionImageUrls.length ? productionImageUrls : undefined,
      bridgeImageIds: bridgeImageIds.length ? bridgeImageIds : undefined,
      generationIds: generationIds.length ? generationIds : undefined,
      markdown,
      modelId: payload?.modelId || undefined,
      matureContent: payload?.matureContent === true || undefined,
      title: payload?.prompt || markdown,
      generationType: payload?.command || "remix-camera",
      resultCount: generatedImages.length || undefined,
    };
  }

  async function insertGeneratedResult(payload, options = {}) {
    const generatedImages = successfulGeneratedImages(payload);
    const imageUrls = generatedImages.map((image) => image.imageUrl).filter(Boolean);
    const productionImageUrls = generatedImages.map((image) => image.productionImageUrl).filter(Boolean);
    const bridgeImageIds = generatedImages.map((image) => image.bridgeImageId).filter(Boolean);
    const generationIds = generatedImages.map((image) => image.id).filter(Boolean);
    const markdown = payload?.markdown || imageUrls
      .map((url, index) => {
        const suffix = imageUrls.length > 1 ? ` ${index + 1} of ${imageUrls.length}` : "";
        return `![${settings().characterName || "Remix.Camera"} ${payload?.command || "image"}${suffix}](${url})`;
      })
      .join("\n\n");
    const imageUrl = imageUrls[0] || "";
    const productionImageUrl = productionImageUrls[0] || "";

    if (!markdown && !imageUrls.length) {
      return "none";
    }
    lastGeneratedImageUrl = productionImageUrl || imageUrl || lastGeneratedImageUrl;

    const messageHtml = generatedImageMessageHtml(markdown, generatedImages, payload?.command);
    const extra = imageResultExtra(payload, generatedImages, markdown, imageUrls, productionImageUrls, bridgeImageIds, generationIds, imageUrl, productionImageUrl);

    if (options.pendingMessage && updateInsertedMessage(options.pendingMessage, messageHtml, extra)) {
      for (const url of imageUrls) {
        hydrateGeneratedImage(url, payload?.command, options.pendingMessage);
      }
      return "inserted";
    }

    const context = getContext();
    if (settings().autoInsertResult && context && typeof context.addOneMessage === "function") {
      const message = {
        name: settings().characterName || "Remix.Camera",
        is_user: false,
        is_system: false,
        mes: messageHtml,
        send_date: new Date().toISOString(),
        extra,
      };
      if (Array.isArray(context.chat)) {
        context.chat.push(message);
      }
      context.addOneMessage(message);
      const element = lastChatMessageElement();
      if (element) {
        element.__remixCameraMessage = message;
      }
      for (const url of imageUrls) {
        hydrateGeneratedImage(url, payload?.command);
      }
      if (typeof context.saveChat === "function") {
        context.saveChat();
      }
      return "inserted";
    }

    if (settings().autoInsertResult && context && typeof context.sendSystemMessage === "function") {
      context.sendSystemMessage("generic", markdown);
      return "inserted";
    }

    if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
      await navigator.clipboard.writeText(markdown);
      return "copied";
    }

    return "none";
  }

  function progressReplyForCommand(command) {
    if (command === "private-snap") {
      return "Mmm. Give me a minute - I'll make it worth the wait.";
    }
    if (command === "couples-vacation") {
      return "Give me a minute - I want these to feel like a real getaway.";
    }
    if (command === "couple-photo") {
      return "Okay, I'm making this one feel like us.";
    }
    return "Give me a second - I want this one to look right.";
  }

  function updatePendingWithError(inserted, message) {
    const safeMessage = escapeHtml(message || "Image generation failed.");
    updateInsertedMessage(
      inserted,
      `<div class="remix-camera-pending remix-camera-pending--error">${safeMessage}</div>`,
      {
        type: "remix_camera_error",
        error: message || "Image generation failed.",
      },
    );
  }

  function messageTimeMs(message) {
    const parsed = Date.parse(message?.send_date || "");
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function markStalePendingMessages() {
    const context = getContext();
    const chat = Array.isArray(context?.chat) ? context.chat : [];
    let changed = false;
    chat.forEach((message, index) => {
      if (message?.extra?.type !== "remix_camera_pending") {
        return;
      }
      const createdAt = messageTimeMs(message);
      if (createdAt && Date.now() - createdAt < STALE_PENDING_MS) {
        return;
      }
      const element = document.querySelector(`#chat .mes[mesid="${index}"]`);
      updateInsertedMessage(
        { message, element },
        `<div class="remix-camera-pending remix-camera-pending--error">That photo got interrupted before it finished. Send it again and I'll retry.</div>`,
        {
          type: "remix_camera_error",
          error: "Generation interrupted before completion.",
        },
      );
      changed = true;
    });
    if (changed && typeof context?.saveChat === "function") {
      context.saveChat();
    }
  }

  function scheduleStalePendingCleanup() {
    for (const delayMs of [0, 1000, 4000]) {
      window.setTimeout(markStalePendingMessages, delayMs);
    }
  }

  async function generate(command, args = {}, options = {}) {
    setLog(`Generating ${command}...`);
    const pendingMessage = options.pendingMessage === false
      ? null
      : options.pendingMessage || insertPendingImageMessage(command);
    let payload;
    try {
      payload = await bridgeFetch("/v1/commands/generate", requestBody(command, args), { timeoutMs: GENERATION_TIMEOUT_MS });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "Image generation failed.");
      if (pendingMessage) {
        updatePendingWithError(pendingMessage, message);
      }
      throw error;
    }
    const insertion = await insertGeneratedResult(payload, { pendingMessage });
    if (insertion === "inserted") {
      setFirstRunStep("image", "done");
      setLog("Image generated and inserted into chat.", "success");
    } else if (insertion === "copied") {
      setFirstRunStep("image", "done");
      setLog("Image generated. Markdown copied to clipboard.", "success");
    } else {
      setLog(payload.markdown || "Image generated, but no markdown was returned.", "success");
    }
    return payload.markdown || JSON.stringify(payload);
  }

  function plainMessageText(value) {
    return String(value || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function latestUserMessage(chat) {
    const messages = Array.isArray(chat) ? chat : getContext()?.chat;
    if (!Array.isArray(messages)) {
      return null;
    }

    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const message = messages[index];
      if (message?.is_user) {
        const text = plainMessageText(message.mes || message.message || message.content);
        return text ? { index, text } : null;
      }
    }
    return null;
  }

  function classifyNaturalLanguageImageRequest(text) {
    const parsed = parseNaturalCompanionImageRequest(text, "generate");
    if (!parsed) {
      return null;
    }
    const promptText = withoutFirstUrl(parsed.text);
    const sourceImageUrl = firstUrl(parsed.text) || (parsed.contextualSourceImage ? lastGeneratedImageUrl : "");
    const args = {
      mood: promptText,
      location: promptText,
      sourceImageUrl,
      userConsent: parsed.userConsent,
      matureContent: parsed.command === "private-snap" ? true : undefined,
      maxGenerations: parsed.command === "couples-vacation" ? 3 : undefined,
      theme: parsed.command === "couples-vacation" ? promptText : undefined,
      outfit: parsed.command === "outfit-try-on" ? promptText : undefined,
      userReferenceImageUrl: USER_INCLUDED_COMMANDS.has(parsed.command) ? sourceImageUrl : undefined,
      userDescription: parsed.userConsent === "yes" ? "the user, a consenting adult" : undefined,
    };
    return { command: parsed.command, args, parsed };
  }

  function isFollowupImageRequest(text) {
    const lower = cleanString(text).toLowerCase();
    return /\b(send|show|make|do|generate|create)\s+(it|that|this|one)\b/.test(lower) ||
      /^(yes|yeah|yep|ok|okay|please|pls|go ahead|do it|send it|show me|send that|send this|send one)[.!? ]*$/.test(lower);
  }

  function previousClassifiedImageRequest(messages, latestIndex) {
    if (!Array.isArray(messages)) {
      return null;
    }
    const startIndex = Math.min(Number(latestIndex) - 1, messages.length - 1);
    const stopIndex = Math.max(0, startIndex - 12);
    for (let index = startIndex; index >= stopIndex; index -= 1) {
      const message = messages[index];
      if (!message?.is_user) {
        continue;
      }
      const text = plainMessageText(message.mes || message.message || message.content);
      const request = classifyNaturalLanguageImageRequest(text);
      if (request) {
        return {
          ...request,
          args: {
            ...request.args,
            chatText: recentChatText(),
          },
        };
      }
    }
    return null;
  }

  function classifyImageRequestFromChat(latest, messages) {
    const direct = classifyNaturalLanguageImageRequest(latest?.text || "");
    if (direct) {
      return direct;
    }
    if (!latest || !isFollowupImageRequest(latest.text)) {
      return null;
    }
    return previousClassifiedImageRequest(messages, latest.index);
  }

  function insertCompanionTextMessage(text) {
    return Boolean(insertCompanionMessage(text, { extra: { type: "remix_camera_status" } }));
  }

  async function naturalLanguageImageInterceptor(chat, contextSize, abort) {
    if (!settings().allowToolCalls || naturalLanguageGenerationInProgress) {
      return;
    }

    const latest = latestUserMessage(chat);
    const request = latest ? classifyImageRequestFromChat(latest, chat) : null;
    if (!latest || !request) {
      return;
    }

    const signature = `${latest.index}:${latest.text}`;
    if (signature === lastNaturalLanguageImageRequest) {
      return;
    }

    lastNaturalLanguageImageRequest = signature;
    if (USER_INCLUDED_COMMANDS.has(request.command) && request.args?.userConsent !== "yes") {
      if (typeof abort === "function") {
        abort(true);
      }
      insertCompanionTextMessage("Say yes and clearly ask to be in the photo before I make a couple or vacation image with you.");
      return;
    }

    naturalLanguageGenerationInProgress = true;
    if (typeof abort === "function") {
      abort(true);
    }

    try {
      insertCompanionTextMessage(progressReplyForCommand(request.command));
      const pendingMessage = insertPendingImageMessage(request.command);
      generate(request.command, {
        ...request.args,
        chatText: recentChatText(),
        maxGenerations: request.args?.maxGenerations || settings().maxGenerations,
      }, { pendingMessage }).catch((error) => {
        const message = error instanceof Error ? error.message : String(error || "Unknown error");
        setLog(message, "error");
        insertCompanionTextMessage(`I tried to create that image with Remix.Camera, but it failed: ${message}`);
      }).finally(() => {
        naturalLanguageGenerationInProgress = false;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error || "Unknown error");
      setLog(message, "error");
      insertCompanionTextMessage(`I tried to create that image with Remix.Camera, but it failed: ${message}`);
      naturalLanguageGenerationInProgress = false;
    }
  }

  window.remixCameraCompanionImagesGenerateInterceptor = naturalLanguageImageInterceptor;

  async function dryRun(command, args = {}) {
    setLog(`Previewing ${command}...`);
    const body = requestBody(command, args);
    body.yes = false;
    const payload = await bridgeFetch("/v1/commands/dry-run", body);
    const warnings = Array.isArray(payload.warnings) && payload.warnings.length
      ? `\n\nWarnings:\n- ${payload.warnings.join("\n- ")}`
      : "";
    setFirstRunStep("preview", "done");
    setLog(`Dry run OK. Planned generations: ${payload.maxGenerations || 1}\n\n${payload.prompt}${warnings}`, "success");
    return JSON.stringify(payload, null, 2);
  }

  function updateCoupleReferenceUi() {
    const status = document.getElementById("remix-camera-couple-photo-status");
    const clearButton = document.getElementById("remix-camera-couple-photo-clear");
    if (status) {
      status.textContent = coupleReferenceFile
        ? coupleReferenceUpload
          ? `Ready: ${coupleReferenceFile.name || "user reference photo"}`
          : `Selected: ${coupleReferenceFile.name || "user reference photo"}`
        : "No user photo selected.";
    }
    if (clearButton) {
      clearButton.disabled = !coupleReferenceFile;
    }
  }

  function updateSourceReferenceUi() {
    const status = document.getElementById("remix-camera-source-image-status");
    const clearButton = document.getElementById("remix-camera-source-image-clear");
    if (status) {
      status.textContent = sourceReferenceFile
        ? sourceReferenceUpload
          ? `Ready: ${sourceReferenceFile.name || "source image"}. This reviewed upload will be reused.`
          : `Selected: ${sourceReferenceFile.name || "source image"}. This file will be used instead of the URL.`
        : "No source image selected. You can still use a URL below.";
    }
    if (clearButton) {
      clearButton.disabled = !sourceReferenceFile;
    }
  }

  function setSourceReferenceFile(file, input = null) {
    if (file && !isSupportedReferencePhoto(file)) {
      sourceReferenceFile = null;
      sourceReferenceUpload = null;
      if (input) {
        input.value = "";
      }
      updateSourceReferenceUi();
      setLog("Choose a JPG, PNG, WebP, AVIF, or HEIC/HEIF source image.", "error");
      return false;
    }
    sourceReferenceFile = file;
    sourceReferenceUpload = null;
    updateSourceReferenceUi();
    return true;
  }

  async function sourceReferenceArgs() {
    if (!sourceReferenceFile) {
      const sourceImageUrl = inputValue("remix-camera-source-image-url");
      return sourceImageUrl ? { sourceImageUrl } : {};
    }
    if (!sourceReferenceUpload) {
      sourceReferenceUpload = await uploadReferenceFile(
        sourceReferenceFile,
        "source image",
      );
      updateSourceReferenceUi();
    }
    return {
      sourceReferenceImageId: sourceReferenceUpload.id,
    };
  }

  async function coupleReferenceArgs() {
    if (!coupleReferenceFile) {
      return {};
    }
    if (!coupleReferenceUpload) {
      coupleReferenceUpload = await uploadReferenceFile(
        coupleReferenceFile,
        "user photo",
      );
      updateCoupleReferenceUi();
    }
    return {
      userReferenceImageId: coupleReferenceUpload.id,
    };
  }

  async function userIncludedArgs(commandLabel) {
    const userConsent = inputChecked("remix-camera-user-consent") ? "yes" : "";
    if (userConsent !== "yes") {
      setLog(`${commandLabel} needs user-inclusion consent. Check the consent box only after the user clearly asked to appear.`, "warn");
      return null;
    }
    const userDescription = inputValue("remix-camera-user-description") ||
      (coupleReferenceFile ? "the adult man in the uploaded reference photo" : "the user, a consenting adult");
    return {
      userConsent,
      userDescription,
      ...(await coupleReferenceArgs()),
    };
  }

  function parseTimeMinutes(value) {
    const match = String(value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) {
      return null;
    }
    const hours = Math.max(0, Math.min(23, Number(match[1])));
    const minutes = Math.max(0, Math.min(59, Number(match[2])));
    return hours * 60 + minutes;
  }

  function withinQuietHours(current = settings(), now = new Date()) {
    const start = parseTimeMinutes(current.proactiveSnapQuietStart);
    const end = parseTimeMinutes(current.proactiveSnapQuietEnd);
    if (start === null || end === null || start === end) {
      return false;
    }
    const minute = now.getHours() * 60 + now.getMinutes();
    return start < end
      ? minute >= start && minute < end
      : minute >= start || minute < end;
  }

  function hasActiveVisibleChat() {
    if (document.visibilityState && document.visibilityState !== "visible") {
      return false;
    }
    const context = getContext();
    const chat = Array.isArray(context?.chat) ? context.chat : [];
    if (!chat.length || !document.querySelector("#chat .mes")) {
      return false;
    }
    const latest = latestUserMessage(chat);
    if (!latest) {
      return false;
    }
    const message = chat[latest.index];
    const sentAt = messageTimeMs(message);
    return !sentAt || Date.now() - sentAt <= 6 * 60 * 60 * 1000;
  }

  function todayKey() {
    return new Date().toISOString().slice(0, 10);
  }

  function proactiveSnapCountForToday(current = settings()) {
    return current.proactiveSnapDate === todayKey() ? Number(current.proactiveSnapCount || 0) : 0;
  }

  function recordProactiveSnapSent() {
    const current = settings();
    updateSettings({
      proactiveSnapDate: todayKey(),
      proactiveSnapCount: proactiveSnapCountForToday(current) + 1,
      proactiveSnapLastSentAt: Date.now(),
    });
  }

  async function maybeSendProactiveSnap() {
    const current = settings();
    if (!current.proactiveSnapsEnabled || Number(current.proactiveSnapDailyLimit || 0) <= 0) {
      return;
    }
    if (proactiveSnapCountForToday(current) >= Number(current.proactiveSnapDailyLimit || 0)) {
      return;
    }
    if (withinQuietHours(current)) {
      return;
    }
    if (current.proactiveSnapRequireActiveChat && !hasActiveVisibleChat()) {
      return;
    }
    if (!current.profileId && !current.referenceImageKey) {
      setLog("Proactive snap skipped. Set this character's Remix.Camera profile first.", "warn");
      return;
    }
    try {
      await generate("private-snap", {
        mood: "spontaneous private snap, intimate, in-character, camera-aware",
        location: current.location || "private setting that fits the recent chat",
        maxGenerations: 1,
        matureContent: true,
      });
      recordProactiveSnapSent();
    } catch (error) {
      setLog(error.message, "error");
    }
  }

  function scheduleProactiveSnaps() {
    if (proactiveSnapTimer) {
      window.clearInterval(proactiveSnapTimer);
      proactiveSnapTimer = null;
    }
    const current = settings();
    if (!current.proactiveSnapsEnabled) {
      return;
    }
    const intervalMs = Math.max(30, Number(current.proactiveSnapIntervalMinutes || DEFAULT_SETTINGS.proactiveSnapIntervalMinutes)) * 60 * 1000;
    proactiveSnapTimer = window.setInterval(maybeSendProactiveSnap, intervalMs);
  }

  function saveFromUi() {
    updateSettings({
      bridgeUrl: inputValue("remix-camera-bridge-url") || DEFAULT_SETTINGS.bridgeUrl,
      profileId: cleanProfileId(inputValue("remix-camera-profile-id")),
      referenceImageKey: inputValue("remix-camera-reference-image-key"),
      characterName: inputValue("remix-camera-character-name"),
      gender: inputValue("remix-camera-gender"),
      bio: inputValue("remix-camera-bio"),
      mood: inputValue("remix-camera-mood"),
      outfit: inputValue("remix-camera-outfit"),
      location: inputValue("remix-camera-location"),
      style: inputValue("remix-camera-style"),
      visualIdentity: inputValue("remix-camera-visual-identity"),
      negativePrompt: inputValue("remix-camera-negative-prompt"),
      maxGenerations: Math.max(1, Math.min(4, Number(inputValue("remix-camera-max-generations") || 1))),
      matureContent: inputChecked("remix-camera-mature-content"),
      allowToolCalls: inputChecked("remix-camera-allow-tool-calls"),
      autoInsertResult: inputChecked("remix-camera-auto-insert"),
      proactiveSnapsEnabled: inputChecked("remix-camera-proactive-snaps"),
      proactiveSnapIntervalMinutes: Math.max(30, Math.min(1440, Number(inputValue("remix-camera-proactive-interval") || DEFAULT_SETTINGS.proactiveSnapIntervalMinutes))),
      proactiveSnapDailyLimit: Math.max(0, Math.min(6, Number(inputValue("remix-camera-proactive-daily-limit") || DEFAULT_SETTINGS.proactiveSnapDailyLimit))),
      proactiveSnapQuietStart: inputValue("remix-camera-proactive-quiet-start") || DEFAULT_SETTINGS.proactiveSnapQuietStart,
      proactiveSnapQuietEnd: inputValue("remix-camera-proactive-quiet-end") || DEFAULT_SETTINGS.proactiveSnapQuietEnd,
      proactiveSnapRequireActiveChat: inputChecked("remix-camera-proactive-active-chat"),
    });
    if (settings().allowToolCalls) {
      registerFunctionTools();
    } else {
      unregisterFunctionTools();
    }
    scheduleProactiveSnaps();
  }

  function refreshUiFromSettings() {
    const current = settings();
    setInputValue("remix-camera-bridge-url", current.bridgeUrl);
    setInputValue("remix-camera-character-name", current.characterName);
    setInputValue("remix-camera-gender", current.gender);
    setInputValue("remix-camera-bio", current.bio);
    setInputValue("remix-camera-profile-id", current.profileId);
    setInputValue("remix-camera-reference-image-key", current.referenceImageKey);
    setInputValue("remix-camera-max-generations", Number(current.maxGenerations || 1));
    setInputValue("remix-camera-mood", current.mood);
    setInputValue("remix-camera-outfit", current.outfit);
    setInputValue("remix-camera-location", current.location);
    setInputValue("remix-camera-style", current.style);
    setInputValue("remix-camera-visual-identity", current.visualIdentity);
    setInputValue("remix-camera-negative-prompt", current.negativePrompt);
    setInputChecked("remix-camera-mature-content", current.matureContent);
    setInputChecked("remix-camera-allow-tool-calls", current.allowToolCalls);
    setInputChecked("remix-camera-auto-insert", current.autoInsertResult);
    setInputChecked("remix-camera-proactive-snaps", current.proactiveSnapsEnabled);
    setInputValue("remix-camera-proactive-interval", Number(current.proactiveSnapIntervalMinutes || DEFAULT_SETTINGS.proactiveSnapIntervalMinutes));
    setInputValue("remix-camera-proactive-daily-limit", Number(current.proactiveSnapDailyLimit || DEFAULT_SETTINGS.proactiveSnapDailyLimit));
    setInputValue("remix-camera-proactive-quiet-start", current.proactiveSnapQuietStart || DEFAULT_SETTINGS.proactiveSnapQuietStart);
    setInputValue("remix-camera-proactive-quiet-end", current.proactiveSnapQuietEnd || DEFAULT_SETTINGS.proactiveSnapQuietEnd);
    setInputChecked("remix-camera-proactive-active-chat", current.proactiveSnapRequireActiveChat !== false);
    refreshFirstRunChecklist(current);
  }

  function settingsHtml() {
    const current = settings();
    return `
      <div id="remix-camera-companion-images" class="remix-camera-panel">
        <div class="remix-camera-profile">
          <label>Name<input id="remix-camera-character-name" type="text" value="${escapeHtml(current.characterName)}" placeholder="Character"></label>
          <label>Gender<input id="remix-camera-gender" type="text" value="${escapeHtml(current.gender)}" placeholder="female, male, nonbinary"></label>
          <label class="remix-camera-wide">Bio<textarea id="remix-camera-bio" rows="3">${escapeHtml(current.bio)}</textarea></label>
          <label class="remix-camera-check remix-camera-mature"><input id="remix-camera-mature-content" type="checkbox" ${current.matureContent ? "checked" : ""}> Mature mode</label>
          <div class="remix-camera-profile-card remix-camera-wide">
            <div>
              <strong>Character photos</strong>
              <span>Manage bio, gender, and photos in Remix.Camera; this extension uses the paired profile for identity.</span>
            </div>
            <a href="https://remix.camera/camera" target="_blank" rel="noopener noreferrer">Open Remix.Camera</a>
          </div>
        </div>
        <div class="remix-camera-first-run">
          <strong>First run checklist</strong>
          <ol>
            <li data-remix-camera-first-run="bridge" data-state="todo">Bridge health passed</li>
            <li data-remix-camera-first-run="profile" data-state="${current.profileId || current.referenceImageKey ? "done" : "todo"}">Character profile is connected</li>
            <li data-remix-camera-first-run="preview" data-state="todo">Preview prompt checked</li>
            <li data-remix-camera-first-run="image" data-state="todo">First image inserted</li>
          </ol>
        </div>
        <div class="remix-camera-utility-actions">
          <button id="remix-camera-health" type="button">Health Check</button>
          <button id="remix-camera-dry-run" type="button">Preview Prompt</button>
        </div>
        <div class="remix-camera-actions">
          <button id="remix-camera-selfie" class="remix-camera-quick remix-camera-quick--selfie" type="button"><span>Selfie</span></button>
          <button id="remix-camera-auto-selfie" class="remix-camera-quick remix-camera-quick--auto" type="button"><span>Scene</span></button>
          <button id="remix-camera-outfit-button" class="remix-camera-quick remix-camera-quick--outfit" type="button"><span>Outfit</span></button>
          <button id="remix-camera-couple-button" class="remix-camera-quick remix-camera-quick--couple" type="button"><span>Couple</span></button>
          <button id="remix-camera-vacation-button" class="remix-camera-quick remix-camera-quick--vacation" type="button"><span>Vacation</span></button>
          <button id="remix-camera-date-button" class="remix-camera-quick remix-camera-quick--date" type="button"><span>Date</span></button>
          <button id="remix-camera-daily-snap-button" class="remix-camera-quick remix-camera-quick--daily" type="button"><span>Day Snap</span></button>
          <button id="remix-camera-private-snap-button" class="remix-camera-quick remix-camera-quick--snap" type="button"><span>Private Snap</span></button>
        </div>
        <div class="remix-camera-action-inputs">
          <div class="remix-camera-source-reference remix-camera-wide">
            <strong>Remix from image</strong>
            <label id="remix-camera-source-image-dropzone" class="remix-camera-source-dropzone" for="remix-camera-source-image-file">
              <input id="remix-camera-source-image-file" type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif">
              <span>Drop an image here, or choose a file</span>
              <small>JPG, PNG, WebP, AVIF, or HEIC/HEIF. Large images are resized before upload.</small>
            </label>
            <div class="remix-camera-source-reference-row">
              <span id="remix-camera-source-image-status">No source image selected. You can still use a URL below.</span>
              <button id="remix-camera-source-image-clear" type="button" disabled>Clear</button>
            </div>
            <label>Or use an image URL<input id="remix-camera-source-image-url" type="url" placeholder="https://example.com/outfit.jpg"></label>
          </div>
          <label>Date setting<input id="remix-camera-date-location" type="text" value="${escapeHtml(current.location)}" placeholder="cozy restaurant booth with warm light"></label>
          <label>Vacation theme<input id="remix-camera-vacation-theme" type="text" value="${escapeHtml(current.location)}" placeholder="cohesive beach weekend getaway"></label>
          <label class="remix-camera-check remix-camera-wide"><input id="remix-camera-user-consent" type="checkbox"> User clearly asked to appear in the Couple/Vacation image</label>
          <label class="remix-camera-wide">User appearance or relationship context<textarea id="remix-camera-user-description" rows="2" placeholder="adult man in the uploaded reference photo, casual date-night mood"></textarea></label>
          <label class="remix-camera-check remix-camera-wide"><input id="remix-camera-private-consent" type="checkbox"> One mature private snap is explicitly requested</label>
        </div>
        <div class="remix-camera-couple-reference">
          <label class="remix-camera-wide">Your photo for Couple/Vacation<input id="remix-camera-couple-photo" type="file" accept="image/jpeg,image/png,image/webp,image/avif,image/heic,image/heif"></label>
          <div class="remix-camera-couple-reference-row">
            <span id="remix-camera-couple-photo-status">No user photo selected.</span>
            <button id="remix-camera-couple-photo-clear" type="button" disabled>Clear</button>
          </div>
        </div>
        <details class="remix-camera-advanced">
          <summary>Advanced</summary>
          <div class="remix-camera-grid">
            <label>Bridge URL<input id="remix-camera-bridge-url" type="text" value="${escapeHtml(current.bridgeUrl)}"></label>
            <label>Remix profile ID<input id="remix-camera-profile-id" type="text" value="${escapeHtml(current.profileId)}" placeholder="profile_..."></label>
            <label>Reference key<input id="remix-camera-reference-image-key" type="text" value="${escapeHtml(current.referenceImageKey)}"></label>
            <label>Max generations<input id="remix-camera-max-generations" type="number" min="1" max="4" value="${Number(current.maxGenerations || 1)}"></label>
            <label>Mood<input id="remix-camera-mood" type="text" value="${escapeHtml(current.mood)}"></label>
            <label>Outfit<input id="remix-camera-outfit" type="text" value="${escapeHtml(current.outfit)}"></label>
            <label>Location<input id="remix-camera-location" type="text" value="${escapeHtml(current.location)}"></label>
            <label>Style<input id="remix-camera-style" type="text" value="${escapeHtml(current.style)}"></label>
            <label>Proactive interval<input id="remix-camera-proactive-interval" type="number" min="30" max="1440" value="${Number(current.proactiveSnapIntervalMinutes || DEFAULT_SETTINGS.proactiveSnapIntervalMinutes)}"></label>
            <label>Proactive daily cap<input id="remix-camera-proactive-daily-limit" type="number" min="0" max="6" value="${Number(current.proactiveSnapDailyLimit || DEFAULT_SETTINGS.proactiveSnapDailyLimit)}"></label>
            <label>Quiet start<input id="remix-camera-proactive-quiet-start" type="time" value="${escapeHtml(current.proactiveSnapQuietStart || DEFAULT_SETTINGS.proactiveSnapQuietStart)}"></label>
            <label>Quiet end<input id="remix-camera-proactive-quiet-end" type="time" value="${escapeHtml(current.proactiveSnapQuietEnd || DEFAULT_SETTINGS.proactiveSnapQuietEnd)}"></label>
          </div>
          <label class="remix-camera-wide">Visual identity<textarea id="remix-camera-visual-identity" rows="3">${escapeHtml(current.visualIdentity)}</textarea></label>
          <label class="remix-camera-wide">Avoid<textarea id="remix-camera-negative-prompt" rows="2">${escapeHtml(current.negativePrompt)}</textarea></label>
          <label class="remix-camera-check"><input id="remix-camera-allow-tool-calls" type="checkbox" ${current.allowToolCalls ? "checked" : ""}> Allow character tool calls</label>
          <label class="remix-camera-check"><input id="remix-camera-auto-insert" type="checkbox" ${current.autoInsertResult ? "checked" : ""}> Insert generated image in chat</label>
          <label class="remix-camera-check"><input id="remix-camera-proactive-snaps" type="checkbox" ${current.proactiveSnapsEnabled ? "checked" : ""}> Proactive private snaps</label>
          <label class="remix-camera-check"><input id="remix-camera-proactive-active-chat" type="checkbox" ${current.proactiveSnapRequireActiveChat !== false ? "checked" : ""}> Only when this chat is open and active</label>
        </details>
        <pre id="remix-camera-log" data-type="info">Bridge not checked yet.</pre>
      </div>
    `;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function bindUi() {
    const panel = document.getElementById("remix-camera-companion-images");
    if (!panel) {
      return;
    }

    panel.querySelectorAll("input, textarea, select").forEach((input) => {
      input.addEventListener("change", saveFromUi);
      input.addEventListener("blur", saveFromUi);
    });

    document.getElementById("remix-camera-health")?.addEventListener("click", async () => {
      saveFromUi();
      try {
        const health = await checkHealth();
        const authMode = health.authMode === "design_api_session"
          ? "paired session"
          : health.authMode === "api_key"
            ? "API key"
            : "missing";
        setLog(
          `Bridge OK. Auth: ${authMode}. Default profile: ${health.defaultProfileId || "none"}.`,
          health.hasSessionToken || health.hasApiKey ? "success" : "warn",
        );
        setFirstRunStep("bridge", "done");
      } catch (error) {
        setLog(error.message, "error");
      }
    });

    document.getElementById("remix-camera-dry-run")?.addEventListener("click", async () => {
      saveFromUi();
      try {
        await dryRun("auto-selfie-from-chat");
      } catch (error) {
        setLog(error.message, "error");
      }
    });

    document.getElementById("remix-camera-couple-photo")?.addEventListener("change", (event) => {
      const file = event.currentTarget?.files?.[0] || null;
      if (file && !isSupportedReferencePhoto(file)) {
        coupleReferenceFile = null;
        coupleReferenceUpload = null;
        event.currentTarget.value = "";
        updateCoupleReferenceUi();
        setLog("Choose a JPG, PNG, WebP, AVIF, or HEIC/HEIF couple reference photo.", "error");
        return;
      }
      coupleReferenceFile = file;
      coupleReferenceUpload = null;
      updateCoupleReferenceUi();
    });

    const sourceImageInput = document.getElementById("remix-camera-source-image-file");
    const sourceImageDropzone = document.getElementById("remix-camera-source-image-dropzone");
    sourceImageInput?.addEventListener("change", (event) => {
      setSourceReferenceFile(event.currentTarget?.files?.[0] || null, event.currentTarget);
    });
    ["dragenter", "dragover"].forEach((eventName) => {
      sourceImageDropzone?.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();
        sourceImageDropzone.dataset.dragging = "true";
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = "copy";
        }
      });
    });
    ["dragleave", "drop"].forEach((eventName) => {
      sourceImageDropzone?.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();
        delete sourceImageDropzone.dataset.dragging;
      });
    });
    sourceImageDropzone?.addEventListener("drop", (event) => {
      setSourceReferenceFile(event.dataTransfer?.files?.[0] || null, sourceImageInput);
    });
    document.getElementById("remix-camera-source-image-clear")?.addEventListener("click", () => {
      sourceReferenceFile = null;
      sourceReferenceUpload = null;
      if (sourceImageInput) {
        sourceImageInput.value = "";
      }
      updateSourceReferenceUi();
    });

    document.getElementById("remix-camera-couple-photo-clear")?.addEventListener("click", () => {
      coupleReferenceFile = null;
      coupleReferenceUpload = null;
      const input = document.getElementById("remix-camera-couple-photo");
      if (input) {
        input.value = "";
      }
      updateCoupleReferenceUi();
    });

    document.getElementById("remix-camera-selfie")?.addEventListener("click", async () => {
      saveFromUi();
      try {
        await generate("send-selfie");
      } catch (error) {
        setLog(error.message, "error");
      }
    });

    document.getElementById("remix-camera-auto-selfie")?.addEventListener("click", async () => {
      saveFromUi();
      try {
        await generate("auto-selfie-from-chat");
      } catch (error) {
        setLog(error.message, "error");
      }
    });

    document.getElementById("remix-camera-outfit-button")?.addEventListener("click", async () => {
      saveFromUi();
      if (!sourceReferenceFile && !inputValue("remix-camera-source-image-url")) {
        setLog("Drop in a source image or add an image URL before using Outfit.", "warn");
        return;
      }
      try {
        await generate("outfit-try-on", await sourceReferenceArgs());
      } catch (error) {
        setLog(error.message, "error");
      }
    });

    document.getElementById("remix-camera-couple-button")?.addEventListener("click", async () => {
      saveFromUi();
      const args = await userIncludedArgs("couple photo");
      if (!args) {
        return;
      }
      try {
        await generate("couple-photo", args);
      } catch (error) {
        setLog(error.message, "error");
      } finally {
        setInputChecked("remix-camera-user-consent", false);
      }
    });

    document.getElementById("remix-camera-vacation-button")?.addEventListener("click", async () => {
      saveFromUi();
      const args = await userIncludedArgs("couples vacation set");
      if (!args) {
        return;
      }
      const theme = inputValue("remix-camera-vacation-theme") || settings().location || "cohesive beach weekend getaway";
      try {
        await generate("couples-vacation", {
          ...args,
          theme,
          location: theme || settings().location,
          maxGenerations: 3,
        });
      } catch (error) {
        setLog(error.message, "error");
      } finally {
        setInputChecked("remix-camera-user-consent", false);
      }
    });

    document.getElementById("remix-camera-date-button")?.addEventListener("click", async () => {
      saveFromUi();
      const location = inputValue("remix-camera-date-location") || settings().location || "cozy restaurant booth with warm light";
      try {
        await generate("date-night", { location });
      } catch (error) {
        setLog(error.message, "error");
      }
    });

    document.getElementById("remix-camera-daily-snap-button")?.addEventListener("click", async () => {
      saveFromUi();
      try {
        await generate("daily-life-snap");
      } catch (error) {
        setLog(error.message, "error");
      }
    });

    document.getElementById("remix-camera-private-snap-button")?.addEventListener("click", async () => {
      saveFromUi();
      if (!inputChecked("remix-camera-private-consent")) {
        setLog("Check the private snap consent box before generating one mature private snap.", "warn");
        return;
      }
      try {
        await generate("private-snap", {
          matureContent: true,
        });
      } catch (error) {
        setLog(error.message, "error");
      } finally {
        setInputChecked("remix-camera-private-consent", false);
      }
    });

    updateSourceReferenceUi();
    updateCoupleReferenceUi();
    scheduleProactiveSnaps();
    scheduleStalePendingCleanup();
  }

  function addSettingsPanel() {
    if (document.getElementById("remix-camera-companion-images")) {
      return;
    }

    const container =
      document.getElementById("extensions_settings2") ||
      document.getElementById("extensions_settings") ||
      document.querySelector("#extensions_settings") ||
      document.body;

    const wrapper = document.createElement("details");
    wrapper.className = "remix-camera-settings-wrapper";
    wrapper.open = false;
    wrapper.innerHTML = `
      <summary>Remix.Camera Companion Images</summary>
      ${settingsHtml()}
    `;
    container.appendChild(wrapper);
    bindUi();
  }

  function canRegisterTools() {
    const context = getContext();
    const supported =
      typeof context?.isToolCallingSupported !== "function" ||
      context.isToolCallingSupported();
    const canPerform =
      typeof context?.canPerformToolCalls !== "function" ||
      context.canPerformToolCalls("normal");
    return Boolean(settings().allowToolCalls && supported && canPerform);
  }

  function toolDefinition(name, command, displayName, description, parameterProperties = {}) {
    return {
      name,
      displayName,
      description,
      parameters: {
        $schema: "http://json-schema.org/draft-04/schema#",
        type: "object",
        properties: {
          mood: { type: "string", description: "Desired emotional tone for the image." },
          outfit: { type: "string", description: "Wardrobe or outfit direction." },
          location: { type: "string", description: "Scene or room." },
          visualIdentity: { type: "string", description: "Character visual anchors to preserve in the image." },
          sourceImageUrl: { type: "string", description: "Optional source image URL." },
          userDescription: { type: "string", description: "Optional user appearance for couple photos." },
          userConsent: { type: "string", enum: ["yes"], description: "Use yes only when the user clearly asked to appear." },
          userReferenceImageKey: { type: "string", description: "Optional Remix.Camera reference image s3Key for the user in couple photos." },
          userReferenceImageUrl: { type: "string", description: "Optional image URL to upload and use as the user reference in couple photos." },
          theme: { type: "string", description: "Theme or destination for a cohesive photo set." },
          ...parameterProperties,
        },
      },
      shouldRegister: canRegisterTools,
      action: async (args) => generate(command, args || {}),
      formatMessage: () => `Generating ${displayName} with Remix.Camera...`,
      stealth: false,
    };
  }

  function registerFunctionTools() {
    if (functionToolsRegistered) {
      return true;
    }

    const context = getContext();
    const register =
      window.registerFunctionTool ||
      context?.registerFunctionTool ||
      window.SillyTavern?.registerFunctionTool;

    if (typeof register !== "function") {
      return false;
    }

    let registeredCount = 0;
    [
      toolDefinition(TOOL_NAMES[0], "send-selfie", "Send selfie", "Generate an in-character selfie with Remix.Camera."),
      toolDefinition(
        TOOL_NAMES[1],
        "auto-selfie-from-chat",
        "Auto selfie from chat",
        "Generate an in-character selfie based on recent SillyTavern chat context.",
      ),
      toolDefinition(TOOL_NAMES[2], "outfit-try-on", "Outfit try-on", "Create an outfit try-on image from a source image URL."),
      toolDefinition(TOOL_NAMES[3], "couple-photo", "Couple photo", "Create a tasteful couple image after explicit user consent."),
      toolDefinition(TOOL_NAMES[4], "couples-vacation", "Couples vacation", "Create a cohesive three-photo couples vacation set after explicit user consent.", {
        maxGenerations: { type: "number", description: "Use 3 for the default vacation photo set." },
      }),
      toolDefinition(TOOL_NAMES[5], "date-night", "Date night", "Create an in-character date-night image that matches the conversation."),
      toolDefinition(TOOL_NAMES[6], "daily-life-snap", "Daily life snap", "Create a casual in-the-moment snap from recent chat context."),
      toolDefinition(TOOL_NAMES[7], "private-snap", "Private snap", "Create an opted-in mature private snap."),
    ].forEach((definition) => {
      try {
        register(definition);
        registeredCount += 1;
      } catch (error) {
        console.warn(`[${EXTENSION_NAME}] Failed to register ${definition.name}`, error);
      }
    });

    functionToolsRegistered = registeredCount > 0;
    return functionToolsRegistered;
  }

  function unregisterFunctionTools() {
    const context = getContext();
    const unregister =
      window.unregisterFunctionTool ||
      context?.unregisterFunctionTool ||
      window.SillyTavern?.unregisterFunctionTool;

    if (typeof unregister !== "function") {
      functionToolsRegistered = false;
      return false;
    }

    TOOL_NAMES.forEach((name) => {
      try {
        unregister(name);
      } catch (error) {
        console.warn(`[${EXTENSION_NAME}] Failed to unregister ${name}`, error);
      }
    });
    functionToolsRegistered = false;
    return true;
  }

  function bindLifecycleEvents() {
    if (lifecycleEventsBound) {
      return;
    }

    const context = getContext();
    const eventSource = context?.eventSource;
    const eventTypes = context?.eventTypes || context?.event_types;
    if (!eventSource || typeof eventSource.on !== "function" || !eventTypes) {
      return;
    }

    [eventTypes.CHAT_CHANGED, eventTypes.CHARACTER_EDITED].filter(Boolean).forEach((eventName) => {
      eventSource.on(eventName, () => {
        window.setTimeout(refreshUiFromSettings, 0);
      });
    });
    lifecycleEventsBound = true;
  }

  function init() {
    getRootSettings();
    addSettingsPanel();
    refreshUiFromSettings();
    bindFeedbackEvents();
    bindLifecycleEvents();
    if (!registerFunctionTools()) {
      window.setTimeout(registerFunctionTools, 1000);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
