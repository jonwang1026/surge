# SURGE shareable preview

This is a framework-free, mobile-first preview for SURGE, a premium gum-and-mint pocket system.

## Routes

- `/` redirects to `/homepage/`.
- `/homepage/` is the editorial campaign mosaic.
- `/earlyaccess/` is the formula-aware product dossier and early-access form.
- `/earlyaccess/confirmed/` renders the result of a confirmation-link attempt.

The homepage and early-access page share the sticky navigation and footer. There is no Contact page or Contact link.

## Local preview

From the repository root:

```sh
npm run prototype
```

This runs `scripts/prototype-server.js` on <http://localhost:4173>. The local server mocks `POST /api/early-access`, returns a generic accepted response, and never sends or stores an address. It also provides a health response and an invalid confirmation redirect for route testing.

## App checks

From `surge-prototype/`:

```sh
npm ci
npm run check
```

`check` runs HTML, CSS, JavaScript, type, unit, and browser tests. Browser coverage targets 320, 375, 768, 1024, and 1440 CSS pixels.

## Signup boundary

The Vercel functions in `api/` are separate from the local mock. They support disabled, owner-only preview, canary, and live modes. Preview and live provider setup is documented in [INTEGRATION.md](./INTEGRATION.md) and [RESEND_SETUP.md](./RESEND_SETUP.md).

Never put Resend credentials or token keys in browser code, `.env.example`, or a preview deployment that should remain non-transmitting.
