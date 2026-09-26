# Design notes

How the site looks and why. If you change the look, change this file too.

## The brief

- **Subject:** keeping DJ set recordings clean on our rig: a Pioneer XDJ-RX2 feeding a Howler recorder from MASTER 2, with the PA running through a dbx DriveRack PA2 and two QSC GX7 amps, and booth monitors on BOOTH.
- **Audience:** DJs of every level who play our events, and the crew who set up the booth. They're often the same people. Most will open a link from a group chat, on a phone.
- **The site's job:** change what people do in the booth. DJs set each track's loudest part to the first orange light and keep the MASTER meters' top orange dark. Crew set the recording level once and tape it, and set the room's volume at the amps, no higher than the RIG marks. Everyone understands why, so the rules don't feel arbitrary.

## Structure

One guide that gets deeper as it goes, and three tools for doing the job.

| Page | Reading mode | What's on it |
|---|---|---|
| `/` The guide | Learning | What to know by heart, then four parts: 1 Why it matters, 2 Playing a set, 3 The rig and the recording, 4 Under the hood, then words and sources. Sections are numbered (2.1, 3.4) from one list, `src/lib/sections.ts` |
| `/night/` Crew on the night | Doing, in a hurry | Tabs in night order (C1 Doors, C2 Changeover, F Something's wrong, C3 End), the crew's know-by-heart box, the checklists and the drills, then C4 Next day: the work on the files and the faults you find in a recording |
| `/setup/` Setting up | Doing, at every event | S1, the whole setup in the order the rig is built; the wiring table; the recording level; the DriveRack and amps; the one-off test and wizard, marked Once |
| `/print/` | Making | The booth card, tape tags, checklist cards and chat messages |

Why one guide: DJs and crew are often the same people, and splitting pages by audience fails when roles overlap (NN/g). Doing a job and learning why are different reading modes (Diátaxis, GOV.UK step by step), so the checklists and drills live on their own short pages, linkable from the group chat. The old addresses (`/dj/`, `/crew/`, `/lab/`, `/why/`) forward to the same section in its new home (`layouts/Moved.astro`).

## Concept: a quick reference handbook for the booth

The site reads like a flight-deck quick reference handbook (QRH), in plain words. The mixer's meter already looks like cockpit lighting: green, then orange (a flight deck's amber), then red. But on the mixer, orange is where the loudest parts of a track belong and red is the ceiling, so the site borrows the QRH's format, not its colour meanings or its vocabulary:

- **Know by heart.** What a DJ, or the crew, must know without looking goes in boxed challenge-and-response lines, in the pale yellow printed checklists use (UK CAA CAP 676 recommends yellow or white grounds and four items or fewer).
- **Checklists** are challenge and response: the control, leader dots, and the state it should be in, the response in the action colour.
- **Procedures** are cards: a black title strip with the number and kind (Every track, Fix, Once), a plain sentence before any step with a real consequence, then the steps.
- **Drills** for when something goes wrong: titled with the light as printed, drawn lit; a condition and an objective; numbered steps with "Choose one" branches; an end mark.
- **Thumb tabs**: the index marks each part with a tab, filled for the part you're in; phones get a sticky tab strip.

By day it's the printed card: white, near-black ink, one action colour. By night it's the cockpit display: near-black ground, light text, the action colour made brighter. The hardware (lab panels, meters, LEDs) is black in both, because the gear is black, and flat with a printed outline so it still reads against the dark display.

This direction was picked from four technical-manual variations on the design canvas (Operating instructions, Quick reference handbook, Drawing set, Braun booklet), after an audit of AI-design tells in the previous look.

## Colour

All colours are tokens in `src/styles/tokens.css`; components never use raw hex. Page tokens change with the theme; hardware tokens don't. Text on a panel uses hardware tokens; text on the page uses page tokens.

| Token | Light | Dark | Role (contrast on the page, light / dark) |
|---|---|---|---|
| `--paper` | `#FFFFFF` | `#0A0C0E` | The card, or the display |
| `--paper-2` | `#F1F3F4` | `#15191C` | Shaded cells and hovers: a key under the pointer, a chosen answer's row |
| `--ink` | `#0B0C0D` | `#E8ECEF` | Text and the black strips (19.6:1 / 16.5:1) |
| `--ink-2` | `#353B40` | `#C3CAD0` | Secondary text, including any instruction (11.4:1 / 11.8:1) |
| `--ink-3` | `#5E666C` | `#8C969D` | Metadata at 15px or more (5.8:1 / 6.5:1) |
| `--ink-4` | `#9AA2A8` | `#5B646B` | Decoration only: leader dots |
| `--action` | `#006A8E` | `#3FD0FF` | Only what to do: a checklist's response, a drill's step (6.1:1 / 10.9:1) |
| `--tint` | `#FFF4C7` | `#1F1A0B` | Know-by-heart boxes: pale yellow by day, a dim printed yellow by night. Text on it by night: `--ink` 14.6:1, `--ink-2` 10.5:1, `--ink-3` 5.8:1, `--action` 9.6:1 |
| `--tint-edge` | `#0B0C0D` | `#D9BF5E` | The box's 2px edge: ink by day, the day's yellow by night (10.8:1 on the display), never an LED's orange |
| `--warning` | `#C42519` | `#FF5A4E` | Something going wrong: the small lamp before F on the drills' tab and index row, the drills' lit lights (5.8:1 / 6.4:1). Navigation is never red |
| `--strip` | `#0B0C0D` | `#15191C` | Title strips (part bars, procedure and checklist cards), with `--on-strip` text (19.6:1 / 16.3:1). A raised header by night, not a white bar |
| `--strip-edge` | `#0B0C0D` | `#E8ECEF` | A strip's 2px top edge: the strip itself by day, a light edge by night that lifts the strip off the display (the strip alone is 1.1:1) |
| `--rule` | `#C5CBD0` | `#2C3238` | Hairlines |

Hardware: `--hw #1E2225` panels, `--panel-edge` outlines (invisible by day, `#5B646B` by night, 3:1), `--hw-label` text (10:1), `--hw-bright` headings and values, `--hw-action #3FD0FF` for actions on a panel.

LED colours copy the hardware: yellow-green `#A8E23A`, orange `#FF9F0A`, red `#FF3B30`, each with an unlit tint. They only ever mean a signal state; a control that's on (a Listen key playing) lights white. Chart marks (`--sig`, `--sig-b`, `--dmg`) sit on `--screen` in both themes and are validated once against it. A meter never relies on colour alone: position, the printed scale, the CLIP label and a text readout carry the same information.

## Type

B612, designed for Airbus cockpit displays and released under an open licence, for everything on the page and in the labs' readouts: `--font-body` (400, 700, italic 400) and `--font-display` (700) for headings. It's wide, so the scale sits a step below a narrower face's: body 17px (18px from 48rem), line height 1.6, measure `--measure` (about 65 characters). Headings are sentence case. Archivo at 75% width (`--font-label`) stays only for names printed on the gear, set as silk-screen on the panels: TRIM, MASTER, CH1. Big Shoulders Stencil (`--font-stencil`) stays on printed tape. All fonts are self-hosted from Fontsource.

Anything someone acts on is at least 15px and never in `--ink-4` or `--hw-label-2`. "XDJ-RX2" in running text is wrapped in `.nobr`.

## Layout

One reading column, `--measure`, in the `.flow` grid (`global.css`). Phones: one column in a gutter of at least 16px. Laptops: the column hung from the left of a 66rem frame; labs whose width shows something (`.wide`) extend into the rest. Wide screens (80rem up): the index rail (13rem), the reading column and a notes column (15rem), 3rem apart. The guide's parts are subgrids (`Part.astro`, `.subflow`), so notes and labs line up with the page. Text is left-aligned throughout.

A tab strip that sticks to the top of the screen (the guide's below 80rem, the night page's at every width) sets `--sticky-top` to its height. The page's scroll padding is that plus 1rem, so a jump or a focused control always lands clear of the strip; components don't add scroll margins of their own, and anything else that pins sits at `--sticky-top`. The guide scrolls smoothly unless motion is reduced; the night page jumps instantly.

## Components

- **Part** (`Part.astro`): a black bar with the part's number and title (a `--strip-edge` top edge by night), then what a reader can do by the end, as one plain sentence. No time, audience or "Objective." label: reading times are in the index.
- **Know by heart** (`KnowByHeart.astro`): the tinted box of challenge/response lines built from `rules.ts`, numbered from 1 in every box, each with what to do if it isn't so and a "See 2.1" reference. A screen reader hears a comma between challenge and response.
- **Procedure** (`Procedure.astro`): a checklist card with a black title strip, then challenge/response steps with notes, and a `.source` line for the manufacturer's page. A real consequence is said in a plain sentence before the steps (`caution`) or before its own step (`before`), with no label. "Warning." is only for injury: the mains earth and hearing.
- **Tabs** (`Tabs.astro`): one design wherever tabs appear. Equal-width tabs, at least 3rem tall, hang from a 2px ink rule: the code in bold (1, C1, F) over a short label in `--ink-2` that may wrap to two lines. The one you're in is filled with `--ink`, lettered in `--paper`, in both themes; every tab shows the focus ring. The drills' tab carries a small `--warning` lamp before F and is otherwise like the rest. Each tab is named code first ("1: Why it matters"). The guide's strip (parts 1 to 4: Why, Playing, Rig, How) gives way to the index rail on wide screens; the night page's (C1 Doors, C2 Changeover, F Something's wrong, C3 End) stays at every width.
- **Index** (`Contents.astro`): a row per part with its thumb tab, drawn as the notch it cuts in a handbook's edge (open on the page's side, filled for the part you're in, never a closed box), its number, title and reading time, which drops under the title when there's no room. The guide's last row, F Something's wrong, goes to the night page and has the drills' lamp. The rail on wide screens, below anything that sticks above it.
- **Hero** (`Hero.astro`): the title, the lede and the meter in its bezel, lit to the first orange (0), the aim for a track's loudest part. An "Aim" bracket marks the 0 light, and the zones are named under the scale in plain words (green, headroom; orange, the loudest parts; red, may distort). It's the page's one animation.
- **What people say** (`Myths.astro`): short pairs. The belief, quoted in regular italic `--ink-2`; what's true, in one or two sentences at regular weight, ending on what to do instead; and the maker's page where there is one. No labels.
- **Panel**: the hardware box, only ever for real gear: meters, faders, scopes, the Howler. Flat, `--radius-panel` (6px), a 1px outline, no shadow. One surface per panel; inner boxes only for a real screen or meter well. Controls use `--radius-control` (4px). No pills.
- **Quiz card** (`MeterCheck.svelte`, `quiz/*`): the meter check's questions and "How sure are you?" are printed cards, not panels. A 2px ink frame, a `--strip` title, answers as ruled rows with a real radio, the chosen answer in `--action`, and right or wrong marked with a tick or a cross and words, never colour alone. "How sure are you?" is a three-step printed scale, so it can't pass for a fourth answer. Keys are printed (`quiz/Key.svelte`). Any gear in the question (a meter, the Howler, the BOOTH MONITOR knob) sits on a small black plate.
- **Paper in both themes**: the print kit's previews carry `data-paper`, which keeps the day's page colours by night (`tokens.css`), as a printout would.
- **Wiring table** (`/setup/` S2): the rig as a table built from `rig.ts` and `tags.ts` (what, fed from, set to, its tape), a labelled list on phones, linking to the interactive signal path in 3.1.
- **Checklist card** (`Checklist.svelte`): a printed card, not a panel. A `--strip` title with its code (C1, C2, C3, S1) and when it's done, then a checkbox per line: the printed name, leader dots and the state you can see. Read-and-do, for one person, with no time budget and no call line.
- **Drill** (`DrillCard.astro`): a `--strip` title with the light drawn lit and the drill's code (F1–F11), then an Objective, with a Condition only when it adds to the title. "Now" holds numbered steps: one instruction each, the exact words to say to the DJ, "Choose one" branches with ◆ that are outcomes you can see, "Go to step" links and the ■ ■ ■ ■ end mark. "At the changeover" holds what can wait, and "Why" explains in a sentence or two. One phone screen each where it fits.
- **Faders** (`ui/Fader.svelte`): a stretch of the track can be tinted `sig` or `dmg` for a chart's meaning, or `neutral` for a band that's only a range (the target band). On a touch screen every fader moves only when you drag its cap (`ui/thumbDrag.ts`), so a scroll that starts on one never changes it. In the blend lab each deck's TRIM and LOW sit right under its fader.
- **Keys and pads** (`ui/*`): square, flat, 4px. A selected pad lights all over. A preset that stands for a clean or clipped level keeps a dark face and lights a small bar LED in green or red. The primary key is cyan lettering in a 2px frame, so it can't be mistaken for a lit pad. Settings with named positions are slide switches (`hear-it/Choice.svelte`).
- **Status lamp**: a lab's challenge state as a square lamp with a printed legend, never a pill.
- **The Howler** (`ui/HowlerTop.svelte`): one top-down line drawing of the MK1 (finned case, RCA sockets at both ends, the RECORD button, BATTERY and LEVEL lights with their printed names), used wherever the Howler appears. Only LEVEL ever lights. Knobs have the XDJ-RX2's printed dot scale, a ribbed skirt and a white pointer.
- **Meter figure** (`MeterAnatomy.astro`): a manual figure, a line drawing on the page with numbered callouts (the channel meters, the middle meters, the CLIP light) keyed to a list under it. Black only behind the LEDs.
- **Meters, everywhere**: the LED colours stay the hardware's, but green and orange are too close for some colour-blind readers, so every meter also prints a wider break at the green/orange and orange/red boundaries and sets 0 in bold. Scale labels come from `scaleLabel()` in `xdj.ts` and read like the panel: −24 … 0, +3 … +12.
- **Signal path** (`SignalPath.svelte`): part names at least 15px at every width, the parts off the signal's path in `--hw-label`. On phones the explanation of the part you tapped rides along the bottom of the screen, above the Stop bar, so it's always in view. Ceilings are dashed rings in `--screen-text`, as on every chart; red is only for damage done.
- **Charts**: a target band is neutral, never a signal colour, so blue only ever means your signal; flat tops are drawn in `--dmg`; every axis says what it measures.
- **LED ladder**, **scopes** and **sliders**: flattened to the two radii.

## Voice

The register is a reference guide's: an equipment manual, a quick reference handbook, GOV.UK. It isn't a tutor's or an assistant's. Readers are often in a dark, loud booth, on a phone, in a hurry, and not all read English as a first language. The rules come from the research behind the second copy pass: aviation checklist guidance (CAP 676, FAA AC 120-71B), Simplified Technical English (ASD-STE100), GOV.UK and a count of the tells of LLM prose.

**Purpose.** Every section and every line serves a named reader and does one job for them: a decision, an action, a fact, or the reason behind a rule. Each thing is said once, where that reader needs it. The core message has one wording: "If you turn the recording down, the crunch gets quieter. It does not go away." Gaps in what the makers publish are stated once, in the guide's makers-and-assumptions section, and inline only where they change what someone does.

**Doing text** (know-by-heart boxes, checklists, drills, procedures, cards and tags):
- A line is the printed name, leader dots, and the state you can see: "MASTER LEVEL …… fully up, on the REC mark". Never "check", "set" or "as required". The action goes in the note, as one sentence: "If …, …".
- A know-by-heart box has three lines at most.
- One instruction per step, as a command, with the condition first. Say a consequence or an irreversible action in a plain sentence before its step. Notes carry information, never instructions.
- Drill branches ("Choose one") are the outcomes you can see at that step, and each ends in the end mark or a Go to. Give values, not "down a step", and the exact words to say to the DJ.
- Cards are read-and-do, written for one person working alone.
- "Warning." is only for injury (mains earth, hearing). There's no "Caution".

**Words:**
- One word per meaning. Hardware names are as printed: TRIM, MASTER LEVEL, BOOTH MONITOR, the MASTER meters (at first mention on a page, "the pair in the middle").
- "Recording level", not "record level": to a DJ a record is a track.
- "The room's volume" is only the PA's loudness. "Headroom" is only level. Say "microSD card" and "checklist card", "top speakers", and "ATT setting".
- UK English, and "orange" for the LEDs. "Crunch" is introduced once as distortion.
- No idioms ("on cue", "a quiet word", "for good", "ease back"), and no negative contractions: write do not, cannot, is not.
- Numbers: "6 dB" for an amount, "+6" for a meter reading, "−1 dB true peak", "p. 27". Every number has its basis, and there's no time budget a list can't meet.

**Sentences:**
- The condition or command comes first, and the reason after it. No ", so" chains.
- One claim per sentence and per heading. Headings are statements, never questions or slogans.
- A paragraph ends on a fact or a specific action, never on a moral or a summary. Each myth ends on its own action.
- No third item just for rhythm. Source any claim about other people, or cut it.
- Lab feedback states what happened, not the teaching method.
- The makers' own words are quoted with the page.
- No em dashes, emoji, exclamation marks or title case, no "not X but Y", no "Let's", and none of the vocabulary that measurably marks LLM prose. Some things look like tells but are right for a reference, so keep them: short sentences, parallel checklist lines, a rule repeated word for word, and bold labels.

## Motion and sound

One orchestrated moment: on load, the hero meter's lights climb to the first orange and stop, well short of the red. Everything else moves only in response to the reader, and `prefers-reduced-motion` turns motion off. Nothing plays until the reader presses a button; sound starts quietly, stops when the tab is hidden, and clean and clipped versions are loudness-matched before any comparison.

## Background reading

Sources behind how the site teaches and how its lists are written, but not behind any claim on its pages (those are in `src/lib/sources.ts`).

- **Teaching with demos:** Crouch, Fagen, Callan and Mazur, [Classroom demonstrations: learning tools or entertainment?](https://www.otffeo.on.ca/wp-content/uploads/sites/2/2014/11/Mazur_demo-article.pdf) (2004), on predicting before a demo. Mayer and Moreno, [Nine ways to reduce cognitive load in multimedia learning](https://www.uky.edu/~gmswan3/544/9_ways_to_reduce_CL.pdf) (2003). Josh W. Comeau, [Let's learn about waveforms](https://pudding.cool/2018/02/waveforms/) (The Pudding, 2018). Bartosz Ciechanowski, [Sound](https://ciechanow.ski/sound/) (2022).
- **Checklists:** Degani and Wiener, [Human factors of flight-deck checklists](https://ntrs.nasa.gov/api/citations/19910017830/downloads/19910017830.pdf) (NASA, 1990). The Voice section above summarises the rest: CAP 676, FAA AC 120-71B, ASD-STE100 and GOV.UK.
- **Levels and clipping:** Esqueda, Bilbao and Välimäki, [Aliasing reduction in clipped signals](https://www.pure.ed.ac.uk/ws/files/26997332/07499828.pdf) (IEEE Transactions on Signal Processing, 2016). Sound on Sound, [What are reference levels in digital audio systems?](https://www.soundonsound.com/sound-advice/q-what-are-reference-levels-digital-audio-systems) (2007). Zoom, [F3 operation manual](https://zoomcorp.com/manuals/f3-en/), on how a two-converter float recorder works.
- **How DJ educators teach gain:** Serato, [Gain structure for DJs](https://support.serato.com/hc/en-us/articles/202538480-Gain-Structure-for-DJs). Rane, [Setting Rane mixer level controls](https://www.ranecommercial.com/legacy/pdf/ranenotes/Setting_Rane_Mixer_Level_Controls.pdf) (RaneNote 171). DJ TechTools, [Gain staging for DJs and staying out of the red](https://djtechtools.com/2015/10/11/gain-staging-for-djs-staying-out-of-the-red/) (2015).
