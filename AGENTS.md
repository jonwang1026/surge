# SURGE repository instructions

This is the canonical repository for the SURGE website, its documentation, and its project skills.

## Working conventions

- Keep the website framework-free unless the implementation makes a deliberate change.
- Keep `.env.local` and provider credentials out of Git. `.env.example` is documentation only.
- Run the checks defined in `package.json` for changes to the app.
- Preserve the current SURGE visual system: IBM Plex Mono utility text, a neo-grotesk display stack, carbon hairlines, square controls, and formula-colored stages.
- Keep documentation current with the implemented routes, states, tokens, and provider behavior. Do not preserve abandoned design plans or launch assumptions.

## Project skills

The available project skills live in `.agents/skills/`. Use these three skills together only for frontend design, planning, implementation, or review tasks that change the user-facing interface:

- `frontend-design` for visual direction and subject-specific design decisions.
- `ui-ux-pro-max` for interaction, accessibility, responsive, motion, and stack guidance.
- `web-design-guidelines` for interface review and best-practice checks.

Do not invoke the frontend bundle solely for backend, integration, testing, documentation, or general code-review changes.

Before every `git push`, use the `refactor` skill to review and simplify the changed code where appropriate.

`grill-with-docs` is opt-in and is used when a plan needs an interview plus current-state documentation.
