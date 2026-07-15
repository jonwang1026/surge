# SURGE frontend preview

Mobile-first two-page frontend preview for SURGE:

- `/homepage/` is a purely editorial campaign mosaic with the signature SURGE Blue interaction.
- `/earlyaccess/` is the focused object-dossier signup page.
- `/` redirects to `/homepage/`.

Run from the repository root:

```sh
npm run prototype
```

Then open <http://localhost:4173>. Both pages share the same top navigation and footer; Contact remains footer-only.

## Preview boundary

The email form is intentionally local-only. It validates and shows the intended success state, but does not save or transmit addresses. This repository is ready for private design review, not a public early-access launch.

Before launch, connect the form to a server-side endpoint, persist consented addresses in the chosen email platform or database, add abuse protection and rate limiting, and replace the prototype success message with a confirmed enrollment state. Never expose an email-provider secret in browser JavaScript.

The optimized WebP campaign images are deployed. Larger PNG originals remain local and are excluded from Git and hosting.
