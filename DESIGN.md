# SURGE prototype design plan

## Brief

- **Subject:** SURGE, a caffeinated gum and mint system with RESURGE as the caffeine-free line.
- **Audience:** Design-conscious 20–35-year-olds carrying gum or mints through commutes, work, travel, dates, concerts, and parties.
- **Page job:** Earn an email signup before products are available.
- **Product idea:** One reusable aluminum case silhouette in mint and gum sizes.

## Shared tokens

| Role | Token |
| --- | --- |
| SURGE Blue / signature stage and interaction | `#9DDCF0` |
| Ozone Blue / small accent | `#3155FF` |
| Foil | `#D7DAE0` |
| Milk Glass | `#F4F6F2` |
| Carbon | `#111318` |
| Pulse Orange | `#FF6A2B` |
| RESURGE Teal / formula stage | `#9BE3D3` |

- **Display and UI:** native neo-grotesk system fonts, led by `Helvetica Neue`, `Segoe UI`, and `Roboto`, for fast and consistent rendering across iOS and Android.
- **Body and utility:** IBM Plex Mono carries compact supporting copy, controls, labels, and product data to match the selected editorial reference. Native neo-grotesk system fonts remain the display face.
- **Signature:** the silver case isolated on a quiet product stage, with pointer tilt only on compatible hardware.

## Layout candidates

### A — Product poster

```text
┌─NAV─────────────────────────────────────────┐
│               SURGE (cropped word)          │
│  thesis       [case + breath field]  form   │
│  formula strip / product proof              │
└─────────────────────────────────────────────┘
```

The case is the hero, with early access embedded in the poster rather than separated into a generic CTA section.

### B — Object dossier

```text
┌─NAV───────────────┬─────────────────────────┐
│ headline + form   │  large technical case   │
│ formula selector  │  annotated product data │
├───────────────────┴─────────────────────────┤
│ SURGE / RESURGE comparison                  │
└─────────────────────────────────────────────┘
```

The product is treated like a well-designed instrument, with the formula system doing the explanatory work.

### C — Occasion wall

```text
┌─NAV─────────────────────────────────────────┐
│ headline       signup block                 │
├────────────┬────────────┬───────────────────┤
│ COMMUTE    │ DEADLINE   │ DANCE FLOOR       │
├────────────┴────────────┴───────────────────┤
│ SURGE when you want it / RESURGE when not   │
└─────────────────────────────────────────────┘
```

The brand is organized around moments rather than incorrectly assigning SURGE to day and RESURGE to night.

## Self-critique

The first automated recommendation was “kinetic brutalism”: black, acid color, marquee, and oversized uppercase type. That is a fashionable default and would make the product resemble an energy drink. The revision keeps energy in one product-specific device—the breath field—while using aluminum, clinical precision, and restrained color to make the cases feel like engineered pocket accessories. Continuous marquees, decorative parallax, and generic feature-card grids were removed.

## Current direction

The object dossier is the sole selected direction. The information column stays white and formula color belongs to the product stage: pale SURGE Blue (`#9DDCF0`) with carbon text for SURGE and pale RESURGE Teal (`#9BE3D3`) for RESURGE. The aluminum case remains unchanged. Decorative dimensions, the precision grid, the floating “Object 01” caption, and the oversized background formula wordmark have been removed so the case carries the composition. The information strip distinguishes the selected formula by caffeine status while keeping the shared case and launch promises concise.

The product stage always shows the selected formula color so SURGE and RESURGE remain legible without relying on hover. A restrained pointer tilt is available only on compatible fine-pointer hardware and never shifts layout.

On single-column tablet and mobile layouts, the product stage appears before the early-access form so visitors see the case before being asked for an email. The case wordmark uses carbon on both formula colors.

The early-access headline is “Be the first to carry it.” Supporting copy uses an even 4px three-line rhythm—“Fresh breath. Fresh energy.”—followed by the quieter product payoff, “In a case made to be seen.” On desktop, the formula selector sits within a balanced 32px vertical interval between the supporting copy and Early access. The shared top navigation contains `Home` and `Early access`; Contact is footer-only. The signup is reduced to its heading, visible email label, email field, `Join` action, concise consent context, and a stable check-your-inbox confirmation state. Product-detail rows use an 8px label-to-value gap and describe taste as “Seriously minty.” The case is centered from its own responsive container at every breakpoint, with symmetrical mobile stage spacing so it does not drift as the viewport changes.

The early-access heading and form remain one compact, left-aligned unit at every breakpoint. The heading is a distinct 16px section title placed directly above the form. At 320–479px, the email field and `Join` button stack; from 480px upward they share one row. The form fills the available phone or desktop information column but is capped at 620px on wider single-column tablet layouts. The panel uses 24px vertical padding on phones, 32px on tablet and desktop, and a consistent 16px heading-to-form gap. A single 16px status line is reserved below the controls so validation and prototype success feedback do not move surrounding content. On desktop, the signup follows the product controls near the top of the information column; extra viewport height is left beneath the form instead of pushing it toward the bottom edge.

The interface borrows the reference project’s disciplined editorial language without copying its layout: IBM Plex Mono carries supporting copy, controls, labels, and product data; black hairlines, square controls, uppercase tracking, and high-contrast whitespace keep the page precise. The neo-grotesk display stack remains on the headline, SURGE mark, and case so the established product identity does not change.

The responsive target is 320–1440px across portrait and landscape layouts, including safe areas on iOS/iPadOS 16+ and current-to-two-versions-back Chrome on Android. The page remains framework-free, uses optimized local campaign assets, and skips pointer-only effects on touch hardware.

## Editorial homepage

The site separates campaign atmosphere from signup conversion. `/homepage/` is the default entry point and `/earlyaccess/` retains the object dossier. The homepage borrows the reference template's IBM Plex Mono utility typography and asymmetric photo rhythm without copying its music-specific interactions or content.

Both pages use the same sticky top bar at every breakpoint. The SURGE wordmark sits left and `Home` plus `Early access` sit right. A single shared underline position uses the active formula accent for current, hover, keyboard-focus, and pressed states without a navigation background fill or second line. Header height is owned only by the shared stylesheet—64px on phones and 72px from tablet upward—so the pages cannot drift. Contact is removed from primary navigation and appears only in the shared bottom footer. The footer is a single row from tablet upward and stacks on phones.

The campaign mosaic uses two columns from 320–767px, three columns from 768–1023px, and four columns from 1024px upward. The largest two-by-two tile carries “The freshest thing in your pocket.” instead of photography. All other tiles are non-interactive editorial images with explicit dimensions and lazy loading below the initial viewport. The two-column mobile grid shows both closing tiles, the three-column tablet grid hides the final tile, and the four-column desktop grid hides the final two so every layout ends on a complete row. Responsive `<picture>` sources select a 1px local placeholder at hidden breakpoints, preventing those layouts from requesting the full remote photos.

Touch layouts show the campaign images in their source color because hover is unavailable. Fine-pointer layouts rest in Foil grey with grayscale portraits; hovering a photo raises it above the grey field and restores its source color. The product dossier remains formula-aware: SURGE reveals SURGE Blue and RESURGE reveals RESURGE Teal. Hover never reveals required content, and reduced-motion preferences eliminate transitions.
