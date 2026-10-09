# Out of the red

A small static site that teaches the DJs and crew at our events how to get clean recordings of their sets. Every set is recorded on a Howler Recorder+Streamer fed from MASTER 2 of a Pioneer DJ XDJ-RX2, and clipping in the mixer can't be undone afterwards. The site explains why with hands-on demos, and gives everyone a short set of rules, checklists and printable booth labels.

It grew out of a one-page "Two ceilings" clipping lab. This version is written for DJs and crew (often the same people), checked against the manufacturers' documents, and built to be hosted anywhere static files can go.

## Pages

| Path | What's there |
|---|---|
| `/` | Playing, in the header: the reason, the drawing of the meters, three rules, TRIM, a blend fix and control ownership. No exercise is required to find an instruction |
| `/night/` | Crew, in the header: Before doors as one list in the order of the work (table, leads, power, levels, recording), with its five drawings above the lines they serve. Then Changeover, the booth's eight fault drills (F1 to F8) and End |
| `/setup/` | Rig reference, one step from Crew: what feeds what, and how each unit is set. It carries no tests; an event's work is in Crew |
| `/learn/` | Learn, in the header: listening test, blend practice, meter check, signal path, Two ceilings, explanations, glossary and sources |
| `/recordings/` | Recordings, one step from Crew: copy, check and prepare files, plus the two drills for what is found by listening the day after: crunch (F9) and a hollow or one-sided recording (F11) |
| `/print/` | Print kit, one step from Crew: six A4 sheets: booth cards, optional tape labels, Before doors in two readable parts, its five drawings, then Changeover and End. Also group-chat messages |

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

For the optional Safari-engine checks, install WebKit and run its phone profile against the build:

```sh
pnpm exec playwright install webkit
CROSS_BROWSER=1 pnpm test:e2e --project=webkit-phone
```

Use the same `BASE_PATH` for building and testing. This profile checks the WebKit engine with iPhone emulation; field testing still needs the actual phones. Offline tests stop a dedicated local server and restart saved browser profiles. They avoid WebKit's broken offline-emulation flag in Playwright 1.63 ([upstream issue](https://github.com/microsoft/playwright/issues/42775)).

## Offline use

On a production build, choose **Save for offline use** in the footer (Crew also links to it near the top). The saved package includes every page, local font, diagram, interactive demo and the short MP4. External manuals still need a connection. Check the guide by closing its tabs and reopening in airplane mode before leaving; browser storage can be evicted. Keep the printed kit and Crew/Rig reference PDFs as a backup.

`scripts/offline.ts` inventories the built output and writes a versioned, base-aware `sw.js`. Every download has a build-time integrity hash. Readiness requires all files, not just worker registration. Updates wait until old tabs close; a failed download retains the previous package. The save action can repair partially evicted data. Development does not install a worker. After a production build, use `pnpm preview` to test it locally.

Checklist ticks retain their existing expiry/reset/undo behaviour. Their keys include the base path and a fingerprint of the instructions, so revised steps start unticked.

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
| `src/lib/checklists.ts` | The checklists (shared by `/night/`, `/recordings/` and the print cards) |
| `src/lib/fixes.ts` | Shared fault procedures on Crew and Recordings |
| `src/lib/rack.ts` | Which amp feeds which speakers |
| `src/lib/figures.ts` | The captions of C1's drawings, shared by Crew, the print kit and the printed revision |
| `src/components/figures/` | C1's drawings: the table, the booth, the rack's rear and front, the mixer's rear and the Howler's IN end |
| `src/lib/messages.ts` | The group-chat messages on `/print/` |
| `src/pages/**` | Page prose |

The writing style is UK English, second person, short sentences, and hardware names exactly as printed on the XDJ-RX2 (TRIM, MASTER LEVEL, BOOTH MONITOR). `docs/DESIGN.md` covers the visual system.

## The model behind the demos

The demos simulate the rig, so a few assumptions are baked in. They live in `src/lib/model.ts` and `src/lib/xdj.ts`, and the site states them where they matter.

- **The meters** copy the XDJ-RX2: twelve LEDs from −24 to +12 dB, green to −3, orange from 0 to +9, red at +12. The channel meters show each channel before its fader; the MASTER meters show the mix.
- **Ceiling 1**, inside the mixer, sits at the red light. Pioneer only says red "may" distort and doesn't publish the margin, so the site treats red as the top.
- **Ceiling 2**, the Howler's input, isn't published anywhere. The demos assume it overloads 6 dB below the mixer's red with the recording level fully up. The site carries no test for the real point: on the night the Howler's LEVEL light is the check.
- **Knobs after the mix** (MASTER LEVEL, BOOTH MONITOR) run from off to unity and can't add gain.
- **Sound** is synthesised in the browser (`src/lib/dsp/synth.ts`): two short 124 BPM loops (drums, a bass line, chord stabs) in the same key and tempo, so every device hears the same thing and nothing needs a licence. Clean and clipped versions are loudness-matched (ITU-R BS.1770 weighting) before any comparison.
- **Blends** of the synth loops add the full 6 dB, because they share one kick in phase: the worst case. Released tracks add a little less (below), and the rules plan for all 6.

Nothing plays until a button is pressed. Sound starts quietly, fades in, stops when the tab is hidden, and only one demo plays at a time (`src/lib/audio/engine.svelte.ts`).

## How blends and the EQ move a peak

Three things on the site rest on a measurement rather than a maker's document: the guide's 2.4 on how much a blend adds, the blend lab keeping only LOW's boost half, and the fixes that point at a fader rather than a bass swap. `scripts/research/blend-peaks.mjs` runs it on any folder of tracks:

```sh
node scripts/research/blend-peaks.mjs ~/Music/some-tracks --start 60 --seconds 90
```

It decodes a stretch of each track with `ffmpeg` into a temp folder (never the repo), scales each to a sample peak of 1, as if every channel meter read the same light, and measures sample peaks throughout. The EQs are RBJ biquads, in a range of shapes, because Pioneer publishes only the range of each knob (LOW at 20 Hz, MID at 1 kHz, HI at 20 kHz). A blend is 60 seconds of two tracks, the second resampled to the first's tempo with its beat grid on the first's and both faders up. The loudest sample of the sum is set against the louder of the two tracks.

On ten released tracks from a DJ's library (90 seconds each, 92 to 173 BPM; not in the repo), with 79 ordered pairs long enough to blend:

| Move on the incoming track | The blend's peak over the louder track |
|---|---|
| None | +5.0 dB median (10–90%: 4.2 to 5.4, worst 5.6) |
| Fader 3 dB down | +3.6 dB (worst 4.3) |
| Fader 6 dB down | +2.6 dB (worst 3.2) |
| LOW fully down, shelf from 70 Hz / 150 Hz, or everything under 150 Hz out | +5.1 to +5.4 dB (worst 7.0) |
| MID fully down | +4.5 dB |
| HI fully down | +5.0 dB |
| None, with the incoming track half a beat or a quarter beat late | +5.0 dB |

- A LOW cut makes a blend about 2.4 dB quieter in energy, but not lower in peak: taking a mastered track's lows out raised its own peak on 9 of 10 tracks (median 2.0 dB, up to 2.9), and on 8 of 10 with the same cut run both ways, with no phase shift. The lows are about two thirds of a track's energy, but a mastered track's peak is set across the whole spectrum.
- +6 dB on one band raised a track's peak by a median 2.4 to 4.9 dB for LOW (depending on where the shelf starts), 2.9 to 4.2 dB for MID and 1.3 to 4.4 dB for HI: any of the three can take a channel up a light or two.
- Lined-up kicks are not what makes a blend peak: the same blends half or a quarter beat apart peaked just as high, and two in three passed +4 dB within 2 seconds (five in six within 10).

These are simulations, with EQ shapes Pioneer does not publish, and sample peaks, not the XDJ-RX2's meters. The open questions below include a test on the real kit.

## Share image and chat clip

`public/og.png` (the link preview) and `public/media/turn-it-down.mp4` (a ten-second silent clip for group chats) are rendered from `scripts/media/og.html` and `scripts/media/clip.html` with the site's own fonts. The share image draws the meters as Playing does (`src/components/MeterTargets.astro`); keep the two in step by hand. After changing either page, run `node scripts/media/render.mjs` (it needs Chromium from Playwright and `ffmpeg`).

## Checking a recording for clipping

`pnpm clipcheck` reads WAV files and says whether they clipped, where, and at what level. It reads a file a piece at a time, so a whole night off the Howler is fine: the analysis takes a few seconds per hour of audio, and reading the card takes longer than that. Its counts cover the whole file, however long.

```sh
pnpm clipcheck "/Volumes/HOWLER/Howler recordings/"*.WAV
pnpm clipcheck set.wav --minutes   # every minute with a mark, not just the worst
pnpm clipcheck set.wav --json      # the findings as JSON, with the first 500 of each mark
```

It looks for two marks:

- **Runs at the file's peak:** three or more samples in a row at the file's own highest or lowest value. In the file as the Howler wrote it, that is full scale, and the Howler's input clipped. A copy normalised afterwards keeps the runs at its new peak, and the check still finds them there. Audacity 3's Find Clipping also wants 3 in a row, but only at full scale (within about 0.0003 dB of it), so it misses them in a copy turned down. Audacity 4 does not ship Find Clipping. Clipping that happened before the Howler does not repeat a sample exactly, because the analogue stages add noise. A clean file that peaks just under full scale has no runs either.
- **Flat tops piled up at one level, below full scale**, from something before the Howler, such as the mixer past its red. On the way to the recorder the analogue stages tilt the flat tops and add noise, so no two samples are the same, and Audacity's Show Clipping and the SoX or ffmpeg stats read these files as clean. The check smooths out the converters' ringing, fits a straight line to the middle of each top, and pairs each flat top with its neighbour on the other side of the wave to cancel the drift. Then it looks for a pile: at least 8 flat tops within 0.5 dB, 3 times as dense as in the 2 dB below. A pile at the file's loudest level is where a ceiling in the rig shows. A pile further down, such as a channel in the red with its fader down, must also hold a third of all the flat tops, and counts only those at the loudest level of the 2 seconds before them. Released tracks often have flat tops of their own, from their mastering or from one sound under louder drums, each at the level the track was played.

The report says what the file shows, then what that means for the rig if the file is as the Howler wrote it, and which drill on the site to follow. It also gives the file's levels against the guide's target (`TARGET` in `src/lib/model.ts`), and the minutes to listen to.

What it cannot do: tell a track with flat tops of its own from a channel or the mixer in the red, when either sits at one level (the report names both, and F9 on the Recordings page compares the track's own file); find light clipping (see the table below); find clipping that the mixer rounds off instead of flattening; or find a pile below the loudest level that is a small part of a long file's flat tops. A copy saved with dither keeps only some of the runs, so check the file as the Howler wrote it. The Howler MK1 splits a night into files of about 3.5 hours (4 GB), so check them all, and do not trust the MK1's file dates.

The code is in `src/lib/clipcheck/` and has no dependencies, so a page on the site could use it too.

### How well it finds clipping

The tests build recordings from the site's synth and pass them through a model of the analogue stages (`src/lib/clipcheck/analogue.ts`: AC coupling, the converters' filters, noise, and 24-bit samples that stop at full scale). `scripts/clipcheck-calibrate.ts` does the same with real music. It takes 90 seconds from the middle of each track, plays them into sets the way the guide says (each track TRIMmed to the first orange, give or take 1.5 dB, with 8-second blends where both faders are up, and the mixer's red at −6 dBFS in the file), and checks the sets clean and clipped. Track orders, levels and noise come from fixed seeds. On 10 released dance tracks, which are not in the repo, it found:

| Found, by dB past the ceiling | 0.5 | 1 | 2 | 3 | 4 | 6 |
| --- | --- | --- | --- | --- | --- | --- |
| The master in the red (3 sets) | 0/3 | 0/3 | 1/3 | 3/3 | 3/3 | 3/3 |
| A channel in the red with its fader 6 dB down, then a louder blend (each track) | 3/10 | 5/10 | 9/10 | 9/10 | 10/10 | 10/10 |
| The same channel, one track in a clean set (3 sets) | 0/3 | 1/3 | 2/3 | 3/3 | 3/3 | 3/3 |
| The Howler clipped (3 sets) | 2/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |
| The Howler clipped, then normalised to −2 dBFS | 2/3 | 3/3 | 3/3 | 3/3 | 3/3 | 3/3 |

It raised no false alarms on 10 clean sets at the guide's levels, or on the same sets turned up to peak at −1 dBFS. On those sets, the biggest pile below the loudest level held 20% of the flat tops, and a pile there needs a third. To run it on your own tracks (it needs ffmpeg, and 10 tracks take about 15 minutes):

```sh
node --import ./scripts/resolve-ts.mjs scripts/clipcheck-calibrate.ts ~/Music/some-tracks/
```

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

The guide is for the field, so it carries no tests that need a laptop (the owner, 28 September 2026). These are the things the makers don't publish. The site says so where they matter, and no checklist or drill depends on the answer:

- Does MASTER ATT reach MASTER 2, MASTER 1, and the MASTER meters? The XDJ-RX2 has one MASTER ATT setting (−12 dB, −6 dB or 0 dB, manual p. 32), and its manual doesn't say which sockets it acts on. Pioneer's help pages for the DJM-V10, DJM-750MK2 and DJM-450 say theirs acts on MASTER 1 and MASTER 2 together, which is the likely answer here. No card changes it: F1 turns the recording down at MASTER LEVEL, and the room is made up at the amps.
- Do the channel meters read after the EQ, and before the fader? Pioneer doesn't say; only VirtualDJ's layout page does. Learn 4.4 says how to check both on the mixer alone.
- Are the DriveRack's limiters set for these amps? dbx sets the DriveRack's limiters "based on where you have set your amplifier attenuators" (pp. 19–21), but doesn't say what its wizard assumes for the GX7s. On the night the amps are set by ear with their CLIP lights dark, and the gear carries no marks.
- Where does the mixer's ceiling land in the Howler's file? The demos assume it (`HOWLER_BELOW_RED_DB` in `src/lib/model.ts`). `pnpm clipcheck` on a night's file shows it, if the mixer reached red: the level its flat tops pile up at is the mixer's ceiling as the Howler sees it.
- How much hiss does the Howler add? Howler publishes no noise figure, and the guide's 4.3 assumes it is not unusually noisy.
- Does swapping the LOWs lower a blend's peak on the XDJ-RX2? The site no longer offers it as a fix, because of a simulation on 10 released tracks: a LOW cut made a blend quieter but left its peak where it was, and only a fader brought it down (`LOW` in `src/lib/blend/model.ts`). Pioneer publishes the EQ's range but not its curves, or how fast the meters respond. Record the same blend twice on the Howler, once with both LOWs at 12 o'clock and once with the incoming LOW fully down, and compare the peaks in Audacity's Amplify. Watch the MASTER meters too: if they drop and the file's peak doesn't, the meters are hiding peaks.
