# Early-access integration

This is the current contract implemented in `api/`. Local static preview behavior is documented in [README.md](./README.md); this file covers the optional Vercel + Resend path.

## System boundary

- Vercel serves the static pages and functions in `api/`.
- Resend sends confirmation messages and stores confirmed Contacts.
- No database stores pending signups. An encrypted token carries the pending address for 24 hours.
- Browser code never receives provider credentials or token keys.
- The current deployment is non-indexed through `vercel.json` and `robots.txt`.

## Runtime modes

| Mode | Behavior |
| --- | --- |
| `disabled` | Returns the neutral `202 {"ok":true}` response without contacting Resend. This is the code default when `SIGNUP_MODE` is unset. |
| `preview` | Allows only `TEST_RECIPIENT_EMAIL`, uses the test Segment and Topic, and records `signup_source: shareable_preview`. |
| `canary` | Uses production resources but remains owner-only through `TEST_RECIPIENT_EMAIL`. |
| `live` | Accepts public requests and uses the production Segment and Topic. |

The tracked `.env.example` is a template for deliberate owner integration testing. It must not be treated as a public deployment configuration.

## Routes

### `POST /api/early-access`

1. Require a same-origin JSON request no larger than 2 KB.
2. Normalize the email by trimming whitespace and lowercasing only the domain.
3. Return `400` for malformed syntax, `403` for a foreign origin, and a neutral `202` for disabled, disallowed, duplicate, or accepted addresses.
4. In an active mode, check the selected Resend Segment and Topic.
5. Create an AES-GCM token with a 24-hour expiry and the active mode.
6. Send the published Resend confirmation Template with a keyed, address-independent idempotency key.

Provider failures return a generic `503`. Public responses do not reveal whether an address already exists or is subscribed.

### `GET /api/confirm?token=...`

The function authenticates and decrypts the token, checks its audience, consent version, expiry, and mode, then idempotently creates or updates the Resend Contact. It adds the Contact to the mode-selected Segment and opts it into the mode-selected Topic. The response redirects to `/earlyaccess/confirmed/?status=success`, `temporary`, or `invalid` without exposing the address.

### `POST /api/resend-webhook`

The function verifies the raw payload and Svix headers before parsing. Permanent bounces, complaints, and suppressions unsubscribe an existing Contact and opt it out of the active Topic. Delayed and failed events are logged only as sanitized categories. Other events do not change consent.

### `GET /api/health`

Returns `{ "ok": true }` when the active configuration resolves and `503 { "ok": false }` otherwise. Responses are non-cacheable and non-indexed.

## Environment variables

The names below are read by `api/_lib/config.js`:

```text
SIGNUP_MODE=disabled|preview|canary|live
PUBLIC_SITE_URL=
BRAND_NAME=SURGE
RESEND_API_KEY=
RESEND_WEBHOOK_SECRET=
RESEND_FROM_EMAIL=
RESEND_CONFIRM_TEMPLATE_ID=
RESEND_EARLY_ACCESS_SEGMENT_ID=
RESEND_TEST_SEGMENT_ID=
RESEND_EARLY_ACCESS_TOPIC_ID=
RESEND_TEST_TOPIC_ID=
SIGNUP_TOKEN_KEY_CURRENT=
SIGNUP_TOKEN_KEY_PREVIOUS=
SIGNUP_IDEMPOTENCY_SECRET=
TEST_RECIPIENT_EMAIL=
PRIVACY_URL=
BUSINESS_POSTAL_ADDRESS=
```

Active modes require the Resend key, webhook secret, sender, template, matching Segment and Topic IDs, a 32-byte base64url token key, and an idempotency secret. `preview` and `canary` also require the normalized test address. `canary` and `live` require HTTPS privacy and postal-address values.

Store all real values in server-side environment variables. Never commit them or expose them to branch previews.

## Current security controls

- Same-origin JSON signup only; 2 KB body limit.
- Strict email normalization without changing local-part semantics.
- AES-GCM authenticated tokens with key IDs, mode binding, and expiry.
- Previous token key support for rotation during the 24-hour token lifetime.
- Generic public errors and `Cache-Control: no-store` on API responses.
- Webhook signature verification before event handling.
- Site-wide noindex, CSP, frame blocking, `nosniff`, restrictive permissions, and non-indexed confirmation results.
- Client-side honeypot and fast-submit signal; deployment-level rate limiting and bot protection remain hosting configuration rather than application code.

## Verification

From this directory:

```sh
npm run validate
npm run typecheck
npm test
npm run test:browser
```

Run the complete `npm run check` suite before an owner-approved deployment. Use [RESEND_SETUP.md](./RESEND_SETUP.md) only when testing a real provider integration.
