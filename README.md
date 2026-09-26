# Out of the red

A small static site that teaches the DJs and crew at our events how to get clean recordings of their sets. Every set is recorded on a Howler Recorder+Streamer fed from MASTER 2 of a Pioneer DJ XDJ-RX2, and clipping in the mixer can't be undone afterwards. The site explains why with hands-on demos, and gives everyone a short set of rules, checklists and printable booth labels.

It grew out of a one-page "Two ceilings" clipping lab. This version is written for DJs and crew (often the same people), checked against the manufacturers' documents, and built to be hosted anywhere static files can go.

## Pages

| Path | What's there |
|---|---|
| `/` | The guide. What a DJ must know by heart, then four parts that get deeper as they go: why it matters (a blind listening test); playing a set (TRIM, the meters, whose knobs are whose, blends with a two-deck demo, a four-question meter check, what people say about the red); the rig and the recording (the signal path, the two-ceilings lab); how it works (why a recording sounds worse, why clipping cannot be undone, why a quiet recording loses nothing, what the makers publish and what we assume). Then the glossary and sources |
| `/night/` | For crew on the night: the doors, changeover and end-of-night checklists, what to do when something's wrong, and the next day's work on the files |
| `/setup/` | For whoever builds the rig at each event: the setup checklist in order (power and earthing included), the wiring table, the recording level, the DriveRack and amps, and the one-off MASTER ATT test and DriveRack wizard |
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

- **The meters** copy the XDJ-RX2: twelve LEDs from −24 to +12 dB, green to −3, orange from 0 to +9, red at +12. The channel meters show each channel before its fader; the middle meters show the mix.
- **Ceiling 1**, inside the mixer, sits at the red light. Pioneer only says red "may" distort and doesn't publish the margin, so the site treats red as the top.
- **Ceiling 2**, the Howler's input, isn't published anywhere. The demos assume it overloads 6 dB below the mixer's red with MASTER LEVEL fully up. The setup page has a test to find the real point.
- **Knobs after the mix** (MASTER LEVEL, BOOTH MONITOR) run from off to unity and can't add gain.
- **Sound** is synthesised in the browser (`src/lib/dsp/synth.ts`): two short 124 BPM loops (drums, a bass line, chord stabs) in the same key and tempo, so every device hears the same thing and nothing needs a licence. Clean and clipped versions are loudness-matched (ITU-R BS.1770 weighting) before any comparison.

Nothing plays until a button is pressed. Sound starts quietly, fades in, stops when the tab is hidden, and only one demo plays at a time (`src/lib/audio/engine.svelte.ts`).

## Share image and chat clip

`public/og.png` (the link preview) and `public/media/turn-it-down.mp4` (a ten-second silent clip for group chats) are rendered from `scripts/media/og.html` and `scripts/media/clip.html` with the site's own fonts. After changing either page, run `node scripts/media/render.mjs` (it needs Chromium from Playwright and `ffmpeg`).

## Checking a recording for clipping

`pnpm clipcheck` reads WAV files and says whether they clipped, where, and at what level. It reads a file a piece at a time, so a whole night off the Howler is fine: the analysis takes a few seconds per hour of audio, and reading the card takes longer than that.

```sh
pnpm clipcheck "/Volumes/HOWLER/Howler recordings/"*.WAV
pnpm clipcheck set.wav --minutes   # every minute with a mark, not just the worst
pnpm clipcheck set.wav --json      # the findings as JSON
```

It looks for two marks:

- **The recorder overloading:** three or more samples in a row at full scale, the same test as Audacity's Find Clipping.
- **Clipping before the recorder**, most likely the mixer past its red: flat tops at one level below full scale, again and again. On the way to the recorder the analogue stages tilt the flat tops and add noise, so no two samples are the same, and Audacity's Show Clipping and the SoX or ffmpeg stats read these files as clean. The check smooths out the converters' ringing, fits a straight line to the middle of each top, pairs each flat top with its neighbour on the other side of the wave to cancel the drift, and looks for a pile of them at the top of the file.

It also gives the file's levels against the guide's target (`TARGET` in `src/lib/model.ts`), and the minutes to listen to.

What it can't do: tell a track that was mastered with flat tops from the mixer when both sit at the top of the file in one stretch (the report says so and gives the times to listen); find very light clipping (in tests with real tracks it finds clipping once the loudest moments go about 2 dB past the mixer's ceiling); or find clipping that the mixer rounds off instead of flattening. The Howler MK1 splits a night into files of about 3.5 hours (4 GB), so check them all, and don't trust the MK1's file dates.

The code is in `src/lib/clipcheck/` and has no dependencies, so a page on the site could use it too. Its tests build recordings from the site's synth and pass them through a model of the analogue stages.

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
  lib/clipcheck/ the recording checker behind pnpm clipcheck
  styles/       design tokens and global CSS
tests/browser/  Vitest browser-mode tests for the Svelte components and the audio engine
tests/e2e/      Playwright tests against the built site
scripts/        the share image and clip renderer, and the recording checker
docs/DESIGN.md  the design system
```

## Open questions for the crew

A few answers change the advice, and only the kit can give them:

- Does MASTER ATT reach MASTER 2, MASTER 1, and the MASTER meters? Pioneer doesn't say which sockets it acts on. The setup page's test T2 checks all three.
- Do the channel meters read after the EQ, and before the fader? Pioneer doesn't say; only VirtualDJ's layout page does. The setup page's "Check it yourself" tests the fader.
- Where are the amps' RIG marks? dbx sets the DriveRack's limiters "based on where you have set your amplifier attenuators", but doesn't say what its wizard assumes for the GX7s. So the marks are found on the kit, at the highest click where both amps' CLIP lights stay dark on the loudest blend.
- Where does the mixer's ceiling land in the Howler's file? Record a test that goes into the red on purpose (setup S3) and run `pnpm clipcheck` on it: the level its flat tops pile up at is the mixer's ceiling as the Howler sees it, which the demos currently assume (`HOWLER_BELOW_RED_DB` in `src/lib/model.ts`).
- Does swapping the LOWs lower a blend's peak on the XDJ-RX2? The site no longer offers it as a fix, because of a simulation on 10 released tracks: a LOW cut made a blend quieter but left its peak where it was, and only a fader brought it down (`LOW` in `src/lib/blend/model.ts`). Pioneer publishes the EQ's range but not its curves, or how fast the meters respond. Record the same blend twice on the Howler, once with both LOWs at 12 o'clock and once with the incoming LOW fully down, and compare the peaks in Audacity's Amplify. Watch the MASTER meters too: if they drop and the file's peak doesn't, the meters are hiding peaks.
