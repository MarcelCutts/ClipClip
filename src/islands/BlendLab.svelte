<script lang="ts">
  /**
   * W3 "Blends add up": a small mixer, two decks and the MASTER meters, in four steps (model.ts,
   * STEP_START). Bring deck 2 in and watch the peaks add; fix it with a fader; push both channels
   * to the top orange and hear the mix go 3 dB past the red; then leave room with TRIM.
   *
   * It is a mixer first. Every control is on the panel and live in every step, in the unit's
   * order: each deck's TRIM and LOW above its fader, as on the XDJ-RX2's channel strip, and the
   * meters between the faders. Anything a DJ can do to the unit, the reader can do here, the red
   * included: a lab that cannot go wrong cannot show what going wrong sounds like. The step names
   * the control to move, printed in the action colour until it moves.
   *
   * On a phone the meters come first and every control that moves them comes under them, the faders
   * beside them and each deck's TRIM and LOW below: a thumb on a slider hides what is under it, never
   * what is above. On a wide panel the mixer is one row of channel strips, as on the unit.
   *
   * Nothing moves while a control is in use. Every word that changes as a slider moves sits in a
   * box that keeps its size: the readout by the meters, and one line under them that says how the
   * step is going. The step's result appears once, when its goal is met, and only below every
   * control: a goal met in mid-drag never pushes the slider from under the finger.
   *
   * Server-rendered complete: step 1, meters lit, its question open, before hydration.
   *
   * One surface: the panel. Its parts are set apart by printed lines, and the only boxes inside it
   * are the meters' well and the waveform's screen.
   */
  import { tick, untrack } from 'svelte';
  import { audio } from '../lib/audio/engine.svelte';
  import { LoopPlayer } from '../lib/audio/loopPlayer';
  import {
    coach,
    type Feedback,
    GUESS_LEGEND,
    GUESS_PROMPT,
    guessNote,
    guessSpot,
    MODEL_NOTES,
    MODEL_NOTES_TITLE,
    mixReadout,
    NAV,
    NO_SCRIPT,
    READOUT_LABEL,
    RESULT_CONTEXT,
    SOUND,
    STEPS,
    SUMMARY,
    stepCounter,
    stepResult,
    verdictLine,
    WAVEFORM_TOGGLE,
  } from '../lib/blend/copy';
  import {
    analyseBlend,
    type BlendSettings,
    type Control,
    cloneSettings,
    displayDb,
    FADER,
    listenBuffer,
    STEP_CONTROLS,
    STEP_COUNT,
    STEP_START,
    type Step,
    stepDone,
  } from '../lib/blend/model';
  import ChannelFader from './blend/ChannelFader.svelte';
  import Knobs from './blend/Knobs.svelte';
  import MeterBridge from './blend/MeterBridge.svelte';
  import Readout from './blend/Readout.svelte';
  import Scope from './blend/Scope.svelte';
  import HwButton from './ui/HwButton.svelte';
  import ListenKey from './ui/ListenKey.svelte';
  import Pad from './ui/Pad.svelte';

  interface Props {
    /** The step titles' level: one below the heading the page puts over the lab (an h3 in the guide). */
    headingLevel?: 3 | 4 | 5;
  }

  let { headingLevel = 4 }: Props = $props();

  const uid = $props.id();
  /**
   * The live region waits this long after the last change. Longer than the 400 ms the fader's
   * −/+ buttons take to say their value, so the value comes first and the verdict after it.
   */
  const LIVE_DEBOUNCE_MS = 700;

  /* ---------------------------------------------------------------------------------------- */
  /* State                                                                                    */

  let step = $state<Step>(1);
  let settings = $state<BlendSettings>(cloneSettings(STEP_START[1]));

  const analysis = $derived(analyseBlend(settings));
  const readout = $derived(mixReadout(analysis));
  const meters = $derived({
    ch1: displayDb(analysis.channel[0]),
    ch2: displayDb(analysis.channel[1]),
    master: displayDb(analysis.mix),
  });

  /** The controls the step asks for that the reader has not moved yet: printed in the action colour. */
  let moved = $state<Control[]>([]);
  const lit = $derived(STEP_CONTROLS[step].filter((c) => !moved.includes(c)));
  const touch = (c: Control) => {
    if (!moved.includes(c)) moved = [...moved, c];
  };

  /**
   * The step's result, taken when its goal is first met and kept until the step changes, so the
   * words stay put while the reader carries on moving things. It is labelled as a past result;
   * the line beside the meters and the live region always describe the current mixer.
   */
  let result = $state<Feedback | null>(null);
  const line = $derived(coach(step, settings, analysis));

  $effect(() => {
    if (result === null && currentResult) result = currentResult;
  });

  /* ---------------------------------------------------------------------------------------- */
  /* The guess, in step 1                                                                     */
  // Before deck 2 first moves, the reader can tap the MASTER LED where they think the blend will
  // peak. The mark stays by the meter for the rest of the step, beside the real peak, and the
  // result says the guess back.

  /** The guessed LED's dB mark. */
  let guess = $state<number | null>(null);
  let guessOpen = $state(true);
  const guessLine = $derived(guess !== null ? guessNote(guess, guessOpen) : guessOpen ? GUESS_PROMPT : null);
  const currentResult = $derived(stepDone(step, settings, analysis) ? stepResult(step, settings, analysis, guess) : null);

  // Deck 2 moving closes the guess: from here on the meters give the answer away.
  $effect(() => {
    if (step === 1 && guessOpen && settings.deck2.fader > FADER.min) guessOpen = false;
  });

  /* ---------------------------------------------------------------------------------------- */
  /* Steps                                                                                    */

  let heading: HTMLElement | undefined = $state();

  /**
   * A new step's head goes to the top of the screen, so the mixer follows it: a jump, like turning
   * a page, since the whole mixer changes at once. Not at all when it is already in the top third.
   */
  function showHead() {
    if (!heading) return;
    heading.focus({ preventScroll: true });
    const box = heading.getBoundingClientRect();
    const padding = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    if (box.top >= padding && box.top <= window.innerHeight / 3) return;
    window.scrollTo({ top: window.scrollY + box.top - padding, behavior: 'instant' });
  }

  async function goTo(next: Step) {
    step = next;
    settings = cloneSettings(STEP_START[next]);
    moved = [];
    result = null;
    guess = null;
    guessOpen = next === 1;
    hearClean = false;
    await tick();
    showHead();
  }

  const next = () => {
    if (step < STEP_COUNT) void goTo((step + 1) as Step);
  };
  const back = () => {
    if (step > 1) void goTo((step - 1) as Step);
  };

  /* ---------------------------------------------------------------------------------------- */
  /* Sound                                                                                    */

  let playing = $state(false);
  let hearClean = $state(false);
  let soundProblem = $state<string | null>(null);
  let lastHeard = '';
  // The label names this demo on the page-wide Stop bar.
  const player = new LoopPlayer(
    `blend-lab-${uid}`,
    () => {
      playing = false;
    },
    SOUND.playing,
  );

  const heardKey = (s: BlendSettings, clean: boolean) => `${JSON.stringify(s)}:${clean}`;

  async function listen() {
    if (playing) {
      player.stop();
      return;
    }
    soundProblem = null;
    const snapshot = $state.snapshot(settings);
    const clean = hearClean;
    lastHeard = heardKey(snapshot, clean);
    playing = true;
    const ok = await player.start((sampleRate) => listenBuffer(snapshot, sampleRate, clean));
    if (!ok) {
      // No sound at all, or another demo took over while this one started.
      playing = false;
      if (audio.unavailable) soundProblem = SOUND.unavailable;
    }
  }

  /** "Hear the clean version" is a request to hear it, so it starts the sound if it's off. */
  function toggleClean() {
    hearClean = !hearClean;
    if (hearClean && !playing) void listen();
  }

  $effect(() => {
    const snapshot = $state.snapshot(settings);
    const clean = hearClean;
    if (!playing) return;
    const key = heardKey(snapshot, clean);
    if (key === lastHeard) return;
    lastHeard = key;
    untrack(() => player.update((sampleRate) => listenBuffer(snapshot, sampleRate, clean)));
  });

  $effect(() => () => player.stop());

  /* ---------------------------------------------------------------------------------------- */
  /* One polite live region                                                                   */
  // Once the reader pauses it describes the current mixer, even after completing the step.
  // The stored result below the controls is history, not a reason to stop announcing changes.

  const liveText = $derived(
    currentResult
      ? `${currentResult.title}. ${currentResult.lines.join(' ')}`
      : [line, verdictLine(analysis)].filter(Boolean).join(' '),
  );
  let spoken = $state('');
  /** What the reader last heard (or saw on load). */
  let heard = untrack(() => liveText);

  $effect(() => {
    const text = liveText;
    const timer = window.setTimeout(() => {
      if (text === heard) return;
      heard = text;
      spoken = text;
    }, LIVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  });

  /* ---------------------------------------------------------------------------------------- */
  /* The waveform                                                                             */

  /** Behind a toggle until the panel is wide enough to show it beside the mixer. */
  let waveOpen = $state(false);
</script>

<section class="panel blend" aria-label="Blend lab" data-playing={playing}>
  <!-- One grid, in the order a reader on a phone needs it: a thumb on a slider hides what is under
       it, so the meters come first and every control that moves them sits beside or under them. A
       wide panel rearranges the same grid into a row of channel strips. -->
  <div class="layout">
    <div class="head">
      <!-- The step in words ("Step 2 of 4"), over its title, like a numbered card in a quick
           reference handbook. -->
      <svelte:element this={`h${headingLevel}`} class="step" tabindex="-1" bind:this={heading}>
        <span class="counter">{stepCounter(step, STEP_COUNT)}</span>
        <span class="title">{STEPS[step].title}</span>
      </svelte:element>
      <p class="body">{STEPS[step].body}</p>
      <noscript><p class="noscript">{NO_SCRIPT}</p></noscript>
    </div>

    <div class="mixer">
      <!-- Above the meters, where the reader looks first. The radios' legend asks the question
           and the result says the guess back, so this stays out of the accessibility tree. It
           keeps two lines' height in step 1 whatever it says, so nothing under it moves. -->
      {#if step === 1}
        <p class="guess-line" data-guessed={guess !== null} data-open={guessOpen} aria-hidden="true">
          {#if guessLine}<span class="mark-key"></span>{guessLine}{/if}
        </p>
      {/if}
      <ChannelFader
        n={1}
        bind:value={settings.deck1.fader}
        {uid}
        lit={lit.includes('fader1')}
        onmove={() => touch('fader1')}
      />
      <div class="centre">
        <MeterBridge
          ch1={meters.ch1}
          master={meters.master}
          ch2={meters.ch2}
          clip={analysis.clip}
          {guess}
          guessing={step === 1 && guessOpen}
          guessName="{uid}-guess"
          guessLegend={GUESS_LEGEND}
          {guessSpot}
          onguess={(db) => (guess = db)}
        />
        <Readout label={READOUT_LABEL} {...readout} />
      </div>
      <ChannelFader
        n={2}
        bind:value={settings.deck2.fader}
        {uid}
        lit={lit.includes('fader2')}
        onmove={() => touch('fader2')}
      />
    </div>

    <!-- Current feedback stays beside the meters even after the first completed result. -->
    <p class="coach">{currentResult?.title ?? line}</p>

    <!-- Each deck's TRIM and LOW: under the meters on a phone, beside its fader on a wide panel. -->
    <div class="knobs1">
      <Knobs
        n={1}
        bind:trim={settings.deck1.trim}
        bind:low={settings.deck1.low}
        peak={meters.ch1}
        {uid}
        lit={lit.includes('trim1')}
        onmove={() => touch('trim1')}
      />
    </div>
    <div class="knobs2">
      <Knobs
        n={2}
        bind:trim={settings.deck2.trim}
        bind:low={settings.deck2.low}
        peak={meters.ch2}
        {uid}
        lit={lit.includes('trim2')}
        onmove={() => touch('trim2')}
      />
    </div>

    <div class="say">
      {#if result}
        <div class="goal">
          <p class="goal-context">{RESULT_CONTEXT}</p>
          <p class="goal-title">{result.title}</p>
          {#each result.lines as text (text)}
            <p>{text}</p>
          {/each}
          {#if result.next}
            <span class="goal-next"><HwButton primary onclick={next}>{result.next}</HwButton></span>
          {:else}
            <div class="summary">
              <p class="summary-title">{SUMMARY.title}</p>
              {#each SUMMARY.lines as text (text)}
                <p>{text}</p>
              {/each}
            </div>
          {/if}
        </div>
      {/if}
      <div class="nav">
        {#if step > 1}<HwButton onclick={back}>{NAV.back}</HwButton>{/if}
        {#if step < STEP_COUNT && !result}<HwButton onclick={next}>{NAV.next}</HwButton>{/if}
      </div>
    </div>

    <!-- Volume lives on the page-wide sound bar, which appears while anything plays. -->
    <div class="listen">
      <div class="transport">
        <ListenKey
          {playing}
          onclick={listen}
          label={SOUND.listen}
          stopLabel={SOUND.stop}
          aria-describedby="{uid}-quiet"
        />
        <Pad pressed={hearClean} onclick={toggleClean}>{SOUND.clean}</Pad>
      </div>
      <p class="quiet" id="{uid}-quiet">{soundProblem ?? SOUND.quiet}</p>
      <!-- What you are hearing, while you hear it. -->
      {#if playing}<p class="note">{hearClean ? SOUND.matched : SOUND.steady}</p>{/if}
    </div>

    <div class="wave" data-open={waveOpen}>
      <button
        type="button"
        class="disclose wave-toggle"
        aria-expanded={waveOpen}
        aria-controls="{uid}-wave"
        onclick={() => (waveOpen = !waveOpen)}>{WAVEFORM_TOGGLE}</button
      >
      <div class="wave-body" id="{uid}-wave">
        <Scope view={analysis.view} {uid} />
      </div>
    </div>

    <div class="foot">
      <details>
        <summary class="disclose">{MODEL_NOTES_TITLE}</summary>
        <ul>
          {#each MODEL_NOTES as note (note)}
            <li>{note}</li>
          {/each}
        </ul>
      </details>
    </div>
  </div>

  <p class="visually-hidden" aria-live="polite">{spoken}</p>
</section>

<style>
  /* Named, so the mixer can be a container too without stealing these queries. */
  .blend {
    container: blend / inline-size;
  }

  /*
   * Phones first: one column in the order a thumb needs it, but for the two decks' TRIM and LOW,
   * side by side under the meters. The step; the meters between the faders; how it is going; the
   * knobs; the result, once there is one; Listen; the waveform.
   */
  .layout {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-areas:
      'head head'
      'mixer mixer'
      'coach coach'
      'knobs1 knobs2'
      'say say'
      'listen listen'
      'wave wave'
      'foot foot';
    gap: 1.1rem 1rem;
  }

  .head {
    grid-area: head;
  }

  .mixer {
    grid-area: mixer;
  }

  .coach {
    grid-area: coach;
  }

  .knobs1 {
    grid-area: knobs1;
  }

  .knobs2 {
    grid-area: knobs2;
  }

  .say {
    grid-area: say;
  }

  .listen {
    grid-area: listen;
  }

  .wave {
    grid-area: wave;
  }

  .foot {
    grid-area: foot;
  }

  .knobs1,
  .knobs2 {
    min-width: 0;
  }

  @container blend (min-width: 28rem) {
    .layout {
      column-gap: 1.5rem;
    }
  }

  /*
   * Wide: the mixer as one row of channel strips, as it lies on the unit left to right: deck 1's
   * TRIM and LOW, its fader, the meters, deck 2's fader, its TRIM and LOW. Every control that
   * moves the meters sits beside them, and the whole mixer fits one screen with the step over it.
   * Under it, how it is going and the result on the left, Listen and the waveform on the right:
   * nothing there sits over a control.
   *
   * The mixer is a size container, so it has no width of its own to give an auto column: its two
   * middle columns give it the width its faders and meters take at their full size.
   */
  @container blend (min-width: 54rem) {
    .layout {
      grid-template-columns: minmax(0, 1fr) 14rem 14rem minmax(0, 1fr);
      grid-template-areas:
        'head head head head'
        'knobs1 mixer mixer knobs2'
        'coach coach listen listen'
        'say say wave wave'
        'foot foot foot foot';
      column-gap: 1.75rem;
    }

    .knobs1,
    .knobs2 {
      align-self: center;
    }

    .coach,
    .say,
    .listen,
    .wave {
      align-self: start;
    }

  }

  /* The step's head -------------------------------------------------------------------------- */

  .head {
    display: grid;
    gap: 0.6rem;
    justify-items: start;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--hw-edge);
  }

  .step {
    display: grid;
    gap: 0.3rem;
    justify-self: stretch;
    max-width: 40rem;
    margin: 0;
    font-family: var(--font-display);
    color: var(--hw-bright);
  }

  .step:focus-visible {
    outline: 3px solid var(--hw-focus);
    outline-offset: 4px;
  }

  .counter {
    font-family: var(--font-body);
    font-size: var(--text-sm);
    font-weight: 700;
    line-height: 1.3;
    font-variant-numeric: tabular-nums;
    color: var(--hw-label);
  }

  /* One size under the page's heading for the lab, which sits above the panel. */
  .title {
    font-size: var(--text-h3);
    font-weight: 700;
    line-height: 1.2;
    text-wrap: balance;
  }

  .body,
  .noscript {
    max-width: 40rem;
    margin: 0;
    line-height: 1.55;
    color: var(--hw-label);
  }

  .noscript {
    font-weight: 700;
    color: var(--hw-bright);
  }

  /* Mixer: faders either side of the meters -------------------------------------------------- */

  /* Each fader runs about the height of the meters beside it. Every column has a set width, so
     nothing in the middle one (the guess, the readout) can push a fader. */
  .mixer {
    container: mixer / inline-size;
    display: grid;
    inline-size: min(100%, 30rem);
    margin-inline: auto;
    grid-template-columns: 3.5rem minmax(0, 1fr) 3.5rem;
    column-gap: 0.35rem;
    align-items: start;
    --fader-length: 8.5rem;
  }

  @container blend (min-width: 18rem) {
    .mixer {
      column-gap: 0.4rem;
      --fader-length: 14rem;
    }
  }

  @container blend (min-width: 20rem) {
    .mixer {
      grid-template-columns: 3.75rem minmax(0, 1fr) 3.75rem;
      column-gap: 0.5rem;
    }
  }

  @container blend (min-width: 28rem) {
    .mixer {
      grid-template-columns: 5.5rem minmax(0, 1fr) 5.5rem;
      column-gap: 1.25rem;
      --fader-length: 15.5rem;
    }
  }

  /* The readout sits right under the meters, where the eye already is. */
  .centre {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }

  /* Above the meters and both faders, two lines tall whatever it says (or when it's empty), so
     its words changing never moves anything below it. */
  .guess-line {
    grid-column: 1 / -1;
    display: flex;
    align-items: flex-end;
    justify-content: center;
    gap: 0.5rem;
    min-height: 2.7em;
    margin: 0 0 0.75rem;
    font-size: var(--text-sm);
    font-weight: 700;
    line-height: 1.35;
    text-align: center;
    text-wrap: balance;
    color: var(--hw-bright);
  }

  /* While the guess is open the line says what to do, so it's printed in the action colour. */
  .guess-line[data-open='true'] {
    color: var(--hw-action);
  }

  /* The key for the white outline on the meter, drawn the same way. */
  .mark-key {
    display: none;
    flex: none;
    align-self: center;
    width: 1.3rem;
    height: 0.8rem;
    border: 2px dashed var(--hw-bright);
    border-radius: var(--radius-control);
  }

  .guess-line[data-guessed='true'] .mark-key {
    display: block;
  }

  /* The narrowest phones have no guess (the LEDs are too small to tap). */
  @container mixer (max-width: 17.99rem) {
    .guess-line {
      display: none;
    }
  }

  /* How it is going, and the result ---------------------------------------------------------- */

  .say {
    display: grid;
    gap: 0.9rem;
    align-content: start;
    min-width: 0;
  }

  /* Two lines' room whatever it says (coach keeps to two on the narrowest phone), so no word
     changing moves what is under it. */
  .coach {
    min-height: calc(2 * 1.45em);
    margin: 0;
    font-size: var(--text-sm);
    font-weight: 700;
    line-height: 1.45;
    color: var(--hw-bright);
  }

  /* What happened, under a printed line: the verdict in the display face, then why. */
  .goal {
    display: grid;
    gap: 0.5rem;
    justify-items: start;
    padding-top: 0.9rem;
    border-top: 1px solid var(--hw-edge);
  }

  .goal p {
    margin: 0;
    max-width: 36rem;
    line-height: 1.5;
    color: var(--hw-label);
  }

  .goal .goal-title,
  .summary .summary-title {
    font-family: var(--font-display);
    font-size: var(--text-h3);
    font-weight: 700;
    line-height: 1.2;
    color: var(--hw-bright);
  }

  .goal .goal-context {
    font-size: var(--text-sm);
  }

  .goal-next {
    margin-top: 0.35rem;
  }

  /* After the last step: the two meters' lines. */
  .summary {
    display: grid;
    gap: 0.5rem;
    margin-top: 0.6rem;
    padding-top: 0.9rem;
    border-top: 1px solid var(--hw-edge);
  }

  .summary .summary-title {
    font-size: var(--text-rule);
  }

  .nav {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
  }

  .nav:empty {
    display: none;
  }

  /* Listen ----------------------------------------------------------------------------------- */

  .listen {
    display: grid;
    gap: 0.6rem;
    align-content: start;
    min-width: 0;
  }

  .transport {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem 0.5rem;
  }

  .quiet,
  .note {
    margin: 0;
    max-width: 40rem;
    font-size: var(--text-sm);
    line-height: 1.45;
    color: var(--hw-label);
  }

  /* The waveform: behind a toggle on phones, beside the mixer on wide panels. ---------------- */

  .wave {
    display: grid;
    gap: 0.5rem;
  }

  .wave-body {
    display: none;
  }

  .wave[data-open='true'] .wave-body {
    display: block;
  }

  .wave :global(svg) {
    height: 7.5rem;
  }

  @container blend (min-width: 50rem) {
    .wave .wave-toggle {
      display: none;
    }

    .wave .wave-body {
      display: block;
    }
  }

  /* Foot --------------------------------------------------------------------------------------- */

  .foot {
    display: grid;
    gap: 0.5rem;
    padding-top: 0.9rem;
    border-top: 1px solid var(--hw-edge);
  }

  /* The foot runs the panel's full width, so its lines keep a reading measure. */
  details {
    max-width: 44rem;
    font-size: var(--text-sm);
    line-height: 1.5;
    color: var(--hw-label);
  }

  /* Disclosures get a chevron that turns when open, as in the two-ceilings lab. */
  .disclose {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    width: fit-content;
    min-height: 2.75rem;
    padding: 0;
    border: 0;
    background: none;
    font: inherit;
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--hw-label);
    cursor: pointer;
    list-style: none;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  .disclose::before {
    content: '';
    width: 0.45rem;
    height: 0.45rem;
    border-right: 2px solid currentColor;
    border-bottom: 2px solid currentColor;
    rotate: -45deg;
    translate: 0 -0.05rem;
  }

  details[open] summary::before,
  .disclose[aria-expanded='true']::before {
    rotate: 45deg;
    translate: 0 -0.2rem;
  }

  .disclose:focus-visible {
    outline: 3px solid var(--hw-focus);
    outline-offset: 2px;
    border-radius: var(--radius-control);
  }

  /* Clear of the summary's focus ring. */
  details ul {
    display: grid;
    gap: 0.35rem;
    margin: 0.4rem 0 0.25rem;
    padding-left: 1.1rem;
  }
</style>
