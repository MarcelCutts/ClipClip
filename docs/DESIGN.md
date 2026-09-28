# Design notes

How the site looks and why. If you change the look, change this file too.

## The brief

- **Subject:** keeping DJ set recordings clean on our rig: a Pioneer XDJ-RX2 feeding a Howler recorder from MASTER 2, with the PA running through a dbx DriveRack PA2 and two QSC GX7 amps, and booth monitors on BOOTH.
- **Audience:** DJs of every level who play our events, and the crew who set up the booth. They're often the same people. Most will open a link from a group chat, on a phone.
- **The site's job:** change what people do in the booth. DJs set each track's loudest part to the first orange light and keep the MASTER meters' top orange dark. Crew build the booth, set the levels by the meters at each soundcheck, and set the room's volume at the amps with their CLIP lights dark. The gear carries no tape or marks. Everyone understands why, so the rules don't feel arbitrary.

## Structure

Three entrances in the header, by what a reader came to do: **Playing · Crew · Learn**. The crew's other pages (rig reference, recordings, print kit) are one step from Crew, in a row of links under its title. Every page is in the footer. Three links fit one line beside the site's name on a 360-pixel phone; a fourth would give most phones a header two lines tall.

| Page | Reading mode | Contents |
|---|---|---|
| `/` Playing | Immediate action | The reason, the drawing of the meters, the three rules, Set TRIM, a blend fix and control ownership. No audio or quiz required |
| `/night/` Crew | Preparation and recovery | C1 Before doors as one list in the order of the work, with its drawings; C2 Changeover, shared faults and C3 End |
| `/setup/` Rig reference | Looking something up | What feeds what (S2) and how each unit is set (S4). No tests and no commissioning cards: nothing on the site needs a laptop except the next day's work on the files |
| `/learn/` Learn | Optional learning | Listening, prediction, blends, Two ceilings, explanations, glossary and sources. Its parts number their own sections from 1 |
| `/recordings/` | File work, the day after | C4, and the drills for what is found by listening: F9 and F11 |
| `/print/` | Preparation | Six A4 sheets. C1 spans two readable parts of the same maintained checklist, with its drawings on a card of their own |

The distinction is the reader's task, not their identity: the same person may be DJ, crew or learner. Old pages and fragments forward to their current topic (`Moved.astro`, `LegacyAnchors.astro`), including a visible fallback link without JavaScript. Historic section/procedure codes are retained; S1 now leads to C1.

## Concept: a quick reference handbook for the booth

The site reads like a flight-deck quick reference handbook (QRH), in plain words. The mixer's meter already looks like cockpit lighting: green, then orange (a flight deck's amber), then red. But on the mixer, orange is where the loudest parts of a track belong and red is the ceiling, so the site borrows the QRH's format, not its colour meanings or its vocabulary:

- **Know by heart.** What a DJ, or the crew, must know without looking goes in boxed challenge-and-response lines, in the pale yellow printed checklists use (UK CAA CAP 676 recommends yellow or white grounds and four items or fewer).
- **Checklists** are challenge and response: the control, leader dots, and the state it should be in, the response in the action colour.
- **Procedures** are cards: a black title strip with the number and kind (Every track, Fix, Reference), a plain sentence before any step with a real consequence, then the steps.
- **Drills** for when something goes wrong: titled with the light as printed, drawn lit; a condition or objective where needed; numbered steps with "Choose one" branches; an end mark.
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

### Every page is built the same way

1. **The header** (`SiteHeader.astro`): the site's name at the top left, on every page, and the three entrances at the right.
2. **The title block** (`PageHeader.astro`): the page's name, one sentence on what it is for, then anything a reader needs first (a way out to another page, a row of links). It sits one `--space-title` under the header's rule and ends one `--gap-block` above what follows. No page sets those distances itself.
3. **The tab strip**, on a page with several cards (Crew, Learn), below 80rem. From 80rem the index rail does its job, starting level with the page's first block.
4. **The body** (`.page-body`): blocks one gap apart.

### Spacing

Three gaps, each about one and a half times the last (`tokens.css`):

| Token | Size | Between |
|---|---|---|
| `--gap-text` | 1rem | Paragraphs, and a heading and the text under it |
| `--gap-block` | 1.5rem to 2rem | The blocks of a page: a figure, a box, a card and the next card on its subject (`.page-body`, `.page-group`) |
| `--space-section` | 2.5rem to 4rem | Before a new section: a plain heading, a part's bar, a card on a new subject (`.section-start`). Also above the footer |

A figure, a lab or a preview among paragraphs gets 0.5rem more above it. Inside a card the distances are the card's own, and the same in every card of its kind. `tests/e2e/page-anatomy.spec.ts` holds every page to the header, the title block and the two gaps.

A tab strip that sticks to the top of the screen (below 80rem) sets `--sticky-top` to its height. The page's scroll padding is that plus 1rem, so a jump or a focused control always lands clear of the strip; components don't add scroll margins of their own, and anything else that pins sits at `--sticky-top`. The guide scrolls smoothly unless motion is reduced; the night page jumps instantly.

## Components

- **Part** (`Part.astro`): a black bar with the part's number and title (a `--strip-edge` top edge by night), then what a reader can do by the end, as one plain sentence. No time, audience or "Objective." label: reading times are in the index.
- **Know by heart** (`KnowByHeart.astro`): the tinted box of challenge/response lines built from `rules.ts`, numbered from 1 in every box, each with what to do if it isn't so and a named task link. A screen reader hears a comma between challenge and response.
- **Procedure** (`Procedure.astro`): a checklist card with a black title strip, then challenge/response steps with notes, and a `.source` line for the manufacturer's page. A real consequence is said in a plain sentence before the steps (`caution`) or before its own step (`before`), with no label. "Warning." is only for injury, and the site has none.
- **Tabs** (`Tabs.astro`): one design wherever tabs appear. Equal-width tabs, at least 3rem tall, hang from a 2px ink rule: the code in bold (1, C1, F) over a short label in `--ink-2` that may wrap to two lines. The one you're in is filled with `--ink`, lettered in `--paper`, in both themes; every tab shows the focus ring. The drills' tab carries a small `--warning` lamp before F and is otherwise like the rest. Each tab is named code first ("1: Why it matters"). Both strips, Learn's (Why, Practise, Rig, How) and Crew's (C1 Before doors, C2 Changeover, F Something's wrong, C3 End), give way to the index rail on wide screens.
- **Index** (`Contents.astro`): a row per part with its thumb tab, drawn as the notch it cuts in a handbook's edge (open on the page's side, filled for the part you're in, never a closed box), its number or code, title and reading time, which drops under the title when there's no room. Every page with several cards has one (Crew, Learn, Rig reference, Recordings): a list under the title block on narrower screens, except on Crew, where the tabs carry the same four entries; the rail on wide screens.
- **Page header** (`PageHeader.astro`): the title block, the same on every page. A page's title names the page ("Playing a set", "Crew on the night"); the site's name is in the header. Playing starts with the reason in three sentences, the drawing of the meters and its three rules; it has no animated hero, jump links or compulsory experiment.
- **Link row** (`.link-row`): a row of links to other pages or sections, spaced apart with nothing printed between them, each 44px tall. Crew's other pages, and the footer's list of every page.
- **Name and meaning list** (`.deflist`): ruled rows under a heavy rule, the name beside its text from 40rem. "Whose controls" on Playing; the glossary and "What the makers publish" on Learn are the same pattern at reference size.
- **What people say** (`Myths.astro`): short pairs. The belief, quoted in regular italic `--ink-2`; what's true, in one or two sentences at regular weight, ending on what to do instead; and the maker's page where there is one. No labels.
- **Panel**: the hardware box, only ever for real gear: meters, faders, scopes, the Howler. Flat, `--radius-panel` (6px), a 1px outline, no shadow. One surface per panel; inner boxes only for a real screen or meter well. Controls use `--radius-control` (4px). No pills.
- **Quiz card** (`MeterCheck.svelte`, `quiz/*`): the meter check's questions and "How sure are you?" are printed cards, not panels. A 2px ink frame, a `--strip` title, answers as ruled rows with a real radio, the chosen answer in `--action`, and right or wrong marked with a tick or a cross and words, never colour alone. "How sure are you?" is a three-step printed scale, so it can't pass for a fourth answer. Keys are printed (`quiz/Key.svelte`). Any gear in the question (a meter, the Howler, the BOOTH MONITOR knob) sits on a small black plate.
- **Paper in both themes**: the print kit's previews carry `data-paper`, which keeps the day's page colours by night (`tokens.css`), as a printout would.
- **Wiring table** (`/setup/` S2): the rig as a table built from `rig.ts` (what, fed from, set to), a labelled list on phones, linking to the interactive signal path in 3.1.
- **Checklist card** (`Checklist.svelte`): a printed card, not a panel. A `--strip` title with its code (C1, C2, C3, C4) and when it's done, then a checkbox per line: the printed name, leader dots and the state you can see. Read-and-do, for one person, with no time budget and no call line. A long list is cut into named sections of six lines at most (C1: Table, Leads, Power, Levels, Record), each under a ruled heading, in the order the hands move.
- **Figure** (`figures/Fig.astro` and the five drawings): a line drawing on the page, inside the checklist, above the first line it serves. A bold title, one or two sentences, then the drawing, labelled directly in words. Thin `--ink-3` lines show what is there; heavy `--action` lines show what you touch or connect; a heavy ink outline marks a light to watch. No black panel, no lit LED colours, no photos. Every drawing is 300 units wide with 15-unit lettering, which is about 16px on a 390px phone and 21px at the drawing's full width (26rem). Each SVG is `role="img"` with a title and a description in words. Shapes are drawn inline, because the shared classes do not reach inside a `<use>`. A part drawn as a line that does not close (a bracket seen from the side) carries `open`, or its fill covers what is under it.
- **Drill** (`DrillCard.astro`): a `--strip` title with the light drawn lit and the drill's code (F1 to F9 and F11; F10 was retired), then a condition or purpose only where it helps the decision. "Now" holds numbered steps: one instruction each, the exact words to say to the DJ, "Choose one" branches with ◆ that are outcomes you can see, "Go to step" links and the ■ ■ ■ ■ end mark. "At the changeover" holds what can wait, and an optional “Why this works” disclosure holds explanation. Conditions and recovery paths stay visible; screen count is not a deletion rule.
- **Faders** (`ui/Fader.svelte`): a stretch of the track can be tinted `sig` or `dmg` for a chart's meaning, or `neutral` for a band that's only a range (the target band). On a touch screen every fader moves only when you drag its cap (`ui/thumbDrag.ts`), so a scroll that starts on one never changes it. The blend lab keeps the faders, meters and result together. TRIM and EQ in the blend lab are an optional disclosure.
- **Two ceilings** (`TwoCeilings.svelte`, `two-ceilings/*`): one panel, laid out in the order the sound travels: the mixer, the Howler, the file. Each stage with a ceiling holds the same things in the same order: the control before its ceiling, the light that watches it, and a screen of the wave at that point. A reading always sits with what it measures. Side by side from 46rem, with their rows lined up (a subgrid, down to each screen's caption, glass and line); one under the other on a phone. The step's result is said inside the stage the step is about, under its screen, in three lines at most. The lab asks before it shows, twice, and each question takes the place of what would answer it: step 1 asks what colour the Howler's light is (in place of the light, with the Howler's screen covered), step 2 asks whether the recording level can remove the crunch (with the recording level, before it goes live). The answer says back what the reader said, then what is so, then the cause in the order it happens. One control is live a step; the other shows as a reading (name and setting), never as a dead fader. Each try of step 2 is answered at once ("You turned it down 6 dB…"). The Howler's screen draws the wave that left the mixer faint behind its own, and marks only what its own ceiling cut. The light is never "OK": its reading is what it measures ("Input 3 dB under its ceiling"), and while the mixer cuts, it says what it leaves out. The file says where its crunch was made and how much was cut, in dB; crunch is named ("Tips cut", "Crunchy"), never graded, since nothing published says how much of it is heavy. Sound notes show while the sound plays.
- **Keys and pads** (`ui/*`): square, flat, 4px. A selected pad lights all over. A preset that stands for a clean or clipped level keeps a dark face and lights a small bar LED in green or red. The primary key is cyan lettering in a 2px frame, so it can't be mistaken for a lit pad. Settings with named positions are slide switches (`hear-it/Choice.svelte`).
- **Status line**: a lab's challenge state as one line under its prompt, the state in bold first ("Done.", "Top orange lit.") and then what it means. It keeps two lines' room on a phone, so a slider never moves while it changes. No lamp: a lit square beside a word reads as a checkbox, and only signal states light up. Never a pill.
- **The Howler** (`ui/HowlerTop.svelte`): one top-down line drawing of the MK1 (finned case, RCA sockets at both ends, the RECORD button, BATTERY and LEVEL lights with their printed names), used wherever the Howler appears. Only LEVEL ever lights. Knobs have the XDJ-RX2's printed dot scale, a ribbed skirt and a white pointer.
- **Meter figure** (`MeterTargets.astro`): a manual figure, a line drawing on the page, lit as a blend looks at its loudest. The two meters have different jobs, and the drawing keeps them apart: a channel meter has a target (the first orange), the MASTER meters have a limit (the top orange stays dark). Each is marked twice. A ring goes round the lights themselves, on that meter's columns only. Beside their row is the rule in its own words (`drawn` in `rules.ts`), set as the rules box sets a line: the meter's name in ink over the state of its light in `--action`. Red and the room a blend takes are named in a lighter weight. It has no numbered key. It fills the reading column, its lights grow with it, and its rows keep one pitch. The share image is the same drawing, and the booth card's is the same in small, with shorter names (`CARD_METER_PLACES` in `figures.ts`).
- **Meters, everywhere**: the LED colours stay the hardware's, but green and orange are too close for some colour-blind readers, so every meter also prints a wider break at the green/orange and orange/red boundaries and sets 0 in bold. Scale labels come from `scaleLabel()` in `xdj.ts` and read like the panel: −24 … 0, 3 … 12, with no plus sign (Pioneer’s panel drawing, manual p. 27). Only the knobs print a plus. A level in a sentence or a readout keeps its sign: “+6 dB”.
- **Signal path** (`SignalPath.svelte`): part names at least 15px at every width, the parts off the signal's path in `--hw-label`. On phones the explanation of the part you tapped rides along the bottom of the screen, above the Stop bar, so it's always in view. Ceilings are dashed rings in `--screen-text`, as on every chart; red is only for damage done.
- **Charts**: a target band is neutral, never a signal colour, so blue only ever means your signal; flat tops are drawn in `--dmg`; every axis says what it measures.
- **LED ladder**, **scopes** and **sliders**: flattened to the two radii.

## Voice

The register is a reference guide's: an equipment manual, a quick reference handbook, GOV.UK. It isn't a tutor's or an assistant's. Readers are often in a dark, loud booth, on a phone, in a hurry, and not all read English as a first language. The rules come from the research behind the second copy pass: aviation checklist guidance (CAP 676, FAA AC 120-71B), Simplified Technical English (ASD-STE100), GOV.UK and a count of the tells of LLM prose.

**Purpose.** Every section and every line serves a named reader and does one job for them: a decision, an action, a fact, or the reason behind a rule. Maintain shared wording once; repeat necessary checks and conditions where the task needs them. The core message has one wording: "If you turn the recording down, the crunch gets quieter. It does not go away." Gaps in what the makers publish are stated once, in the guide's makers-and-assumptions section, and inline only where they change what someone does.

**Doing text** (know-by-heart boxes, checklists, drills, procedures, cards and tags):
- A line is the printed name, leader dots, and the state you can see: "Amp CLIP lights …… dark". The state is a light, a meter or a position anyone can see, never a mark on the gear. Never "check", "set" or "as required". What to do if the line isn't so goes in its note, as one sentence: "If …, …".
- A know-by-heart box has three lines at most.
- One instruction per step, as a command, with the condition first. Say a consequence or an irreversible action in a plain sentence before its step. A note carries facts, and at most its own line's remedy ("If …, …"). Any other action gets a line of its own: a reader who skips the note must still end in the right state.
- A drill that opens on a light closes on it: after its last change, a step looks at that light again, and goes back to the start if it is still lit. A path that ends while the light is still lit is a bug, and the tests walk every path to catch one.
- Drill branches ("Choose one") are the outcomes you can see at that step, and each ends in the end mark or a Go to. Give values, not "down a step", and the exact words to say to the DJ.
- Cards are read-and-do, written for one person working alone.
- A checklist is not a manual. The work is a flow in its natural order, and the list holds the lines that confirm it, with the ones that hurt most if missed always present (amps down before power, amps on last, RECORD blinking). Its last line is the state that says the list is done. If you are interrupted, start the section again. These come from FAA AC 120-71B (5.1.2, 5.1.6, 5.2.3), Degani and Wiener's guidelines 4, 7, 8 and 10, and the WHO and Project Check advice of five to nine lines per pause point.
- "Warning." is only for injury, and the site has none: the hearing warning on Playing was removed on 28 September 2026. There's no "Caution".

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

The practical pages have no entrance animation. Interactive demonstrations move in response to the reader, and `prefers-reduced-motion` turns motion off. Nothing plays until the reader presses a button; sound starts quietly, stops when the tab is hidden, and clean and clipped versions are loudness-matched before any comparison.

## Background reading

Sources behind how the site teaches and how its lists are written, but not behind any claim on its pages (those are in `src/lib/sources.ts`).

- **Teaching with demos:** Crouch, Fagen, Callan and Mazur, [Classroom demonstrations: learning tools or entertainment?](https://www.otffeo.on.ca/wp-content/uploads/sites/2/2014/11/Mazur_demo-article.pdf) (2004), on predicting before a demo. Mayer and Moreno, [Nine ways to reduce cognitive load in multimedia learning](https://www.uky.edu/~gmswan3/544/9_ways_to_reduce_CL.pdf) (2003). Josh W. Comeau, [Let's learn about waveforms](https://pudding.cool/2018/02/waveforms/) (The Pudding, 2018). Bartosz Ciechanowski, [Sound](https://ciechanow.ski/sound/) (2022).
- **Checklists:** Degani and Wiener, [Human factors of flight-deck checklists](https://ntrs.nasa.gov/api/citations/19910017830/downloads/19910017830.pdf) (NASA, 1990). The Voice section above summarises the rest: CAP 676, FAA AC 120-71B, ASD-STE100 and GOV.UK.
- **Levels and clipping:** Esqueda, Bilbao and Välimäki, [Aliasing reduction in clipped signals](https://www.pure.ed.ac.uk/ws/files/26997332/07499828.pdf) (IEEE Transactions on Signal Processing, 2016). Sound on Sound, [What are reference levels in digital audio systems?](https://www.soundonsound.com/sound-advice/q-what-are-reference-levels-digital-audio-systems) (2007). Zoom, [F3 operation manual](https://zoomcorp.com/manuals/f3-en/), on how a two-converter float recorder works.
- **How DJ educators teach gain:** Serato, [Gain structure for DJs](https://support.serato.com/hc/en-us/articles/202538480-Gain-Structure-for-DJs). Rane, [Setting Rane mixer level controls](https://www.ranecommercial.com/legacy/pdf/ranenotes/Setting_Rane_Mixer_Level_Controls.pdf) (RaneNote 171). DJ TechTools, [Gain staging for DJs and staying out of the red](https://djtechtools.com/2015/10/11/gain-staging-for-djs-staying-out-of-the-red/) (2015).

## Field layout and offline behaviour

At phone widths, challenge and response stack and align left. Local navigation keeps its words at 320 CSS pixels, using two rows where necessary. Do not conceal labels to fit codes. Check larger text, keyboard focus and both themes. At high text magnification the two-dimensional meter drawing can scroll within its own region; its written key and surrounding instructions must still reflow.

The print kit carries the same five drawings on one card (`print/DrawingsCard.astro`), 63 mm wide, which is as large as five fit on an A4 sheet: their labels print at about 9 pt, and their captions at 10 pt. Their captions are shared wording (`src/lib/figures.ts`).

C1's five drawings are native SVG, theme-adaptive and labelled directly: the table (for the road, for the night, and the bolt's stack), the booth (from above and from the side), the back of the rack (four speakON sockets, three power inlets, the two inputs from MASTER 1), the back of the mixer with the Howler's IN end, and the front of the rack (POWER, gain knobs, CLIP lights). The owner gave the amps' roles: top amp to the tops, bottom amp to the subs. Do not draw pointer positions. Which channel is left and which right does not matter to the owner, so the drawings name tops and subs only.

Confidence is optional in both learning checks. Learners may predict then check, or reveal without scoring a missing prediction as a failure. Playback remains explicit and quiet; audio is not a prerequisite to field instructions.

An offline save downloads the complete built package and validates integrity. Its status checks stored files. A waiting update is applied between events after all old tabs close. Keep a printed/PDF fallback and make clear that external sources still need connectivity. See README for implementation and verification commands.
