# LibreChat Adapter

Setup:

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=librechat
```

Add an OpenAPI Action from:

```text
http://127.0.0.1:8787/librechat/openapi.json
```

The schema includes both preview and generation endpoints:

```text
POST /v1/tools/:command/dry-run
POST /v1/tools/:command/generate
```

Generation endpoints require `yes=true`.

