# SURGE product and website context

## Product

SURGE is the caffeinated gum-and-mint formula. RESURGE is the caffeine-free formula. Both use the same reusable aluminum pocket-case system and share the idea of intense mint freshness.

The aluminum pocket case is the signature object. Color identifies the selected formula; it does not replace the formula label or text.

## Visual language

- SURGE Blue: `rgb(157, 220, 240)`
- RESURGE Teal: `rgb(155, 227, 211)`
- Foil: `#D7DAE0`
- Milk: `#F4F6F2`
- Carbon: `#111318`

## Website states

**Shareable preview** — The current non-indexed review deployment. Local signup is mocked. A configured preview environment can send only to the owner test address.

**Early-access request** — A valid email submission that receives a confirmation message when the active provider mode permits delivery. It is not yet a confirmed subscriber.

**Confirmed subscriber** — A person who completes the encrypted, expiring confirmation link and is added to the active Resend Segment and Topic.

**Disabled mode** — The safe runtime default when `SIGNUP_MODE` is unset. The API returns the neutral accepted response without sending or storing an address.

## Language

- Say “early access,” not “newsletter” or “mailing list.”
- Say “caffeinated” and “caffeine-free,” not “day formula” and “night formula.”
- Say “pocket case” or “aluminum case,” not “wrapper,” “candy box,” or “disposable tin.”
- Never imply that submitting an email alone is consent; consent is recorded after double opt-in.
