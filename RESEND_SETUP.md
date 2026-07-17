# Resend setup for owner testing

This runbook is only for a deliberate Vercel integration test. The normal local preview is mocked and does not need Resend credentials.

## Create provider resources

Create or identify:

- one Full-access Resend API key;
- one test Segment and private test Topic for `preview`;
- one production Segment and public Topic for `canary` or `live`;
- Contact properties `confirmed_at`, `consent_version`, `consent_method`, and `signup_source`;
- one published hosted confirmation Template.

The Template variables are `BRAND_NAME`, `CONFIRM_URL`, `EXPIRY`, `PRIVACY_URL`, and `POSTAL_ADDRESS`. Keep Resend open and click tracking disabled.

## Configure Vercel

Set the variables listed in [INTEGRATION.md](./INTEGRATION.md) as Sensitive values. For an owner-only preview:

```text
SIGNUP_MODE=preview
TEST_RECIPIENT_EMAIL=<owner address>
PUBLIC_SITE_URL=https://<stable-origin>
```

Provide the test Segment and Topic IDs, sender, Template ID, webhook secret, token key, idempotency secret, and Resend API key. Do not put these values in GitHub Actions or Vercel Preview deployments.

## Configure the webhook

After the stable origin exists, point one Resend webhook at:

```text
https://<stable-origin>/api/resend-webhook
```

Subscribe to `email.bounced`, `email.complained`, `email.suppressed`, `email.delivery_delayed`, `email.failed`, and `email.delivered`. Store the signing secret as `RESEND_WEBHOOK_SECRET`.

## Owner-only smoke test

1. Run `npm run check` in `surge/`.
2. Confirm `/`, `/homepage/`, and `/earlyaccess/` resolve and remain non-indexed.
3. Submit only `TEST_RECIPIENT_EMAIL` and verify one confirmation email arrives.
4. Follow the link and confirm the browser lands on `/earlyaccess/confirmed/` without a token in the visible URL.
5. Open the link again and verify confirmation remains successful and idempotent.
6. Verify the Contact is in the test Segment and private test Topic only.
7. Submit another address and verify it receives no email and creates no Contact.
8. Exercise webhook test events and verify only suppression events change Contact subscription state.

Do not switch to `canary` or `live` until the production sender, domain, privacy details, and legal launch requirements are complete.
