# Out of the red

Static Astro 7 + Svelte 5 site teaching DJs and crew to keep set recordings clean (Pioneer XDJ-RX2 → Howler recorder on MASTER 2; DriveRack PA2 and QSC GX7 amps on the PA; booth monitors on BOOTH). One rising-depth guide at `/`, plus `/night/`, `/setup/` and `/print/`. See README.md for pages, commands and deployment, and docs/DESIGN.md for the visual system.

## Commands

- `pnpm dev` (Astro 7 backgrounds itself when it detects an agent; stop it with `pnpm exec astro dev stop`)
- `pnpm verify` runs lint, check, unit tests, build and e2e. E2E needs `pnpm build` first and serves on port 4322.
- `pnpm clipcheck <files.wav>` checks recordings for clipping (`src/lib/clipcheck/`, documented in the README). Its tests are the calibration: keep them passing when you tune it.

## Conventions

- Facts about the gear come from the manufacturers' documents listed in `src/lib/sources.ts`. If Pioneer or Howler don't publish something, say so on the page rather than guessing.
- Simulation assumptions live only in `src/lib/model.ts` and `src/lib/xdj.ts`. Widgets import them; never hard-code a ceiling.
- Copy: a reference guide's register, not an assistant's; the rules are in docs/DESIGN.md's Voice section. In short: UK English, second person, short sentences, every line with one reader and one job, each thing said once. Hardware names are as printed (TRIM, MASTER LEVEL, BOOTH MONITOR, the MASTER meters). Write "recording level", "orange" (not "yellow"), and "crunch" (not THD) on DJ-facing pages. Conditions come first ("If …, …"). No ", so" chains, idioms or negative contractions. Checklist lines end in a state you can see. Shared wording lives in `src/lib/rules.ts`, `myths.ts`, `glossary.ts`, `checklists.ts`, `fixes.ts`, `messages.ts`.
- Styles use the tokens in `src/styles/tokens.css`; interactives sit in `.panel` hardware boxes, except the checklists and the meter check's quiz cards (with "How sure are you?"), which are printed QRH cards (`--paper` card, `--strip` title, `--action` responses). Black panels are only for real gear (meters, faders, scopes, the Howler). Anything shown as paper in both themes carries `data-paper`. Chart marks use `--sig`, `--sig-b` and `--dmg` only.
- The look is a quick reference handbook (docs/DESIGN.md): B612 text, know-by-heart boxes (`KnowByHeart.astro`), procedure cards (`Procedure.astro`), challenge/response lines with the response in `--action`, numbered sections from `src/lib/sections.ts`. Flat panels, two radii, no pills or side stripes; plain voice ("If …, …"), no slogans.
- The site follows the reader's light/dark setting. Page tokens (`--paper`, `--ink*`, `--action`, `--tint`) change; hardware tokens (`--hw*`, `--led-*`, `--screen*`) don't. Text on a panel uses hardware tokens, text on the page uses page tokens. Check both themes. Lit LED colours only ever mean a signal state.
- Islands must render a meaningful state on the server and never touch `window` or Web Audio during SSR. All sound goes through `src/lib/audio/engine.svelte.ts` (or `loopPlayer.ts`), never autoplays, and clean/clipped comparisons are loudness-matched.
- Keep `typescript` on 6.x until `@astrojs/check` and `svelte-check` support 7.
