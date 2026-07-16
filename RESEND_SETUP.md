# Resend and Vercel setup

This runbook turns the implemented owner-only preview into a complete end-to-end test. It does not authorize a public launch.

## 1. Resend account resources

Create one dedicated **Full access** API key. Sending-only access is insufficient because the server also reads, creates, updates, segments, and unsubscribes Contacts. Save the key only in `.env.local`, Vercel Sensitive environment variables, and the owner's password manager.

Create these resources in Resend:

- Segment: `Early Access — Preview Tests`
- Segment: `Early Access — Production`
- Private Topic, default opt-out: `Early Access — Preview Tests`
- Public Topic, default opt-out: `Early access and product launches`
- Contact string properties: `confirmed_at`, `consent_version`, `consent_method`, and `signup_source`

Copy each ID into the matching variable in the gitignored `.env.local` for a deliberate owner test and into the corresponding Vercel Sensitive Production variable. Leave `.env.example` blank. Preview mode uses only the test Segment and private test Topic. Canary/live mode uses only the production Segment and public Topic.

## 2. Hosted confirmation Template

In Resend, import `resend/confirmation-template.html` and use `resend/confirmation-template.txt` as the plain-text version. Define all five string variables without fallback values:

- `BRAND_NAME`
- `CONFIRM_URL`
- `EXPIRY`
- `PRIVACY_URL`
- `POSTAL_ADDRESS`

Publish the Template, then store its ID as `RESEND_CONFIRM_TEMPLATE_ID`. The server supplies the subject, sender, variables, and 24-hour idempotency key. Keep open and click tracking disabled for the confirmation email.

The email has both a labeled button and a visible fallback link. The encrypted URL is never shown as the button label.

## 3. Webhook

After the stable Vercel URL exists, create one Resend webhook pointing to:

```text
https://<stable-project>.vercel.app/api/resend-webhook
```

Subscribe to:

- `email.bounced`
- `email.complained`
- `email.suppressed`
- `email.delivery_delayed`
- `email.failed`
- `email.delivered`

Save the signing secret as `RESEND_WEBHOOK_SECRET`. The endpoint verifies the raw payload before processing it. Permanent bounces, complaints, and suppressions globally unsubscribe an existing Contact and opt it out of the active Topic. Other delivery events never change consent.

## 4. Vercel environments

Connect the private GitHub repository and set `main` as the Production branch.

Vercel Preview deployments:

- `SIGNUP_MODE=disabled`
- no Resend key, webhook secret, token key, or allowlist

Vercel Production shareable preview:

- `SIGNUP_MODE=preview`
- all active values from `.env.example` stored as Sensitive variables
- `TEST_RECIPIENT_EMAIL` set to the owner's Resend account email
- `RESEND_FROM_EMAIL` may use Resend's testing sender for the owner-only test
- `PUBLIC_SITE_URL` set to the exact stable HTTPS origin with no path or trailing slash

Create `SIGNUP_TOKEN_KEY_CURRENT` as 32 random bytes encoded with base64url. Create `SIGNUP_IDEMPOTENCY_SECRET` as a separate high-entropy random value. Keep the previous token key only during a rotation window of at least 48 hours.

In the Vercel dashboard:

- Enable Web Analytics.
- Configure the single Hobby WAF rule for `POST /api/early-access`: 5 requests per IP or supported browser fingerprint per 10 minutes, then 429.
- Enable managed bot protection in challenge mode.
- Do not provide secrets to GitHub Actions or Vercel Preview environments.

For a deliberate local owner-only integration test, link the project with `vercel link`, keep `SIGNUP_MODE=preview` in the gitignored `.env.local`, and run `npm run integration:local`. Vercel Dev reproduces the function runtime on port 4174. The ordinary `npm run prototype` command always uses the non-transmitting mock.

## 5. Owner-only end-to-end test

Before sharing the stable preview URL:

1. Confirm `/`, `/homepage/`, and `/earlyaccess/` route correctly and response headers include `X-Robots-Tag: noindex, nofollow, noarchive`.
2. Submit `TEST_RECIPIENT_EMAIL` once and verify exactly one confirmation message arrives.
3. Select **Confirm early access** and verify the browser lands on `/earlyaccess/confirmed/` without the token in the URL.
4. Select the email link again and verify it remains successful.
5. Verify the Contact appears only in the preview-test Segment and private test Topic with all four consent properties.
6. Submit a different address and verify Resend receives no email and creates no Contact.
7. Exercise Resend's delivered, bounced, complained, and suppressed test addresses and verify the documented webhook behavior.
8. Confirm Vercel Analytics records `/homepage/` and `/earlyaccess/`, but not the confirmation result page or API routes.

Do not switch to `canary` or `live` until every mandatory legal, domain, postal-address, privacy, sender-authentication, monitoring, and Vercel Pro gate in `INTEGRATION.md` is complete.
