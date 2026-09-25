# Design notes

How the site looks and why. If you change the look, change this file too.

## The brief

- **Subject:** keeping DJ set recordings clean on our rig: a Pioneer XDJ-RX2 feeding a Howler recorder from MASTER 2, with the PA running through a dbx DriveRack PA2 and two QSC GX7 amps, and booth monitors on BOOTH.
- **Audience:** DJs of every level who play our events, and the crew who set up the booth. They're often the same people. Most will open a link from a group chat, on a phone.
- **The site's job:** change what people do in the booth. DJs keep the channel meters out of the red. Crew set the record level once and tape it, and make the room loud at the amps. Everyone understands why, so the rules don't feel arbitrary.

## Structure

One guide that gets deeper as it goes, and three tools for doing the job.

| Page | Reading mode | What's on it |
|---|---|---|
| `/` The guide | Learning | What to know by heart, then four parts: 1 Why it matters, 2 Playing a set, 3 The rig and the recording, 4 Under the hood, then words and sources. Sections are numbered (2.1, 3.4) from one list, `src/lib/sections.ts` |
| `/night/` On the night | Doing, in a hurry | Tabs in night order (C1 Doors, C2 Changeover, F Something's wrong, C3 After), the crew's know-by-heart box, the checklists and the drills |
| `/setup/` Setting up | Doing, once | The wiring, the first-time checklist, the record level walkthrough and the one-off procedures and tests |
| `/print/` | Making | The booth card, tape tags, checklist cards and chat messages |

Why one guide: DJs and crew are often the same people, and splitting pages by audience fails when roles overlap (NN/g). Doing a job and learning why are different reading modes (Diátaxis, GOV.UK step by step), so the checklists and drills live on their own short pages, linkable from the group chat. The old addresses (`/dj/`, `/crew/`, `/lab/`, `/why/`) forward to the same section in its new home (`layouts/Moved.astro`).

## Concept: a quick reference handbook for the booth

The site reads like a flight-deck quick reference handbook (QRH), in plain words. The mixer already speaks cockpit colour: its meter is green when normal, amber (the site says orange, as DJs do) for caution, red for warning. So the site borrows the QRH's format, not its vocabulary:

- **Know by heart.** What a DJ, or the crew, must know without looking goes in boxed challenge-and-response lines, in the pale yellow printed checklists use (UK CAA CAP 676 recommends yellow or white grounds and four items or fewer).
- **Checklists** are challenge and response: the control, leader dots, and the state it should be in, the response in the action colour.
- **Procedures** are cards: a black title strip with the number and kind (Every track, Fix, Once), a caution before the steps it guards, then the steps.
- **Drills** for when something goes wrong: titled with the light as printed, drawn lit; a condition and an objective; numbered steps with "Choose one" branches; an end mark.
- **Thumb tabs**: the index marks each part with a tab, filled for the part you're in; phones get a sticky tab strip.

By day it's the printed card: white, near-black ink, one action colour. By night it's the cockpit display: near-black ground, light text, the action colour made brighter. The hardware (lab panels, meters, LEDs) is black in both, because the gear is black, and flat with a printed outline so it still reads against the dark display.

This direction was picked from four technical-manual variations on the design canvas (Operating instructions, Quick reference handbook, Drawing set, Braun booklet), after an audit of AI-design tells in the previous look.

## Colour

All colours are tokens in `src/styles/tokens.css`; components never use raw hex. Page tokens change with the theme; hardware tokens don't. Text on a panel uses hardware tokens; text on the page uses page tokens.

| Token | Light | Dark | Role (contrast on the page, light / dark) |
|---|---|---|---|
| `--paper` | `#FFFFFF` | `#0A0C0E` | The card, or the display |
| `--paper-2` | `#F1F3F4` | `#15191C` | Shaded cells: the colour-code panel |
| `--ink` | `#0B0C0D` | `#E8ECEF` | Text and the black strips (19.6:1 / 16.5:1) |
| `--ink-2` | `#353B40` | `#C3CAD0` | Secondary text, including any instruction (11.4:1 / 11.8:1) |
| `--ink-3` | `#5E666C` | `#8C969D` | Metadata at 15px or more (5.8:1 / 6.5:1) |
| `--ink-4` | `#9AA2A8` | `#5B646B` | Decoration only: leader dots |
| `--action` | `#006A8E` | `#3FD0FF` | Only what to do: a checklist's response, a drill's step (6.1:1 / 10.9:1) |
| `--tint` | `#FFF4C7` | `#16191C` | Know-by-heart boxes, edged with `--tint-edge` |
| `--warning` | `#C42519` | `#FF5A4E` | Something going wrong: the F tab, the drills (5.8:1 / 6.4:1) |
| `--strip` | `#0B0C0D` | `#2A3137` | Title strips (part bars, procedure and checklist cards), with `--on-strip` text (19.6:1 / 12.1:1). A raised header by night, not a white bar |
| `--rule` | `#C5CBD0` | `#2C3238` | Hairlines |

Hardware: `--hw #1E2225` panels, `--panel-edge` outlines (invisible by day, `#5B646B` by night, 3:1), `--hw-label` text (10:1), `--hw-bright` headings and values, `--hw-action #3FD0FF` for actions on a panel.

LED colours copy the hardware: yellow-green `#A8E23A`, orange `#FF9F0A`, red `#FF3B30`, each with an unlit tint. They only ever mean a signal state; a control that's on (a Listen key playing) lights white. Chart marks (`--sig`, `--sig-b`, `--dmg`) sit on `--screen` in both themes and are validated once against it. A meter never relies on colour alone: position, the printed scale, the CLIP label and a text readout carry the same information.

## Type

B612, designed for Airbus cockpit displays and released under an open licence, for everything on the page and in the labs' readouts: `--font-body` (400, 700, italic 400) and `--font-display` (700) for headings. It's wide, so the scale sits a step below a narrower face's: body 17px (18px from 48rem), line height 1.6, measure `--measure` (about 65 characters). Headings are sentence case. Archivo at 75% width (`--font-label`) stays only for names printed on the gear, set as silk-screen on the panels: TRIM, MASTER, CH1. Big Shoulders Stencil (`--font-stencil`) stays on printed tape. All fonts are self-hosted from Fontsource.

Anything someone acts on is at least 15px and never in `--ink-4` or `--hw-label-2`. "XDJ-RX2" in running text is wrapped in `.nobr`.

## Layout

One reading column, `--measure`, in the `.flow` grid (`global.css`). Phones: one column in a gutter of at least 16px. Laptops: the column hung from the left of a 66rem frame; labs whose width shows something (`.wide`) extend into the rest. Wide screens (80rem up): the index rail (13rem), the reading column and a notes column (15rem), 3rem apart. The guide's parts are subgrids (`Part.astro`, `.subflow`), so notes and labs line up with the page. Text is left-aligned throughout.

## Components

- **Part** (`Part.astro`): a black bar with the part's number and title, its time and audience, and its objective.
- **Know by heart** (`KnowByHeart.astro`): the tinted box of challenge/response lines built from `rules.ts`, each with what to do if it isn't so and a "See 2.1" reference.
- **Procedure** (`Procedure.astro`): a checklist card with a black title strip, a caution, challenge/response steps with notes, and a `.source` line for the manufacturer's page.
- **Index** (`Contents.astro`) and **tabs** (`Tabs.astro`): thumb-tab markers, reading times, the F row for drills; the rail on wide screens, the sticky tab strip on phones.
- **Colour code** (`ColourCode.astro`): the meter's colours in cockpit terms, with the LEDs' own colours as swatches.
- **What people say** (`Myths.astro`): a static two-column table, the belief beside what's true, with the manufacturer's page.
- **Panel**: the hardware box around every interactive except the checklists. Flat, `--radius-panel` (6px), a 1px outline, no shadow. One surface per panel; inner boxes only for a real screen or meter well. Controls use `--radius-control` (4px). No pills.
- **Checklist card** (`Checklist.svelte`): a printed card, not a panel. A `--strip` title with its code (C1, C2, C3, S1) and time budget, a checkbox per challenge/response line, the call line at the end.
- **Drill** (`DrillCard.astro`): a `--strip` title with the light drawn lit and the drill's code (F1–F11), condition and objective, numbered steps, "Choose one" branches with ◆, "Go to step" links and the ■ ■ ■ ■ end mark.
- **Keys and pads** (`ui/*`): square, flat, 4px. A selected pad lights all over. A preset that stands for a clean or clipped level keeps a dark face and lights a small bar LED in green or red. The primary key is cyan lettering in a 2px frame, so it can't be mistaken for a lit pad. Settings with named positions are slide switches (`hear-it/Choice.svelte`).
- **Status lamp**: a lab's challenge state as a square lamp with a printed legend, never a pill.
- **The Howler** (`ui/HowlerTop.svelte`): one top-down line drawing of the MK1 (finned case, RCA sockets at both ends, the RECORD button, BATTERY and LEVEL lights with their printed names), used wherever the Howler appears. Only LEVEL ever lights. Knobs have the XDJ-RX2's printed dot scale, a ribbed skirt and a white pointer.
- **Meter figure** (`MeterAnatomy.astro`), **LED ladder**, **scopes** and **sliders**: flattened to the two radii.

## Voice

UK English, second person, plain statements. Conditions are written as "If …, …". Say the mechanism, and a number where it helps. No two-beat slogans, no colon slogans, no "Question? Answer." lead-ins outside a drill's branches. Crew are allies, not police. Hardware names are written as printed (TRIM, MASTER LEVEL, BOOTH MONITOR). The makers' own words are quoted with the page, and "Not published" or "We assume" says where they're silent.

## Motion and sound

One orchestrated moment: on load, the hero meter's lights climb to the second orange and stop, short of the red. Everything else moves only in response to the reader, and `prefers-reduced-motion` turns motion off. Nothing plays until the reader presses a button; sound starts quietly, stops when the tab is hidden, and clean and clipped versions are loudness-matched before any comparison.
