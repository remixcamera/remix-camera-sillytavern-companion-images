# Twilio SMS/MMS Adapter

The Twilio adapter lets an SMS/MMS webhook call the local Remix.Camera bridge and send generated companion images through the Twilio Messages API.

## Setup

```bash
npx --yes github:remixcamera/remix-camera-sillytavern-companion-images --target=twilio
```

## Reusable Tool

```js
import { createRemixTwilioMmsTool } from "./adapters/twilio/remix-twilio-mms-tool.mjs";

const remix = createRemixTwilioMmsTool({
  accountSid: process.env.TWILIO_ACCOUNT_SID,
  authToken: process.env.TWILIO_AUTH_TOKEN,
  from: process.env.TWILIO_FROM,
  messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
  bridgeUrl: "http://127.0.0.1:8787",
  profileId: process.env.REMIX_PROFILE_ID,
  characterName: "Lily",
});
```

For an inbound webhook body:

```js
const details = await remix.handleInboundDetailed(requestBody, {
  autoSend: false,
});
```

When `autoSend` is enabled, the adapter replies to the inbound sender using either `From` or `MessagingServiceSid`. It parses text such as:

```text
selfie cozy couch with lamp light
preview date quiet restaurant booth
couple yes coffee shop booth with me
snap yes warm bedroom mirror snap
```

Couple, vacation, and private commands require explicit `yes` before any generation request is sent to the bridge.

## Delivery Notes

Twilio MMS media must be reachable through public HTTPS `MediaUrl` values. The adapter prefers the bridge result's `productionImageUrl`; it does not send local `127.0.0.1` bridge URLs as MMS media.

SMS/MMS cannot force-delete delivered media. Private snaps include conservative copy that points users to carrier/device deletion controls rather than promising disappearing media.
