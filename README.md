# SURGE shareable preview

Mobile-first two-page shareable preview for SURGE:

- `/homepage/` is a purely editorial campaign mosaic with the signature SURGE Blue interaction.
- `/earlyaccess/` is the focused object-dossier signup page.
- `/` redirects to `/homepage/`.

Run from the repository root:

```sh
npm run prototype
```

Then open <http://localhost:4173>. Both pages share the same top navigation and footer; Contact remains footer-only.

The local server includes a non-transmitting `/api/early-access` mock, so the complete form UI can be exercised without loading credentials, sending email, or storing an address.

After the Vercel project is linked and a replacement key is stored in `.env.local`, `npm run integration:local` deliberately runs the real Vercel Functions on <http://localhost:4174>. Keep `SIGNUP_MODE=preview`; this path remains owner-only and must never be used with another recipient.

## Preview boundary

The Vercel + Resend double-opt-in backend is implemented, but `SIGNUP_MODE=disabled` is the safe default. In that mode, the form returns the same check-your-inbox UI without sending or storing an address. `preview` mode sends only to `TEST_RECIPIENT_EMAIL` and uses the dedicated test Segment and private test Topic.

Never expose an email-provider secret in browser JavaScript or a branch-preview environment. Copy `.env.example` to a gitignored `.env.local` only for a deliberate owner test; keep Vercel Preview deployments secret-free.

The approved Vercel + Resend double-opt-in contract is documented in [INTEGRATION.md](./INTEGRATION.md).

The exact Resend resources, hosted confirmation Template, webhook events, and Vercel settings are documented in [RESEND_SETUP.md](./RESEND_SETUP.md).

## Verification

```sh
npm ci
npm run validate
npm run typecheck
npm test
npx playwright install chromium
npm run test:browser
```

`npm run check` runs the complete validation suite. Browser checks cover both pages at 320, 375, 768, 1024, and 1440 CSS pixels.

## Deployment workflow

- Work only on feature branches.
- Pull requests run the same validation suite without Resend secrets.
- `main` is the stable Vercel production branch.
- The owner's manual merge to `main` is deployment approval.
- Keep Vercel Hobby sharing private-by-link and owner-only; upgrade to Pro before a public commercial launch.

The optimized WebP campaign images are deployed. Larger PNG originals remain local and are excluded from Git and hosting.
