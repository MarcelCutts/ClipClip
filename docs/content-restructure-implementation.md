# Content restructure: implementation and verification

27 September 2026; follow-up reviewed 28 September · Implements the Astra–Fable synthesis plan, a working paper kept outside the repository, against the original `1adeb3d` site. Changes are local; no deployment was made.

## What changed

The main navigation is **Playing · Crew · Print kit**. The name remains **Out of the red**, with **Rig setup and clean recordings** as its descriptor. Clipping prevention is still the first thing a DJ sees.

Playing now opens with the three operating rules, followed by TRIM, the meter diagram, the blend fix and control ownership. Listening exercises no longer precede the instructions. Crew now owns normal preparation from connecting the prewired case through to starting the first recording. Rig reference holds configuration, wiring and commissioning or recheck procedures.

The audio demonstrations remain together in optional learning. Confidence is optional, and revealing an answer without making a prediction does not count as a wrong answer. Two ceilings has one Next action. The blend preset now says **Both decks on top orange**. The audio engine and its level model are unchanged.

## Content destinations

| Previous material | Current destination and treatment |
|---|---|
| Home introduction and three DJ rules | Shorter Playing opening; rules appear before experiments |
| 1 / 1.1: why clipping matters and listening test | `/learn/#why`, `/learn/#hear`; full three-round test retained |
| 2.1 TRIM, 2.2 meters, 2.3 control ownership | Practical instructions at `/#trim`, `/#meters`, `/#knobs` |
| 2.4 blends | Immediate remedy at `/#blends`; explanation, measurements and practice at `/learn/#blends` |
| 2.5 meter check and 2.6 myths | `/learn/#check`, `/learn/#myths` |
| 3: signal path and Two ceilings | `/learn/#signal`, `/learn/#two-ceilings` |
| 4: explanations and model limits | `/learn/#hood`, with the original subtopics and source references |
| Glossary and source catalogue | `/learn/#glossary`, `/learn/#sources` |
| S1 setup, old C1 Doors open, routine S4 checks | One C1 Before doors workflow at `/night/#doors` |
| C2 Changeover, C3 End | Remain distinct on Crew, with existing reset/expiry behaviour |
| C4 file handling, F9 recorded crunch | `/recordings/#next-day`, `/recordings/#fix-crunch` |
| F1–F8, F10 and F11 | Crew fault index; direct access remains available from soundcheck and recordings |
| S2 wiring, S3 recording test, S4 settings, T2/T3 and S5/S6 | Rig reference at `/setup/`; normal event preparation links back to C1 |
| Existing printed references and historic addresses | Codes preserved; old pages and moved fragments forward to their new topics, with a link fallback without JavaScript |

The former “big moment” exception to the DJ level target is removed from the practical route. Routine configuration checks are no longer maintained as a second setup checklist. Necessary instructions still repeat when an independently opened procedure needs them; shared data keeps their wording consistent.

### The merged preparation sequence

C1 has 18 checks in five groups. This replaces the overlapping setup and doors lists, rather than adding a third list.

| Group | Conditions retained or clarified |
|---|---|
| Connect | Supply/load and RCD checks; competent-person requirement when using a generator; separate amp supply sockets; speaker labels; mixer outputs; three rack power leads; amps off during connection |
| Start | Verified configuration and readable tape marks; Howler charging and WAV; DriveRack input and PIN 1 LIFT position; GX7 FULL RANGE; approved preset; MASTER LEVEL and both ATT settings; playback stopped and amp gains down before amps go on last |
| Soundcheck | Normal DJ targets; green Howler light; dark PA2 input CLIP lights; room level within the approved RIG marks; direct fault routes |
| Check the recording | Two-minute headphone check; both sides; hum, missing-side and recorded-crunch routes |
| Ready for the set | A new first-set file; RECORD blinking; card-failure remedy; DJ name/time; booth card |

S3 is a controlled test for establishing settings, relevant changes or a failed check. Every event still verifies the approved settings and recording behaviour. F1 remains the live red-light recovery route. F6 retains its immediate reduction/recheck loop and its deferred, muted input-switch repair.

F10 now explicitly restores the previous MUTE states after changing PIN 1 LIFT, records a verified position, and ends with a new recording check. Every F11 missing-side branch also ends with a fresh headphone recording check and a handoff to the rig owner if it still fails. Hum and missing-side procedures state when to defer lead or power changes during a set. Mains-earth protection remains explicit.

## Rack facts and unresolved settings

The drawings show the known physical arrangement: upper GX7, DriveRack PA2, lower GX7; three power inlets; four speakON sockets; internal signal cables left connected. They are native SVG, labelled directly and adapted to light, dark and print presentation. The front view shows control locations without inventing knob settings.

`src/lib/rack.ts` holds the four speaker destinations and the configuration record. Speaker assignments, actual firmware versions, REC/ATT values, preset, RIG limits, verified PIN 1 LIFT position and commissioning results/date are explicitly unrecorded. Missing information in the guide is not evidence that commissioning has never happened. Existing marks and records should be checked with the rig owner before deciding which tests need repeating.

## Phone and print decisions

Long challenge/response rows stack and align left on phones. Crew navigation keeps its words at 320 pixels. Generic objective and timing labels are removed where they add no information. Background explanation moves into named disclosures; conditions and recovery paths remain visible.

At 200% text size, the two-dimensional meter drawing can scroll within a keyboard-accessible region. Its written key and surrounding instructions reflow normally. Rig reference fields stack instead of leaving a narrow response column.

The print kit uses **five A4 sheets**:

1. Two A6 booth cards.
2. Tape labels.
3. C1 part 1: Connect and Start.
4. C1 part 2: Soundcheck, Check the recording, Ready for the set.
5. C2 Changeover and C3 End.

Trying to fit the expanded C1 into one sheet caused Chromium to shrink the whole print job, reducing notes to approximately 7.4 pt. Splitting it keeps checklist instructions at 10 pt or larger, preserves every item and gives an explicit continuation. Both halves render the same maintained C1 data, with continuous numbering. The current printed revision is **27 September 2026 (E5FD30)**.

Crew and Rig reference can also be saved as PDFs. The print stylesheet exposes closed disclosures, including the rack drawings. Modern disclosures have a generated content container as well as their visible children; the print fix addresses its visibility, as described in [MDN’s content-visibility reference](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/content-visibility).

The 28 September follow-up keeps each checklist item, procedure step and wiring row with its note. Long procedures use normal block flow on paper: the previous grid fragmentation could overlap the wiring list’s closing note. The wiring list prints concise manual/page labels, retaining their PDF link annotations, rather than repeating long URLs. All five kit pages and both complete backups were rendered and reviewed again; the final Crew and Rig reference exports are 18 and 13 pages, with no blank pages.

The same follow-up fixes slow-loading and keyboard interactions. A meter-check prediction made before its script arrives survives hydration. Shared learning action buttons become enabled when their handlers are ready. The signal drawing explicitly keeps keyboard focus clear of the tabs and readout, including in mobile WebKit, and the audio Stop bar keeps newly focused footer links visible.

## Offline behaviour

A production build offers **Save for offline use**, with a direct link near the top of Crew. The package contains all pages and local dependencies, including fonts, diagrams, learning islands and the short clip: 53 files, approximately 1.5 MB before transfer compression in the verified build. External manuals require a connection.

The build inventories its actual output and hashes every downloaded file. Readiness requires the complete package. A worker update waits while the old guide is open; a failed or mismatched deployment cannot replace a complete previous version. Partially evicted data is detected and can be saved again. Development does not register a service worker; use a production preview to exercise saving.

Checklist keys include the deployment base path and a fingerprint of their instructions. Changed steps start unticked; the existing expiry, clear, undo and fresh-changeover behaviour remains.

Offline reopening and complete process restart are now exercised in both Chromium and WebKit. The tests stop an isolated local origin and confirm it cannot answer a fresh network request. WebKit’s simulated offline flag is avoided because Playwright 1.63 rejects even service-worker-generated responses in that mode ([upstream issue and reproduction](https://github.com/microsoft/playwright/issues/42775)). This is engine-level evidence with an unavailable origin, not a claim of physical iPhone testing. The update test also checks activation after the last old client leaves, removal of the old cache, and continued use without the origin.

## Verification

- Final `pnpm verify`, with `CROSS_BROWSER=1`, `BASE_PATH=/ClipClip/` and the GitHub Pages site URL: lint, Astro/Svelte checks, **577 unit/component tests and 259 browser tests passed**. Thirteen cases intentionally skip duplicate PDF/lifecycle checks. PDFs run in desktop Chromium; worker lifecycle and process restart run once per engine.
- The browser profiles cover desktop Chromium, Android emulation, dark/forced-colour/reduced-motion preferences, and WebKit with iPhone emulation.
- Browser checks cover 320/390 pixel layouts, 200% text on practical pages, keyboard operation, internal pages/fragments, old routes, checkbox persistence, native controls with JavaScript disabled, delayed hydration, learning interactions, sound lifecycle and automated accessibility checks.
- Manual browser inspection covered the revised practical routes and both rack views, including the dark phone layout. A light-theme capture of the rack drawing was also reviewed. These are desktop browser/emulation checks, not physical-phone testing.
- Offline tests cover all pages and local assets, complete Chromium and WebKit process restarts using their saved profiles, partial eviction and repair, and the real service-worker update lifecycle. A fixture served old HTML with HTTP 200 under a new integrity manifest: the update failed, the old guide remained usable, and a subsequent complete update waited until the old tab closed before becoming the active saved guide.
- All five print-kit pages were rendered and inspected. The 18-page Crew and 13-page Rig reference PDF backups were rendered for pagination review. Crew’s PDF contains internal destinations for its fault procedures; F1 links resolve to the exported F1 page. This does not establish how every phone PDF viewer handles links.
- A comparison of the old literal anchors against the generated home, Crew and setup pages found no missing anchors. Moved topics retain forwarding targets.
- Tests continue to protect hardware targets, fault branches, required conditions and printed/shared wording. Arbitrary instruction-length gates were removed; actual reflow and print-fit checks now cover the space constraint.

The optional `webkit-phone` profile uses Playwright’s iPhone 13 emulation. The no-JavaScript fallback test uses reduced motion to avoid the automation engine’s instability during native smooth fragment scrolling; normal motion is covered by the interactive-page tests. A narrowly matched macOS WebKit native-video icon error is filtered from console assertions after reproducing it on a bare `<video controls>` element; application script errors remain failures. These test-harness accommodations do not change the site’s browser settings or suppress page errors.

Biome excludes local editor settings, an unrelated nested worktree and the original review’s draft SVG. Those existing local artifacts were left intact; the production rack component remains linted.

## Remaining field validation

These checks need the equipment or representative users and have not been claimed as complete:

- Confirm the four physical speaker destinations and labels, approved REC/ATT settings, preset, RIG limits and existing T2/T3/S6 evidence. Record what is known before repeating commissioning work.
- Check the saved production guide after closing and reopening the actual iOS/Android browsers used at events, with networking disabled; also check their PDF viewers.
- Rehearse the plan’s tasks with approximately 5–8 DJs/crew, including someone unfamiliar with the case: set TRIM, connect the rack, recover from Howler red, find a hum/missing-side fix, start a fresh changeover and reopen the guide offline. Test both themes and larger text outdoors in controlled conditions.
- Revisit the site name after those entrance and lookup tasks have been tried. Renaming remains deferred.

The implementation does not substitute browser tests or a diagram for physical verification of the rig.

## 28 September 2026, later: a guide for the field

The rig's owner described the booth and answered the open questions. This section replaces "The merged preparation sequence", "Rack facts and unresolved settings", the print kit's sheet list and the first item of "Remaining field validation" above. Changes are local; nothing was committed or deployed.

### What the owner said

- The trolley is the table. A RocknRoller R12 is shortened, its top is bolted to both handles, and a booth monitor's bracket is clamped under each bolt: bolt and washer, bracket, top, handle, wingnut.
- The rack rides on the trolley's bed with its knobs to the crowd. Top amp to the tops, DriveRack in the middle, bottom amp to the subs. Left and right do not matter.
- The booth monitors (the box pro Achat) are on BOOTH. The decks are set up near the end. The generator changes with the event.
- The gear carries no tape or marks, and none are planned. The tape tags are not a necessity.
- A recording cannot be played back in the booth.
- Earthing, RCDs and generators are a separate subject. A hum or buzz drill makes no sense in the field, because nobody can listen to a recording there.
- This is a guide for the field: remove the work that needs a laptop.
- The Howler's light has not been seen red with the MASTER meters below red.
- The text must make sense where it stands, and cite nothing that no longer exists.

### What changed

**C1** is one list of 26 lines in the order of the work, in five sections: Table (6), Leads (5), Power (6), Levels (6), Record (3). No line sends the reader to another card to carry on. New lines cover the table, the brakes, the subs and tops, the mixer's place, MASTER 1, MASTER 2, BOOTH, and the Howler with its microSD card in, on charge, on WAV and switched on. The RCD, supply and competent-person lines, the tape-mark lines and the two-minute headphone check were removed.

**Levels** are set by what anyone can see. MASTER LEVEL is set at soundcheck by the MASTER meters, as Pioneer sets it (manual p. 31). The recording is confirmed by the Howler's LEVEL light on a loud blend. The room is set at the amps' gain knobs with their CLIP lights dark. The crew's third know-by-heart line is "Amp CLIP lights …… dark".

**F1** has five steps and one control. With the MASTER meters below red, MASTER LEVEL comes down until the Howler's light is green, and the amps bring the room back. No checklist or drill changes MASTER ATT. Pioneer does not say which sockets it reaches on the XDJ-RX2; its help pages for the DJM-450, DJM-750MK2, DJM-V10 and DJM-A9 say theirs reaches MASTER 1 and MASTER 2 together.

**Rig reference** (`/setup/`) holds S2 Wiring and S4 DriveRack and amp settings, and nothing else. T2, T3, S3, S5, S6 and the rig record were removed. Their old links forward: the recording-level ones to C1, the DriveRack ones to S4. C4, F9 and the clip checker no longer send anyone to S3. C4 asks only that a set's loudest peak is below the top of the file, since nobody sets the recording to a band now. The sources list lost the four documents that served only the removed cards.

**Drawings.** Five sit inside C1 on Crew, each above the first line it serves: the table, the booth, the back of the rack, the back of the mixer with the Howler's IN end, and the front of the rack. They are in the served HTML and need no JavaScript. The print kit carries the same five on a card of their own. Their captions are shared wording (`src/lib/figures.ts`) and part of the printed revision.

**Plain words.** "(0)" is the number the mixer prints beside the first orange light (Pioneer p. 27), and Playing and C1 now say so where the target first appears.

**Drills.** F10, hum or buzz, was removed with its earth warning, the audio isolation transformer and the PIN 1 LIFT remedy. Its number is not reused, and its old link lands on the drills' list. F11, a hollow or one-sided recording, moved to Recordings beside F9, because both are found by listening the day after. Crew keeps the eight drills that start from something seen or heard in the booth. F7 no longer skips the booth monitors, F8 no longer switches on a DriveRack that has no switch, and F6 and F7 link to the sections that are about them.

**Marks and tags.** The quiz, the signal path's data and the comments no longer speak of a REC mark, RIG marks or taped knobs. The quiz draws BOOTH MONITOR bare. The print kit's tape tags remain as optional labels.

### The print kit: six A4 sheets

1. Two A6 booth cards.
2. Tape tags, optional.
3. C1 part 1: Table, Leads and Power.
4. C1 part 2: Levels and Record.
5. C1's five drawings, 63 mm wide, which is as large as five fit on one sheet.
6. C2 Changeover and C3 End.

### What the checklist research changed

| Source | Lesson | Where it shows |
|---|---|---|
| FAA AC 120-71B, 5.1.2 | The work is a flow; the list holds the lines that confirm it | C1 no longer narrates every action, and no longer teaches |
| Degani and Wiener, guideline 8 | Order by where the hands and eyes go | Table, Leads, Power, Levels, Record |
| Degani and Wiener, guideline 7; WHO; Project Check | Cut a long list into short sections | Six lines at most per section |
| Degani and Wiener, guideline 4 | The response names the state, never "checked" or "set" | "both on", "switched on last", "blinking green" |
| FAA AC 120-71B, 5.1.6 | The last line says the list is done | "Booth card …… by the meters" |
| Project Check | A checklist is not a teaching tool | Reasons moved to notes of one or two sentences, or out |

### The audit for stale references

Every internal link and fragment on the built site was checked by script, with every card code and section number in the visible text: none is broken, and none names a card that has gone. Five reviewers then read the rendered words of each page against a list of what exists and what was removed. They found no dangling reference that the script had missed on Crew or the rig reference, and about forty places where a sentence no longer made sense where it stood. The ones acted on:

- The meter check quiz still said MASTER LEVEL "stays on its REC mark" and drew a tape tag on BOOTH MONITOR.
- Links and the print page cited section numbers 2.1 to 2.3, which no page shows, and one section by a name its heading no longer has.
- C1 told the crew to "say to the DJ" at soundcheck, never placed the subs or the mixer, and never put the microSD card back in the Howler.
- F1's "until green" named no light, and its "From then on" came before anything had happened.
- The clip checker's report sent readers to F9 "on the Crew page".
- A rack caption counted seven leads where the drawing and the list make nine.

### Verification

`pnpm verify` passes: lint, Astro and Svelte checks, 582 unit and component tests, the build, and 203 browser tests (10 skipped by design). With `BASE_PATH=/ClipClip/` and `CROSS_BROWSER=1`, 271 browser tests pass (13 skipped by design). The changed pages were inspected at 390 and 1280 pixels in both themes, and the six printed sheets under print media. The printed revision is **28 September 2026 (AA7150)**. These are desktop browser and emulation checks, not tests on a phone in a field.

### Still open

- The name or number of the rig's DriveRack preset, and the MASTER ATT and BOOTH ATT settings. S4 says "the rig's own" preset until the owner gives it.
- Whether the booth monitors are the Achat 104 A. The owner confirmed the make; the model is read from a photograph.
- Whether Recordings (C4, F9 and F11) stays. It is the one place that needs a computer, and it is the next day's work.
- C3 ends "Howler …… on charge" after the rig is switched off, and does not say where.
- Section numbers on Learn start at 2.4 in part 2, because 2.1 to 2.3 were Playing's and Playing's headings now carry none.

## 28 September 2026, evening: Playing, the drawing first

### What the owner said

- "let's do B": the drawing of the meters above the three rules.
- "why is it so skinny compared to the old diagram?" The preview's drawing was one fixed picture, sized so that its names fitted beside it on a phone, and capped at 24rem. On a wide screen it stayed phone-sized, with thin lights and empty space beside it.
- "just do what you think is best from an education and data hierarchy approach."

### The page, top to bottom

1. The title, and the reason in three sentences: every set is recorded, no limiter sits between the mixer and the recorder, and turning a clipped recording down does not remove the crunch.
2. **Where to aim**: the drawing, with one sentence on what it shows and which meter shows what.
3. **When you're playing**: the three rules, with no jump links.
4. **Set TRIM in your headphones**, every track.
5. **MASTER meters: top orange lit**, in a blend. It says what to do when CLIP blinks.
6. **Whose controls**, with where each knob is on the panel (Pioneer p. 27). The hearing warning was removed the same evening, at the owner's word: "we don't need this either".
7. One link to Learn.

The quick links, the "(0)" line, "Read the right meter" and its three paragraphs, the heading "Keep blends out of the red", the crew's settings (MASTER ATT, BOOTH ATT, the amps' place), the MY SETTINGS sentence and "Ready to play" were removed. On a 390 × 844 phone the page went from 6.7 screens and 755 words to 4.7 screens and 490 words, and from 17 links to 3. The drawing moved from 2.4 screens down to 0.6.

### The drawing (`MeterTargets.astro`)

- A grid of page elements, as the old figure was, so its lettering is real text at the reader's own size. It fills the reading column: the bridge is 181 px of 358 on a phone and 328 px of 684 on a wide screen, and a channel light is 29 px or 55 px wide.
- The lights the rules name are named beside their rows. There is no numbered key. (The names were first "Top orange: fader down" and "First orange: aim here". They were changed the same evening: see "The drawing keeps the two meters apart" below.)
- It is lit as a blend at its loudest: each channel on the first orange, the MASTER meters two lights higher, the top orange, the red and CLIP dark.
- On the unit the MASTER pair is wider than a channel meter (Pioneer's pictures). The old figure drew it narrower. The new one draws the pair at about one and a half times a channel light.
- The rows keep one pitch at every width. On a phone a long name takes two lines and overlaps the gaps around its row.

### Facts corrected

| Was | Now | Source |
|---|---|---|
| The scale on every drawing printed +12, +9, +6, +3 | 12, 9, 6, 3, as the panel prints it (`scaleLabel`) | Pioneer's panel drawing, manual p. 27, and its pictures of the unit |
| "If you load MY SETTINGS from USB, tell the crew. It may change MASTER ATT and BOOTH ATT." | Removed from Playing | rekordbox's My Settings has no attenuator among its 46 controls; Pioneer's mixers keep ATT. in a separate list. Not tested on the unit |
| "Warning. A night at club volume can damage your hearing…" | Removed from Playing, with the three documents that served only it | The owner, 28 September 2026 |
| Channel meters read before the fader: VirtualDJ only | Learn 4.4 adds Pioneer's own sentence for the XDJ-RX3 | XDJ-RX3 manual p. 86 |
| The share image named the whole orange band "loudest parts" and the green "headroom" | The share image is the page's drawing | `scripts/media/og.html` |

### Links

The DJ briefing's link now lands on the top of Playing (`GUIDE_PATH`): the chat carries the three rules and cannot carry the drawing. The booth card's QR code still lands on Set TRIM (`CARD_PATH`), the first thing on the page that the card does not carry, so printed cards need no change.

### Removed files

`MeterAnatomy.astro`, replaced by `MeterTargets.astro`. `Hero.astro`, which no page had used since the restructure and which named the orange band "loudest parts".

### Verification

`pnpm verify` passed: lint, Astro and Svelte checks, 582 unit and component tests, the build, and 212 browser tests (10 skipped by design). With `BASE_PATH=/ClipClip/` and `CROSS_BROWSER=1`, 283 browser tests passed (13 skipped by design). Every internal link and fragment on the built site resolved. The printed words did not change.

## 28 September 2026, night: one layout, the two meters, three entrances

### What the owner said

- "some pages have a top left header, some don't. spacing of titles, gaps between elements and paragraphs differs. improve and make consistent to your judgement"
- Of the hearing warning: "we don't need this either I don't think", and "it also makes the text block look oddly sized".
- "does the diagram distinguish correctly where to aim for the channel volume and for the master volume, do you think?"
- "should learn be its own tab? I feel there's a tonne of stuff hidden."

### What was measured before

| | Playing | Crew | Print kit | Learn | Recordings | Rig reference |
|---|---|---|---|---|---|---|
| Site's name at the top left | no | yes | yes | yes | yes | yes |
| Title's line height | 1.05 | 1.1 | 1.05 | 1.05 | 1.05 | 1.05 |
| Title below the header, wide screen | 30 px | 36 px | 30 px | 30 px | 30 px | 30 px |
| Gaps inside the title block | 16 px | 0 px | 16 px | 16 px | 16 px | 16 px |
| Title block to the first block, phone | 24 px | 0 px | 49 px | 0 px | 24 px | 36 px |
| Title block to the first block, wide screen | 24 px | 0 px | 80 px | 40 px | 24 px | 58 px |
| Between cards | 24 px | 40 px | 58 to 80 px | 50 to 80 px | 24 px | 36 to 56 px |
| Links in a row | none | dots between | none | none | dots between | none |

### One layout

- The site's name is at the top left of every page. Playing's own title is now "Playing a set"; it was the site's name, which the header did not repeat there.
- One title block (`PageHeader.astro`) on every page, Crew included. It sets the title's size, the distance from the header and the distance to the page's body.
- Three gaps (`--gap-text`, `--gap-block`, `--space-section`) replace each page's own numbers. Between blocks: 24 px on a phone, 32 px on a wide screen. Before a new section: 42 px and 64 px.
- The index rail starts level with the page's first block on every page that has one. Recordings has the rail too, in place of a row of links.
- Crew's tab strip gives way to the rail on wide screens, as Learn's does. It used to show beside the rail with the same four entries.
- Links in a row are spaced apart with nothing printed between them, and each is 44 px tall.
- The lede takes the full reading column. It was held to 34rem, which broke its lines early beside full-width paragraphs.
- "Whose controls" and Learn's two reference lists share one pattern (`.deflist`).
- The header fits one line from 360 pixels wide. It was two lines tall there.

### The drawing keeps the two meters apart

The drawing named rows, not meters. "First orange: aim here" sat beside a row that three meters share, and the MASTER meters in that same drawing were lit two lights above it. "Top orange: fader down" did not say whose top orange.

- A channel meter has a target, and the MASTER meters have a limit. A ring goes round each meter's own lights: CH1 and CH2 at the first orange, the MASTER pair at the top orange.
- Beside each row is the rule in its own words, as the rules box sets it: "Channel meters" over "first orange (0)", "MASTER meters" over "top orange dark".
- The heading is "What the meters should show". "Where to aim" covered one of the two.
- The share image is the same drawing.
- The booth card's drawing is the same in small: lit as a blend at its loudest (it lit every light, red included), with the rings, and "CH1, CH2: aim" and "MASTER: dark" in place of "Aim" and "Fader down". Its names are now part of the printed revision.

### Three entrances

- The header is **Playing · Crew · Learn**. Learn holds the listening test, the blend to try, the meter check, the signal path and the sources, and was reachable only from the foot of Playing and the footer.
- Print kit left the header. It is used once before an event, by the crew. It is in the row of links under Crew's title, with the rig reference and the recordings, and in the footer.
- The footer lists every page.
- Learn's second part numbers its sections 2.1 to 2.3. They were 2.4 to 2.6, after three sections that are now Playing's and show no number.

### Removed

The hearing warning on Playing, with the three documents that served only it (WHO's standard, HSE's HSG260, Bray 2004). The site has no "Warning." now.

### A fault in a drawing

In "At each end, one bolt" the monitor's bracket hid part of the bolt's washer. The bracket is a line that does not close, and its style filled it: the fill of an open path is the triangle between its two ends. Lines like it now carry `open`, and `src/components/figures/figures.test.ts` fails if a filled path in any of C1's drawings is left open.

### Verification

`pnpm verify` passes: lint, Astro and Svelte checks, 586 unit and component tests, the build, and 221 browser tests (10 skipped by design). With `BASE_PATH=/ClipClip/` and `CROSS_BROWSER=1`, 295 browser tests pass (13 skipped by design). Every internal link and fragment on the built site resolves. `tests/e2e/page-anatomy.spec.ts` is new: it holds every page to one header, one title block and the two gaps. Every page was inspected at 360, 390 and 1440 pixels. The printed revision is **28 September 2026 (716B79)**: the booth card's drawing changed.

### Still open

- F7 on Crew, and C2's line that leads to it, rest on the reading that a USB stick can change MASTER ATT. The evidence is against it. One check on the unit settles it: set MASTER ATT to −6 dB, pause both decks, load MY SETTINGS from a stick, and read MASTER ATT again.
- What a DJ does if no crew can be found.
- The better guides also give a reason the page does not: late in a night your ears mislead you, and the meters do not.
- Whether Print kit should be a fourth entrance in the header. It would make the header two lines tall on most phones.

## 28 September 2026, late: the Two ceilings lab

### What the owner said

"I think this lab might be busted. make it better ui/ux/educational. i think if it was heavy crunch shouldn't the howler not be green? focus on this and research how to make this educational better." He was looking at step 1 after its result: "Heavy crunch" beside "Howler’s LEVEL light: Blinking green, Level OK".

### What was wrong

The model was right. With a channel 6 dB past the red and the recording level down, the mixer cuts the tops flat and the Howler’s input stays under its ceiling. The page made that read as a fault:

- Two verdicts side by side, neither saying where it was measured: "Heavy crunch" and "Level OK".
- The light was shown before the question it answers had been asked.
- The mixer’s screen was folded away, and the screens ran against the sound’s order.
- Locked controls were drawn as faders that did not move.
- "Heavy" graded the crunch with no ground. Nothing published says how much hard clipping on dance music is heavy. The one survey that names a range (Záviška, Rajmic, Ozerov and Rencker, 2021, section V-A) grades clipping by input signal-to-distortion ratio, from 1 dB, "very harsh", to 20 dB, "mild but still noticeable", and gives no figure in dB over the threshold. On the lab’s default 48 kHz loop, with the Howler below its ceiling, 6 dB over at the mixer adds 15 % distortion, about 16.5 dB by that measure: between the survey’s two mildest levels.

### What the research found

Two reports, working papers kept outside the repository with every quotation and its source:

- Doubting the apparatus is a known response to evidence against a belief: "the apparatus is bust" (Chinn and Brewer, 1993, "The role of anomalous data in knowledge acquisition", Review of Educational Research 63, 1–49). It is likeliest when no mechanism is in view; what the reader already knows can push either way.
- A question asked before the material helps, and only with what it asked: g = 0.54 for the asked-about material, 0.04 for the rest (St. Hilaire, Chan and Ahn, 2024, "Guessing as a learning intervention: a meta-analytic review of the prequestion effect", Psychonomic Bulletin & Review 31, 411–441; the abstract and p. 425). A 2025 meta-analysis finds the same, g = 0.66 against 0.01, and that the answer following the question helps more (King-Shepard, Walker, Nokes-Malach, Carpenter and Fraundorf, Educational Psychology Review 37, article 115).
- Saying the belief back, then that it is wrong, then the cause beats the texts it was tested against: g = 0.41 over 44 comparisons from 33 studies and 3,869 readers, 30 of them against an expository text (Schroeder and Kucera, 2022, "Refutation text facilitates learning: a meta-analysis of between-subjects experiments", Educational Psychology Review 34, 957–987). The larger pre-registered review included 294 effect sizes; its accurate-belief post-test estimate was g = 0.37 over 222 effects from 67 studies. No significant moderation was detected among the 26 moderators examined, although some analyses had limited power (Danielson, Jacobson, Patall, Sinatra, Adesope and others, Educational Psychologist, online 16 August 2024; [table 3 and limitations](https://par.nsf.gov/servlets/purl/10629626)). That review covers refutation texts without accompanying interactive activities.
- Feedback reviews report larger effects for richer information: average d = 0.99 for high-information feedback, a broader category than explanation alone, and 0.46 for corrective feedback (Wisniewski, Zierer and Hattie, 2020, "The power of feedback revisited", Frontiers in Psychology, table 3), and average effects of 0.49 for elaborated feedback and 0.05 for a bare mark (Van der Kleij, Feskens and Eggen, 2015, Review of Educational Research, abstract). These are subgroup averages, not a pooled head-to-head contrast. The newest timing meta-analysis finds no statistically significant average difference between immediate and delayed feedback, g = 0.03 (95% confidence interval −0.08 to 0.13) (Kandemir, Esposito, Gurgand and Ramus, 2026, Educational Psychology Review 38, article 13). The lab answers each try at once as a design choice, not on that evidence.
- An indicator is read as a verdict on the whole (Three Mile Island). A light should be labelled by what it measures.
- Howler’s manual invites the belief: it "is correctly recording when … the LEVEL indicator is blinking green" (2.2). Howler never says green means clean, and says the mixer distorts first (FAQ).
- Zoom’s H6essential manual draws the lab’s lesson in three labels on its 16/24-bit figure: "Clipped recording", "Volume lowered", "Still clipped" (p. 9, "32-bit float WAV file overview").

### What changed

- The lab asks before it shows, twice, and each question sits where its subject is. "What colour is the Howler’s LEVEL light?" takes the light’s place. "Can the recording level remove the crunch?" sits with the recording level, which goes live once it is answered.
- The answer says back what was said, then what is so, then the cause, in three lines at most: "You said red. It is green", then "The light is right. The level into the Howler is 3 dB under its ceiling."
- The light’s reading says what it measures: "Input 3 dB under its ceiling". While the mixer cuts, it adds "It does not show crunch made before it."
- The file says where its crunch was made and how much was cut: "Made in the mixer. Tops cut by 6 dB." The mixer’s share stays put while the recording level moves. Turned up until the flat tops pass the Howler’s ceiling, the Howler’s cut is added: "Made in the mixer and at the Howler. Tops cut by 12 dB in all."
- Crunch is Clean, Tips cut or Crunchy. "Some crunch" and "Heavy crunch" are gone.
- The Howler’s screen draws the wave that left the mixer, faint, behind its own: the same flat tops, made smaller. It marks only what its own ceiling cut, which cleared the tangle of lines it had.
- Each try in step 2 is answered at once ("You turned it down 6 dB. The flat tops are smaller. They are still flat."). The step ends after two tries, or 20 seconds after the first.
- A control a step leaves alone shows as a reading, its name and setting, and not as a dead fader.
- The stage heads lost their state words. The light and the screen say it once.
- Step 4 says that Howler puts the mixer first, and that the step shows the other case.
- The notes on what you hear show while the sound plays. "It starts quietly" stays, as on the other labs.
- The screens line up side by side down to their captions (a subgrid), so a caption that wraps moves both.
- Learn 4.4 has two new rows: the Howler’s LEVEL light, in its manual’s words, and MASTER LEVEL with a channel in the red, the assumption the lab’s lesson rests on.

### Verification

`pnpm verify` passes: lint, Astro and Svelte checks, 605 unit and component tests, the build, and 239 browser tests (10 skipped by design). With `BASE_PATH=/ClipClip/` and `CROSS_BROWSER=1`, 319 browser tests pass (13 skipped by design). Every step was inspected at 360, 390 and 1440 pixels, in both themes.

### Still open

- Whether the XDJ-RX2 cuts a channel in the red before MASTER LEVEL. Pioneer does not say. A 2016 reply by Pioneer DJ’s forum moderator, relaying its engineers, says that on the DJM-900NXS and DJM-900NXS2 a digital source (USB or S/PDIF) cannot be clipped at the channel, whatever the channel level, and that the MASTER output still can (community.pioneerdj.com, post 22977674121369, comment of 4 March 2016); if the XDJ-RX2 works that way, turning MASTER LEVEL down would cure a channel in the red. One check settles it: TRIM up until CH1’s red light shows at the loudest part, MASTER LEVEL down until the MASTER meters show the first orange, record on the Howler, and listen the next day. Crunch in the file means the lab is right.
- The learning report proposes a test with five DJs on their own phones, thinking aloud. It passes if nobody calls the lab broken and four of five say the light cannot tell them the file is clean.
