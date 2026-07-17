# Current SURGE design

This document describes the interface that is implemented in `homepage/`, `earlyaccess/`, `shared.css`, `homepage/homepage.css`, and `styles.css`.

## Product and audience

- **Product:** SURGE caffeinated gum and mints, with RESURGE as the caffeine-free formula.
- **Audience:** People who want a good-looking, portable freshness object for commutes, work, travel, dates, concerts, and parties.
- **Primary job:** Show the product clearly and invite an early-access request.
- **Signature element:** The brushed aluminum pocket case on a quiet formula-colored stage.

## Tokens

| Role | Current value |
| --- | --- |
| SURGE stage and accent | `rgb(157, 220, 240)` |
| RESURGE stage | `rgb(155, 227, 211)` |
| Foil | `#D7DAE0` |
| Milk | `#F4F6F2` |
| Carbon | `#111318` |
| White | `#FFFFFF` |
| Error text | `#B42318` |
| Display face | `Helvetica Neue`, `Segoe UI`, Roboto, Helvetica, Arial, sans-serif |
| Utility face | Local IBM Plex Mono with system monospace fallbacks |
| Rule | `1px solid var(--carbon)` |
| Motion easing | `cubic-bezier(0.22, 1, 0.36, 1)` |

The shared header is 64px on phones and 72px from 768px upward. The interface uses 4px text rhythm, 8px control gaps, 16–32px panel padding, square controls, and a 24px case radius with a 19px lower radius.

## Pages

### Editorial homepage

`/homepage/` opens with “The freshest thing in your pocket.”, a short product description, and a “Get early access” action, followed by a 13-image campaign mosaic. The grid uses two columns below 768px, three columns from 768px, and four columns from 1024px. Local responsive WebP candidates are selected with `srcset` and `sizes`.

On fine pointers, photos rest in grayscale and return to source color on hover. Touch layouts show source color. No required information depends on hover, and the effect is omitted for reduced-motion users.

### Early-access dossier

`/earlyaccess/` combines the product statement, SURGE/RESURGE formula toggle, aluminum case stage, email form, and product details. The selected formula changes the stage color, case label, product detail, theme color, and accessible caption. The form has visible labels, validation, pending, temporary-error, and check-your-inbox states. After a successful request, the check-your-inbox state replaces the complete signup prompt and receives focus.

The layout is single-column on phones and reorganizes into the dossier composition at wider widths. The formula controls remain text-based and are not color-only.

### Confirmation result

`/earlyaccess/confirmed/` renders success, temporary failure, or expired-link copy from the `status` query parameter, then removes the query string from the visible URL. It is not included in page-view analytics.

## Interaction and accessibility

- Navigation, formula controls, form controls, and links provide at least 44px touch targets.
- Keyboard focus uses a visible 3px outline.
- Formula state is exposed with `aria-pressed`; form status uses live regions and `aria-busy`.
- The page provides a skip link and semantic headings, labels, sections, and figures.
- Pointer tilt is enabled only for fine pointers when reduced motion is not requested.
- The site remains non-indexed in the current preview through HTML metadata, headers, and `robots.txt`.
