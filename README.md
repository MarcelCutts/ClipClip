# Out of the red

A small static site that teaches the DJs and crew at our events how to get clean recordings of their sets. Every set is recorded on a Howler Recorder+Streamer fed from MASTER 2 of a Pioneer DJ XDJ-RX2, and clipping in the mixer can't be undone afterwards. The site explains why with hands-on demos, and gives everyone a short set of rules, checklists and printable booth labels.

It grew out of a one-page "Two ceilings" clipping lab. This version is written for DJs and crew (often the same people), checked against the manufacturers' documents, and built to be hosted anywhere static files can go.

## Pages

| Path | What's there |
|---|---|
| `/` | The guide. The rules first, then four parts that get deeper as they go: why it matters; playing a set (TRIM, the meters, blends with a two-deck demo, whose knobs are whose, a five-question check, myths); the rig and the recording (the signal path, the two-ceilings lab, a blind listening test, the record level); under the hood (why recordings sound worse, why quiet is free, limiters, 32-bit float, hearing safety, what the demos assume). Then the glossary and sources |
| `/night/` | For crew on the night: the doors, changeover and after checklists, and what to do when something's wrong |
| `/setup/` | For whoever sets up the rig: the wiring, a first-time setup checklist, the record level walkthrough, the DriveRack and amps, generator power, the USB backup, and one-off tests |
| `/print/` | Booth card, tape tags, checklist cards, group-chat messages |

The old addresses `/dj/`, `/crew/`, `/lab/` and `/why/` forward to the same section in its new home, so printed QR codes and old links keep working.

The site follows the reader's light or dark setting: the printed card by day, a cockpit display by night.

## Running it

You need Node 24 (see `.nvmrc`; `mise.toml` pins it for mise users) and pnpm, which switches itself to the version in `package.json`.

```sh
pnpm install
pnpm exec playwright install chromium   # once, for the end-to-end tests
pnpm dev                                # http://localhost:4321
```

Before pushing, run everything CI runs:

```sh
pnpm verify   # lint, type-check, unit tests, build, end-to-end and accessibility tests
```

Or one at a time: `pnpm lint`, `pnpm check`, `pnpm test`, `pnpm build`, `pnpm test:e2e`.

## Deploying to GitHub Pages

1. Push the repo to GitHub.
2. In the repo's **Settings → Pages**, set **Source** to **GitHub Actions**.
3. Push to `main`. The workflow in `.github/workflows/ci.yml` lints, type-checks, tests, builds, runs the end-to-end and accessibility tests against the built site, then deploys.

The workflow reads the site's URL and base path from GitHub, so it works as a project site (`https://<user>.github.io/<repo>/`) or with a custom domain without any changes. To build for another host, set `SITE_URL` and `BASE_PATH` (default `/`) and run `pnpm build`; the `dist/` folder is the whole site.

Dependency updates come from Renovate (`renovate.json`). Install the Renovate GitHub app to turn them on. Dependabot can't yet read pnpm 12 lockfiles.

## Editing the words

Most of the copy lives in plain TypeScript data, so the rules stay identical everywhere they appear:

| File | Holds |
|---|---|
| `src/lib/rules.ts` | The rules, with the hardware label each strip carries |
| `src/lib/myths.ts` | "Things DJs say about the red" |
| `src/lib/glossary.ts` | The tap-to-reveal definitions and the glossary |
| `src/lib/sources.ts` | The sources list |
| `src/lib/checklists.ts` | The checklists (shared by `/night/`, `/setup/` and the print cards) |
| `src/lib/fixes.ts` | "Something's wrong" on `/night/` |
| `src/lib/messages.ts` | The group-chat messages on `/print/` |
| `src/pages/**` | Page prose |

The writing style is UK English, second person, short sentences, and hardware names exactly as printed on the XDJ-RX2 (TRIM, MASTER LEVEL, BOOTH MONITOR). `docs/DESIGN.md` covers the visual system.

## The model behind the demos

The demos simulate the rig, so a few assumptions are baked in. They live in `src/lib/model.ts` and `src/lib/xdj.ts`, and the site states them where they matter.

- **The meters** copy the XDJ-RX2: twelve LEDs from −24 to +12 dB, green to −3, orange from 0 to +9, red at +12. The side meters show each channel before its fader; the middle meters show the mix.
- **Ceiling 1**, inside the mixer, sits at the red light. Pioneer only says red "may" distort and doesn't publish the margin, so the site treats red as the top.
- **Ceiling 2**, the Howler's input, isn't published anywhere. The demos assume it overloads 6 dB below the mixer's red with MASTER LEVEL fully up. The setup page has a test to find the real point.
- **Knobs after the mix** (MASTER LEVEL, BOOTH MONITOR) run from off to unity and can't add gain.
- **Sound** is synthesised in the browser (`src/lib/dsp/synth.ts`): two short 124 BPM loops (drums, a bass line, chord stabs) in the same key and tempo, so every device hears the same thing and nothing needs a licence. Clean and clipped versions are loudness-matched (ITU-R BS.1770 weighting) before any comparison.

Nothing plays until a button is pressed. Sound starts quietly, fades in, stops when the tab is hidden, and only one demo plays at a time (`src/lib/audio/engine.svelte.ts`).

## Share image and chat clip

`public/og.png` (the link preview) and `public/media/turn-it-down.mp4` (a ten-second silent clip for group chats) are rendered from `scripts/media/og.html` and `scripts/media/clip.html` with the site's own fonts. After changing either page, run `node scripts/media/render.mjs` (it needs Chromium from Playwright and `ffmpeg`).

## How it's built

- [Astro 7](https://astro.build) renders every page to static HTML. The interactive parts are [Svelte 5](https://svelte.dev) islands that hydrate when scrolled into view, and they render a useful state on the server first, so the pages read fine without JavaScript.
- TypeScript 6 in strict mode. TypeScript 7 is out, but Astro's and Svelte's checkers don't support it yet.
- Fonts are self-hosted through Astro's Fonts API from Fontsource packages: B612 for text and headings, Archivo at 75% width for the hardware lettering on the lab panels, and Big Shoulders Stencil for the print kit's tape. All are under the SIL Open Font License.
- The look is a quick reference handbook for the booth: B612 (Airbus's open cockpit typeface), know-by-heart boxes, challenge-and-response checklists and drills. It follows the reader's light or dark setting (the printed card by day, a cockpit display by night), and the LEDs are the only colour that means a level. `docs/DESIGN.md` has the system.
- [Biome](https://biomejs.dev) for linting and formatting, including a CSS Baseline check; `astro check` and `svelte-check` for types; [Vitest](https://vitest.dev) for the maths; [Playwright](https://playwright.dev) with axe for end-to-end and WCAG 2.2 AA checks.

```
src/
  pages/        one file per page
  components/   static Astro components (rules, glossary terms, meter drawing, print cards)
  islands/      interactive Svelte components; islands/ui holds the shared fader, keys, pads and LED meter
  lib/dsp/      signal maths: dB, peaks, loudness, the synth and the test tone, ISO 226 equal-loudness
  lib/audio/    the shared audio engine and loop player
  lib/          content data and the simulation model
  styles/       design tokens and global CSS
tests/browser/  Vitest browser-mode tests for the Svelte components and the audio engine
tests/e2e/      Playwright tests against the built site
docs/DESIGN.md  the design system
```

## Open questions for the crew

A few answers change the advice, and only the kit can give them. The setup page lists the one-off tests; the big ones are:

- Where does the Howler's light turn red, as a reading on the XDJ's middle meters?
- Does MASTER ATT reach MASTER 2? Pioneer doesn't say. If it doesn't, the recording is trimmed with MASTER LEVEL instead, and the middle meters read low.
