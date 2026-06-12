# Agnai Demo

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=agnai
```

Install this userscript in Tampermonkey or a compatible userscript manager:

```text
adapters/agnai/remix-camera-agnai.user.js
```

## Demo Flow

1. Open `https://agnai.chat`.
2. Open a companion chat.
3. Use the floating Remix.Camera panel to run `Selfie preview`.
4. Confirm the selected prompt is copied or inserted.
5. Run `Selfie` to generate real image markdown.
6. Paste/send the markdown into Agnai if it was not inserted automatically.

## Proof Points

- The userscript runs on Agnai without needing an official Agnai plugin API.
- It calls the local bridge with Agnai allowed by CORS.
- It previews before spending and copies/inserts real generated markdown.

