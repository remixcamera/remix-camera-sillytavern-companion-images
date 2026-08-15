# Changelog

## Unreleased

## 0.4.0-alpha.3 - 2026-08-14

- Repairs the legacy Lobe custom-plugin gateway route and adds browser private-network CORS support for approved origins.
- Makes native MCP the recommended path for LobeHub and LibreChat, adds Jan setup, and documents Dify container networking.
- Adds RisuAI API v3 updater metadata and a VM-level plugin contract test.
- Makes hosted Risu chats render public production image URLs instead of localhost bridge URLs, with a real generated-image demo using the user name Chris.
- Removes the redundant Open WebUI `pydantic` frontmatter requirement that current isolated hosts can reject.
- Aligns package, root and installed SillyTavern manifests, bridge health, Risu, Open WebUI, and MCP release metadata.
- Documents the MCP `2025-11-25` compatibility boundary and the local-only security boundary for Dify Docker access.
- Preserves the privacy-safe install telemetry, fresh-clone setup coverage, Telegram contextual image fix, and Sophie/Mila/Lily case studies released in the standalone `0.4.0-alpha.2` line.
- Adds a reproducible setup E2E command and keeps generated Python caches and temporary demo reports out of npm tarballs.

## 0.4.0-alpha.2 - 2026-08-12

- Adds privacy-safe, source-tagged telemetry for install, pairing, setup, bridge, and first-image milestones.
- Stores no account identity, IP address, hostname, prompt, chat text, or generated image URL in the install record.
- Adds `--source`, `--no-telemetry`, `DO_NOT_TRACK`, and `REMIX_TELEMETRY_DISABLED` controls.
- Replaces the default hostname-derived device label with a generic local-bridge label.

## 0.4.0-alpha.1 - 2026-07-21

- Positions the package as a public-preview image layer for existing AI companion chats.
- Adds the Sophie character-card-to-mirror-selfie setup demo and landing-page proof.
- Aligns the package and SillyTavern extension manifest versions.
- Adds an MIT license for open-source reuse and distribution.
- Documents secure Remix.Camera account pairing, pinned installation, and first-image activation.
