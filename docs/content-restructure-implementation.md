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
- The mixer prints its meter scale without plus signs (12, 9, 6, 3, 0). The site's drawings print +12, +9, +6, +3.
- C3 ends "Howler …… on charge" after the rig is switched off, and does not say where.
- Section numbers on Learn start at 2.4 in part 2, because 2.1 to 2.3 were Playing's and Playing's headings now carry none.
