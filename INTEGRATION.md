# Early-access integration

This document records the implemented Vercel + Resend double-opt-in contract and the remaining provider/deployment configuration. The code remains non-transmitting when `SIGNUP_MODE=disabled`; no real email can send until the Production environment variables and Resend resources are configured.

## Deployment identity

- The final brand name and public domain are intentionally deferred.
- Initial origin: the temporary `*.vercel.app` URL assigned to the Vercel project.
- `pocketsurge.com` was considered but is not a selected or purchased domain.
- The final Resend sending subdomain and sender address will be chosen after the brand name is settled.
- The initial deployment is public by link but carries `noindex, nofollow` directives and is not advertised.
- Preview signup is restricted server-side to one allowlisted owner email. Other addresses are neither stored nor emailed.
- The allowlisted owner can exercise the complete submission and confirmation journey using Resend's testing sender.
- Enable confirmation emails to the public only after the final domain is registered, DNS is connected to Vercel, and its sending subdomain is verified in Resend.
- While the project remains on Vercel Hobby, sharing is limited to an unlisted, non-indexed usability test with the owner and at most five personally invited friends. Only the owner email can transmit; invited viewers cannot enroll.
- This limited Hobby use retains terms ambiguity because the prototype supports a future commercial product. Upgrade promptly or remove the deployment if Vercel determines it is commercial use.
- Vercel Pro is mandatory before broad public URL sharing, launch promotion, `SIGNUP_MODE=canary`, or `SIGNUP_MODE=live`.

## Routing and indexing

- Redirect `/` to the canonical `/homepage/` route.
- Normalize `/homepage`, `/homepage/index.html`, `/earlyaccess`, and `/earlyaccess/index.html` to their trailing-slash canonical routes without redirect loops.
- Keep navigation links root-relative so they work on the Vercel domain and any later custom domain.
- During the shareable preview, apply `noindex, nofollow, noarchive` response headers and a disallowing `robots.txt` across the site.
- At public cutover, remove the site-wide blocking header and permit indexing for the homepage and early-access page only. Keep `/earlyaccess/confirmed/` and all API responses permanently non-indexed.

## System boundary

- Vercel hosts the static site and the server-side functions in `/api`.
- Resend sends the confirmation email and is the sole permanent store for confirmed subscribers.
- Pending signups are not added to Resend Contacts.
- An authenticated, encrypted, expiring confirmation token carries the pending email without requiring a separate database.
- Browser code never receives the Resend API key or the token-encryption keys.

## Git and deployment policy

- `main` is Vercel's production branch and updates the stable shareable-preview URL automatically.
- Development work is committed and pushed only to feature branches, never directly to `main`.
- Every change reaches `main` through a pull request.
- Only the repository owner approves a stable deployment. The owner's manual pull-request merge is that approval; no second reviewer is required.
- Merging the pull request is the explicit release action; no merge means no stable deployment.
- Vercel branch and pull-request deployments remain temporary previews and do not replace the stable shareable-preview URL.
- Branch protection or a repository ruleset should enforce this workflow when the GitHub account plan supports protection for private repositories. Otherwise it remains a mandatory project convention until that protection is available.

### Required pull-request evidence

Before the owner merges a pull request, its automated checks must pass:

- HTML, CSS, and JavaScript validation
- Internal navigation and asset-path checks
- Browser checks at 320, 375, 768, 1024, and 1440 CSS pixels
- Horizontal-overflow assertions
- Signup API tests with mocked Resend responses
- Confirmation-token validity, expiry, tampering, and idempotency tests

Do not send a real confirmation email on every commit. Run one manual owner-only Resend end-to-end test before the first stable deployment and whenever the email flow changes materially.

### Environment isolation

- Vercel Production is the stable, owner-approved shareable preview. While `SIGNUP_MODE=preview`, it alone receives Resend test credentials and can email only `TEST_RECIPIENT_EMAIL`.
- Vercel Preview covers temporary branch and pull-request deployments. It uses `SIGNUP_MODE=disabled`, receives no Resend secret, and cannot send or store signup data.
- Local development mocks email by default. A gitignored local environment file may enable a deliberate owner-only integration test.
- Supported modes are `disabled`, `preview`, `canary`, and `live`.
- `preview`: owner-only delivery using the test Segment and private test Topic.
- `canary`: owner-only delivery on the final domain using the verified production sender, production Segment, and public Topic while site-wide indexing remains blocked.
- `live`: public double opt-in using production resources.
- When the public launch is approved, the stable environment changes from `canary` to `live`; branch previews remain `disabled`.

### Secret handling

- Before any local secret is created, update `.gitignore` to exclude `.env.local` and environment-specific local secret files.
- Store the local Resend key and owner allowlist only in the repository-root `.env.local`; never place real values in documentation, example files, shell history, source code, or chat.
- Store deployed values as Sensitive Vercel environment variables scoped to Production only.
- Do not provide Resend credentials to Vercel Preview deployments or GitHub Actions.
- Validate secret presence and format without printing values. Sanitize all command output and runtime logs.
- Keep the authoritative backup of secrets in the owner's secure password manager. Rotate a key immediately if it is exposed.
- Use one dedicated Full-access Resend API key for the owner-only preview and initial public launch because the server must both send email and manage Contacts, Segments, and Topics.
- Do not schedule routine key rotation initially. Replace the key if it is exposed, access ownership changes, or Resend requires rotation.

## Public signup contract

`POST /api/early-access`

Request:

```json
{
  "email": "person@example.com"
}
```

For every syntactically valid email, return the same response:

```http
HTTP/1.1 202 Accepted
Content-Type: application/json

{"ok":true}
```

The response must not reveal whether the address is new, awaiting confirmation, already confirmed, or unsubscribed.

Private server behavior:

1. Normalize and validate the email.
2. Resolve the active signup mode and its permitted Segment and Topic. `disabled` never transmits; `preview` uses test resources; `canary` and `live` use production resources.
3. In `preview` or `canary`, discard any address other than `TEST_RECIPIENT_EMAIL` and return the neutral `202` response without calling Resend.
4. Look up the email in Resend Contacts and check membership in the mode-selected Segment and Topic.
5. If the Contact is subscribed and already belongs to both selected resources, perform no subscriber mutation and return the neutral `202` response.
6. If the Contact is absent, unsubscribed, or not subscribed to the selected resources, create an authenticated encrypted confirmation token containing the current mode and a 24-hour expiry, then send the confirmation Template.
7. Return the neutral `202` response without exposing subscriber status.

Invalid syntax may return `400 {"error":"invalid_email"}` because that reflects the submitted value, not subscriber status. Provider failures should return a generic temporary error. Requests rejected by the configured abuse controls return a generic rate-limit or unavailable response without exposing subscriber status.

## Abuse protection

- Apply the Hobby plan's single Vercel WAF rate-limit rule to `POST /api/early-access`: five attempts per IP or supported browser fingerprint in a fixed 10-minute window, followed by `429 Too Many Requests`.
- Enable Vercel's managed bot-protection ruleset in challenge mode.
- Include an off-screen honeypot input. A populated honeypot is treated as automated traffic and never sends or stores data.
- Include a form-render timestamp and reject submissions completed implausibly quickly. The server must not rely on this signal by itself.
- Permit at most one confirmation email per normalized address in 24 hours. Enforce this statelessly with Resend's 24-hour idempotency window.
- Build the Resend idempotency key from a keyed digest of the normalized email—not the plain address—so the key does not expose personal data.
- Preserve neutral subscriber-status responses after abuse checks.
- Do not add Cloudflare Turnstile or another visible CAPTCHA initially. Reconsider only if monitoring shows that Vercel WAF, bot protection, and application checks are insufficient.

## Application security baseline

- Serve only over HTTPS. Enable HSTS on the final production domain after HTTPS and subdomain behavior are verified.
- Apply a Content Security Policy limited to same-origin resources and the minimum Vercel Web Analytics script and connection endpoints. Block framing, plugins, unexpected base URLs, and cross-origin form actions.
- Send `X-Content-Type-Options: nosniff`, a restrictive `Permissions-Policy`, and appropriate `Referrer-Policy` headers. Confirmation responses use `no-referrer`.
- Accept signup only as same-origin `POST` JSON with a maximum 2 KB request body and the expected email field.
- Trim surrounding whitespace, preserve the mailbox portion, lowercase only the domain portion, enforce the 254-character maximum, and reject control characters or malformed syntax.
- Do not remove plus tags, dots, or otherwise rewrite a mailbox provider's address semantics.
- Return `Cache-Control: no-store` from signup, confirmation, and webhook endpoints.
- Keep public errors generic and never echo a submitted address.
- Verify the raw Resend webhook request body and Svix headers with the Resend SDK before parsing or acting. Webhook actions remain idempotent under retries and replays.

### Resend-aligned provider practices

- Keep API keys only in server-side environment variables and use the dedicated Full-access key documented above.
- Use Resend's 24-hour idempotency key for confirmation sends.
- Use only published hosted Templates and provide every required variable; test drafts before publication.
- Use Resend's designated addresses for delivery, bounce, complaint, and suppression testing.
- Verify the dedicated sending subdomain with SPF and DKIM. Begin DMARC at `p=none` with reporting, then tighten only after verified delivery data and legal/technical review.
- Preserve Resend suppressions, Topics, managed unsubscribe URLs, and global unsubscribe status.
- Keep the landing page email-only: submission requests a transactional confirmation, while the email's explicit confirmation action records the specific marketing consent. Neither a submitted address nor silence is consent.

## Resend webhook operations

- Expose one server-side webhook endpoint and verify every payload with `RESEND_WEBHOOK_SECRET` before processing it.
- Make handlers idempotent because Resend provides at-least-once delivery and may retry or reorder events.
- `email.bounced` with a permanent result: set an existing Contact to globally unsubscribed and opt it out of the early-access Topic. If no Contact exists, take no Contact action; Resend's suppression still protects future sends.
- `email.bounced` with a transient or undetermined result: do not unsubscribe automatically; retain the delivery status for operational review.
- `email.complained`: immediately set an existing Contact to globally unsubscribed and opt it out of the Topic.
- `email.suppressed`: never attempt to bypass the Resend suppression. Align any existing Contact to unsubscribed.
- `email.delivery_delayed`: record an operational warning but do not change consent or subscription state.
- `email.failed`: record a sanitized operational error and investigate configuration, quota, sender-domain, or provider failure.
- `email.delivered`: make no Contact mutation.
- No webhook event is permitted to subscribe or resubscribe a Contact. Only a valid double-opt-in confirmation can do that.
- Never log complete webhook payloads, recipient addresses, token contents, or secrets. Use provider event IDs and sanitized categories for diagnosis.
- Return a non-success status when a retryable processing failure occurs so Resend can retry delivery.
- Test delivered, bounced, complained, and suppressed branches with Resend's designated test addresses before public cutover.

## Monitoring and operating cadence

### Shareable preview

- After every owner-approved deployment that changes signup or email behavior, run the owner-only end-to-end test immediately.
- Inspect the corresponding Vercel runtime logs while they are within the Hobby retention window.
- Confirm the owner Contact appears only in the preview-test Segment and private test Topic.
- Review the Resend email event and confirm no production Contact, Segment, or Topic was mutated.
- Do not add an external uptime service or client-side error tracker during preview.

### Public launch

- Configure UptimeRobot Free before `SIGNUP_MODE=live` with private five-minute monitors for `/homepage/`, `/earlyaccess/`, and `/api/health`.
- Homepage and early-access monitors require HTTP 200 plus stable expected text; the health monitor accepts only its generic healthy response.
- Send uptime alerts only to the owner's monitored inbox. Do not publish a status page initially.
- The health endpoint returns only generic 200/503 status, sends no email, exposes no configuration values, and contains no personal data.
- Review Vercel firewall and rate-limit activity weekly and after unusual traffic.
- Review Resend delivery metrics before and after each Broadcast.
- Pause marketing Broadcasts and investigate when hard bounces reach 2%, complaints reach 0.05%, or signup/server failures repeat.
- Never exceed Resend quota or reputation limits intentionally; upgrade or pause instead.
- Do not add a client-side error tracker initially. Reconsider only if the site outgrows this operating process.

### Broadcast release procedure

- Only the owner may publish or schedule a production Resend Broadcast.
- Do not enable automated marketing sequences or drip campaigns initially.
- Limit Broadcast content to the consented purpose: early access and product-launch information.
- Send a test to the owner and verify sender identity, subject, links, responsive layout, plain-text fallback, business address, privacy link, and managed unsubscribe link.
- Verify the production Segment and public Topic are selected and preview-test resources are excluded.
- Review current bounce, complaint, suppression, and quota status before scheduling.
- Schedule at least one hour ahead, then perform a final review while cancellation remains possible.
- Review delivery metrics after every send and apply the documented pause thresholds.

## Shareable-preview acceptance gate

Do not declare the stable Vercel URL ready to share until one complete test run verifies:

- `/` redirects to `/homepage/`; canonical homepage, early-access, and navigation routes work.
- Layouts pass at 320, 375, 768, 1024, and 1440 CSS pixels with no horizontal overflow.
- Site-wide preview indexing blocks are present.
- Branch previews contain no Resend credentials and cannot transmit signup data.
- `TEST_RECIPIENT_EMAIL` receives exactly one confirmation email in 24 hours.
- The email button and plain-text fallback link both reach the confirmation endpoint.
- The result page strips the token, displays no address, and repeated confirmation remains successful and idempotent.
- Modified, expired, and wrong-environment tokens fail safely.
- The owner Contact belongs only to the preview-test Segment and private test Topic.
- A non-owner address receives no email and creates no Contact.
- Honeypot, WAF rate limiting, and bot protection behave as documented.
- Delivered, bounced, complained, suppressed, delayed, and failed email-event branches behave as documented.
- Vercel Web Analytics records only homepage and early-access page views.
- Runtime logs and analytics contain no secret, recipient address, confirmation token, or full webhook payload.

## Production cutover

1. Complete the final brand, domain, sender identity, privacy notice, business address, legal review, and verified production Resend resources.
2. Connect the final domain to Vercel and verify the dedicated Resend sending subdomain, SPF, DKIM, and DMARC records.
3. Enter `SIGNUP_MODE=canary`: retain site-wide `noindex`, allow only the owner address, and use the real production sender, Template, Segment, and public Topic.
4. Run the complete production-domain canary test, including unsubscribe and webhook handling, and remove or clearly label any canary Contact used only for testing.
5. Open an owner-approved launch pull request that removes site-wide indexing blocks while leaving confirmation and API routes blocked from indexing.
6. Change the stable environment to `SIGNUP_MODE=live` and deploy only through the approved `main` merge.
7. Run an immediate post-deploy smoke test, inspect Resend and Vercel, and begin the public monitoring cadence.

## Emergency rollback

1. Immediately publish a Vercel Firewall rule denying `POST /api/early-access` and pause all Resend Broadcasts. Keep the static website available.
2. Restore the Vercel production alias to the last passing owner-only canary deployment.
3. Preserve all confirmed Contacts, consent properties, suppression records, and unsubscribe state; rollback never deletes or resubscribes people.
4. Diagnose and repair on a feature branch, rerun automated checks and the owner-only canary, and require a new owner-approved pull-request merge before reopening signup.
5. If only email delivery is affected, keep the homepage online and disable only enrollment.

## Confirmation contract

`GET /api/confirm?token=…`

1. Decrypt and authenticate the token, then verify its 24-hour expiry, consent version, audience, and `preview`, `canary`, or `live` mode.
2. Require the token mode to match the active deployment mode and select only that mode's permitted resources: test Segment and private test Topic for `preview`; production Segment and public Topic for `canary` or `live`.
3. Create or update the Resend Contact only after successful verification, set `unsubscribed` to `false`, add it to the selected Segment, and explicitly subscribe it to the selected Topic.
4. Record:
   - `confirmed_at`
   - `consent_version: early-access-v1`
   - `consent_method: double_opt_in`
   - `signup_source: shareable_preview`, `production_canary`, or `website`, according to the verified mode
5. Redirect to a confirmation result page without placing the email address in the URL.

Repeated confirmation should be idempotent: an existing confirmed Contact is treated as success.

### Confirmation result experience

- After processing the token, redirect to the dedicated `/earlyaccess/confirmed/` result page so the token is removed from the visible URL before rendering UI.
- Exclude the result page from search indexing and Vercel Web Analytics.
- Send `Cache-Control: no-store` and `Referrer-Policy: no-referrer` on the token-bearing confirmation response.
- Show confirmed and already-confirmed cases as the same success state without displaying an email address.
- Show expired and invalid cases as one generic state with a return to early access.
- Show provider or server outages as a retryable temporary-error state; the user can reopen the same unexpired link.

## Contact organization and preferences

- Use Segments only for internal organization: one production confirmed-early-access segment and one isolated preview-test segment.
- Create one public, default-off Topic named `Early access and product launches`.
- Create one separate private, default-off Topic named `Early Access — Preview Tests`.
- A confirmed public signup explicitly opts into that Topic. Merely creating a Contact or adding it to a Segment never implies Topic consent.
- A preview confirmation uses only the preview-test Segment and private test Topic. It never joins or alters the production Segment or public Topic.
- Scope marketing Broadcasts to the Topic and include Resend's managed unsubscribe URL.
- Honor both Topic-level opt-out and global unsubscribe status; neither may be bypassed by Segment membership.

## Privacy, unsubscribe, deletion, and retention

- Process unsubscribe links immediately through Resend and exclude the Contact from all subsequent marketing sends.
- An unsubscribed Contact is not a confirmed subscriber for product or reporting purposes.
- Retain only the email address and unsubscribe status as the suppression record so the opt-out is not accidentally reversed by an import or Segment change.
- Treat a deletion request separately: within 30 days, remove Segment and Topic memberships, consent properties, and other nonessential subscriber data. Retain only the minimum suppression record unless applicable law requires complete erasure.
- If an unsubscribed or deleted person later signs up intentionally, require a new double-opt-in confirmation and record new consent before resuming marketing.
- Pending signups have no stored Contact to delete; their encrypted tokens expire after 24 hours.
- Before public launch, publish a privacy notice explaining purposes, providers, retention, unsubscribe, deletion, and how to submit a privacy request.
- Complete a qualified legal review before enabling public signup or sending the first marketing Broadcast.

### Tracking policy

- Enable privacy-focused Vercel Web Analytics for automatic page views on `/homepage/` and `/earlyaccess/`.
- Use the Vercel dashboard's route, hostname, and environment filters to distinguish the stable shareable preview from the final-domain launch.
- Do not add custom interaction events, advertising pixels, behavioral profiles, third-party analytics, tracking cookies, or session replay.
- Never send email addresses, confirmation tokens, or other signup data to analytics. The confirmation API and token-bearing URL are excluded from page-view collection.
- Keep Resend open tracking and click tracking disabled.
- Confirmation uses the application's direct encrypted link, not Resend click events.
- Limit observability to Vercel operational and firewall metrics plus the minimum Resend delivery, bounce, complaint, Contact, and Broadcast information needed to operate the service safely.
- Disclose Vercel's aggregated page-view analytics in the public privacy notice.
- Any analytics beyond these two automatic page-view counts requires a separate privacy review and explicit owner approval.

### Mandatory legal launch gates

The owner-only shareable preview may be tested before these details exist, but `SIGNUP_MODE=live` and production marketing Broadcasts must remain disabled until all are complete:

- Final legal or business sender identity
- Valid business street address, registered USPS P.O. Box, or compliant registered private mailbox
- Monitored privacy or support email address
- Published privacy notice and working request process
- Qualified legal review for the intended launch markets
- Verified Resend unsubscribe behavior and accurate sender information in every marketing template

### Privacy-request channel

- Create `privacy@<final-domain>` before the production canary and privately forward it to an inbox monitored by the owner.
- Do not publish the owner's personal address.
- Publish the privacy address in the privacy notice and use it for access, correction, deletion, and marketing-preference requests.
- Acknowledge requests promptly and complete the documented deletion workflow within the 30-day target.
- Choose the mailbox or forwarding provider only after the final domain is selected; Resend sending-domain verification does not itself create a receiving inbox.

### Initial market scope

- The initial public launch and early-access program are intended for the United States.
- State accurately that initial product availability is U.S.-focused.
- Do not run launch campaigns targeted to the UK, EEA, Canada, or other international markets without a separate legal and operational review.
- Keep the site globally reachable and the form email-only; do not add IP geoblocking or country collection initially.
- Continue honoring unsubscribe, suppression, privacy, and deletion requests received from any person.

### Confirmation resilience

- Token creation uses Node's built-in authenticated encryption and has no network dependency.
- Create the token before asking Resend to send the email. If token creation fails, do not call Resend and return a generic temporary error.
- An expired, malformed, modified, or wrong-environment token fails closed without exposing its contents.
- If Vercel or Resend is temporarily unavailable during confirmation, make no subscriber mutation and show a retryable temporary-error result. The same unexpired link can be opened again.
- If Resend creates the Contact but the browser does not receive the success response, reopening the link is safe because confirmation is idempotent.
- Include a non-sensitive key identifier in the token envelope. Encrypt new links with `SIGNUP_TOKEN_KEY_CURRENT`; accept `SIGNUP_TOKEN_KEY_PREVIOUS` only for decryption.
- During key rotation, move the former current key to the previous slot and retain it for at least 48 hours before removal. This exceeds the 24-hour token lifetime and prevents planned rotation from breaking valid links.
- Generate each key from 32 cryptographically random bytes, store it only in Vercel's encrypted environment variables and the owner's secure password manager, and never log it.

### Preview confirmation behavior

When `SIGNUP_MODE=preview`:

- Only `TEST_RECIPIENT_EMAIL` may start the confirmation journey.
- Successful confirmation creates or updates the owner Contact in the dedicated Resend test Segment and private test Topic, not the production resources.
- Record `signup_source: shareable_preview` so test consent cannot be mistaken for public enrollment.
- The test contact and segment may be retained for regression testing, but must be excluded from subscriber totals and production broadcasts.

## Confirmation email

- Manage the confirmation email as a published Resend-hosted Template referenced by `RESEND_CONFIRM_TEMPLATE_ID`.
- Subject: `Confirm your SURGE early access`
- Body: `Confirm that you want to receive early-access and product-launch emails from SURGE.`
- Button: `Confirm early access`
- The button URL contains the authenticated encrypted confirmation link supplied by the server.
- A plain-text link is included as a fallback.
- Include the current brand name, 24-hour expiry, privacy URL, and—once available—the business postal address as controlled server variables.
- Include `If you did not request this, you can safely ignore this email.`
- Keep Resend open and click tracking disabled for the template.
- Draft and test template changes before publishing. Any material change to the promised email purpose or consent language requires a new `consent_version` before use.
- No marketing email is sent before confirmation.

## Frontend states

- Invalid email: `Enter a valid email address.`
- Accepted: `Check your inbox. Confirm your email to join early access.`
- Temporary failure: `Couldn’t send the confirmation email. Check your connection and try again.`
- The stable preview uses the same neutral Accepted response for every syntactically valid address. Only `TEST_RECIPIENT_EMAIL` receives a message; every other address is discarded without storage.
- Do not add a preview-specific explanatory message or reveal whether an address matches the owner allowlist.

## Planned environment variables

```text
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
PUBLIC_SITE_URL=
BRAND_NAME=
PRIVACY_URL=
BUSINESS_POSTAL_ADDRESS=
SIGNUP_MODE=preview
TEST_RECIPIENT_EMAIL=
```

Create the four consent properties in Resend before the confirmation function starts writing them. `SIGNUP_TOKEN_KEY_PREVIOUS`, `PRIVACY_URL`, and `BUSINESS_POSTAL_ADDRESS` may remain unset during the owner-only preview where their associated behavior is not yet required. Vercel Preview receives none of the secret values above; Vercel Production receives the values appropriate to its active signup mode.

## Official references

- [Vercel Node.js Functions](https://vercel.com/docs/functions/runtimes/node-js)
- [Resend API authentication](https://resend.com/docs/api-reference/introduction)
- [Retrieve a Resend Contact](https://resend.com/docs/api-reference/contacts/get-contact)
- [Create a Resend Contact](https://resend.com/docs/api-reference/contacts/create-contact)
- [Send a Resend email](https://resend.com/docs/api-reference/emails/send-email)
