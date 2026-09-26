<script lang="ts">
  /**
   * W2 · Two ceilings: the two places the sound can clip between the mixer and the recorder, and
   * which control fixes each. Three in-place steps on one hardware panel, each with one live
   * control: the recording level with the channel in the red (it cannot remove the crunch), the
   * channel (it can), then the recording level with the Howler's input overloaded (it can).
   *
   * Each step leads with what it needs, in this order: the task, its one live control, a compact
   * result strip (CH1, the crunch, the Howler light), the one screen that matters, then the
   * feedback and the way on. The locked control, the other screen and sound follow. A wide panel
   * sets the step in two columns, what you do and what it means on the left and what you see on
   * the right, so the task, control, result and screen fit on a laptop screen at once.
   *
   * One surface: the panel. Its sections are divided by printed lines, the control to move has its
   * name printed in the action colour, and the only boxes inside are the screens and the CH1 meter.
   *
   * Everything on screen comes from src/lib/lab/ceilings.ts, so the server render is complete:
   * step 1, with the channel in the red and the recording's screen drawn. The page provides the
   * heading and anchor around the island.
   */
  import { tick } from 'svelte';
  import { audio } from '../lib/audio/engine.svelte';
  import { LoopPlayer } from '../lib/audio/loopPlayer';
  import { formatDb, speakDb } from '../lib/dsp/db';
  import {
    CEILING_2,
    CHANNELS,
    type Control,
    drawScope,
    goalMet,
    KNOB,
    labSignal,
    MOVE_SETTLE_MS,
    playbackLoop,
    REVEAL_AFTER_MOVES,
    REVEAL_AFTER_MS,
    readLab,
    STEP_COUNT,
    STEP_SCOPE,
    STEP_SETUP,
    type Step,
    scopeTraces,
  } from '../lib/lab/ceilings';
  import * as copy from '../lib/lab/copy';
  import { describeLevel } from '../lib/xdj';
  import ChainStrip from './two-ceilings/ChainStrip.svelte';
  import LabScope from './two-ceilings/LabScope.svelte';
  import ResultStrip from './two-ceilings/ResultStrip.svelte';
  import Fader from './ui/Fader.svelte';
  import HwButton from './ui/HwButton.svelte';
  import ListenKey from './ui/ListenKey.svelte';
  import Pad from './ui/Pad.svelte';

  interface Props {
    /** The step titles' level: one below the heading the page puts over the lab (an h3 in the guide). */
    headingLevel?: 3 | 4 | 5;
  }

  let { headingLevel = 4 }: Props = $props();

  const uid = $props.id();
  const signal = labSignal();

  /* ---------------------------------------------------------------------------------------- */
  /* State                                                                                    */

  let step = $state<Step>(1);
  let channels = $state(STEP_SETUP[1].start.channels);
  let knob = $state(STEP_SETUP[1].start.knob);
  /** Step 1 has played out. Latches: going back doesn't hide its result again. */
  let revealed = $state(false);
  /** The knob has moved in step 1: its clock is running, and the reveal key lights. */
  let tried = $state(false);
  let knobMoves = 0;
  let hearClean = $state(false);
  let soundNote = $state<string | null>(null);
  let heading: HTMLElement | undefined = $state();
  /** The feedback box, and the key in it that moves on. */
  let feedbackBox: HTMLElement | undefined = $state();
  let feedbackNext: HTMLButtonElement | undefined = $state();

  /** Each step has one live control and one locked (ceilings.ts): which is which. */
  const liveKind = $derived(STEP_SETUP[step].live);
  const lockedKind = $derived<Control>(liveKind === 'knob' ? 'channels' : 'knob');
  /** The screen this step is about. The other one follows the step. */
  const focus = $derived(STEP_SCOPE[step]);
  const reading = $derived(readLab(signal, channels, knob));
  const traces = $derived(scopeTraces(signal, channels, knob));
  const mixerDrawing = $derived(drawScope(traces.mixer));
  const recordingDrawing = $derived(drawScope(traces.recording));
  /** Until step 1 is over, the recording's screen keeps back where its flat tops came from. */
  const claims = $derived(copy.scopeClaims(reading, revealed || step > 1));
  const sentence = $derived(copy.stateSentence(reading));
  const feedback = $derived.by(() => {
    if (step === 1) return revealed ? copy.revealFeedback(reading) : null;
    return goalMet(step, reading) ? copy.successFeedback(step, reading) : null;
  });
  /**
   * One lit key per step, only when pressing it is the thing to do: the reveal once the knob has
   * been tried. Otherwise the live control is the action, and when the feedback box offers its
   * own Next, that one is lit.
   */
  const navLit = $derived(step === 1 && !revealed && tried);

  /* ---------------------------------------------------------------------------------------- */
  /* Steps                                                                                    */

  /**
   * Scroll the page so `el` shows: just enough to see all of it ('nearest'), or not at all when
   * it's already in the top third of the screen ('settle'). A jump, like turning a page, since the
   * whole step changes at once. Always a window.scrollTo, even to where the page already is: that
   * also stops a glide the browser started towards the key just pressed, which would otherwise
   * carry the page on past the step.
   */
  function scrollToShow(el: HTMLElement, align: 'nearest' | 'settle') {
    const box = el.getBoundingClientRect();
    const padding = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    let by = 0;
    if (box.top < 0) by = box.top - padding;
    else if (align === 'settle' && box.top > window.innerHeight / 3) by = box.top - padding;
    else if (align === 'nearest' && box.bottom > window.innerHeight) {
      by = Math.min(box.bottom - window.innerHeight + 16, box.top - padding);
    }
    window.scrollTo({ top: window.scrollY + by, behavior: 'instant' });
  }

  /** A new step's head goes to the top of the screen, so its control and result follow it. */
  function showHead() {
    if (!heading) return;
    heading.focus({ preventScroll: true });
    scrollToShow(heading, 'settle');
  }

  async function goTo(next: Step) {
    step = next;
    channels = STEP_SETUP[next].start.channels;
    knob = STEP_SETUP[next].start.knob;
    if (next === 1) {
      knobMoves = 0;
      tried = false;
    }
    await tick();
    showHead();
  }

  async function next() {
    if (step === 1 && !revealed) {
      // Step 1 always ends in its result: moving on shows the result first.
      revealed = true;
      await tick();
      // The live region reads the result out, so focus goes to the result's own Next rather than
      // its text, which would then be read twice.
      if (feedbackBox) scrollToShow(feedbackBox, 'nearest');
      feedbackNext?.focus({ preventScroll: true });
      return;
    }
    if (step < STEP_COUNT) void goTo((step + 1) as Step);
  }

  function back() {
    if (step > 1) void goTo((step - 1) as Step);
  }

  /**
   * Step 1 ends after a few knob moves, or a little while after the first one, whichever comes
   * first. A move is one try: a drag, or a run of key presses or − / + taps, counted once the knob
   * settles. Nothing runs until the knob moves, so reading the step takes as long as it takes.
   */
  let settling: number | undefined;

  function knobMoving() {
    if (step !== 1 || revealed) return;
    tried = true;
    window.clearTimeout(settling);
    settling = window.setTimeout(() => {
      if (step !== 1 || revealed) return;
      knobMoves += 1;
      if (knobMoves >= REVEAL_AFTER_MOVES) revealed = true;
    }, MOVE_SETTLE_MS);
  }

  $effect(() => {
    if (step !== 1 || revealed || !tried) return;
    const timer = window.setTimeout(() => {
      revealed = true;
    }, REVEAL_AFTER_MS);
    return () => window.clearTimeout(timer);
  });

  $effect(() => () => window.clearTimeout(settling));

  /* ---------------------------------------------------------------------------------------- */
  /* Sound                                                                                    */

  const playerId = `two-ceilings-${uid}`;
  const playing = $derived(audio.owner === playerId);
  let player: LoopPlayer | null = null;

  /** A renderer for the current settings, read now so the effect below tracks them. */
  function renderer() {
    const c = channels;
    const k = knob;
    const clean = hearClean;
    return (sampleRate: number) => playbackLoop(labSignal(sampleRate), c, k, clean);
  }

  async function listen() {
    if (playing) {
      player?.stop();
      return;
    }
    soundNote = null;
    player ??= new LoopPlayer(playerId, () => {}, copy.SOUND.playing);
    const ok = await player.start(renderer());
    // start() is also false when another demo took over during the claim; that needs no note.
    if (!ok && audio.unavailable) {
      soundNote = copy.SOUND.unavailable;
      announcement = copy.SOUND.unavailable;
    }
  }

  /** "Hear the clean version" is a request to hear it, so it starts the sound if it's off. */
  function toggleClean() {
    hearClean = !hearClean;
    if (hearClean && !playing) void listen();
  }

  $effect(() => {
    const render = renderer();
    if (playing) player?.update(render);
  });

  $effect(() => () => player?.stop());

  /* ---------------------------------------------------------------------------------------- */
  /* One polite live region: the key sentence, once the reader pauses.                         */

  const liveText = $derived(feedback ? `${feedback.title}. ${feedback.lines.join(' ')}` : sentence);
  let announcement = $state('');
  let armed = false;

  $effect(() => {
    const text = liveText;
    if (!armed) {
      armed = true;
      return;
    }
    const timer = window.setTimeout(() => {
      announcement = text;
    }, 400);
    return () => window.clearTimeout(timer);
  });

  /* ---------------------------------------------------------------------------------------- */
  /* Formatting                                                                               */

  // The meter tops out at +12, so the number is the level and the meter only says where it lands.
  const speakChannels = (v: number) => `${speakDb(v)}, ${describeLevel(v)} on the channel meter`;
  const speakKnob = (v: number) => (v === 0 ? '0 decibels, fully up' : speakDb(v));
</script>

<!--
  One control, live or locked. A live control carries its hint and sits in the step, right under
  the task; a locked one carries its lock note instead and waits after the step.
-->
{#snippet control(kind: Control, locked: boolean)}
  {@const id = `${uid}-${kind}`}
  {@const noteId = `${id}-${locked ? 'lock' : 'hint'}`}
  <div class="control" class:lit={!locked} class:cue={kind === 'knob' && step === 1 && !tried && !revealed}>
    {#if kind === 'channels'}
      <Fader
        {id}
        label={copy.CONTROLS.channels.label}
        plain
        steppers
        bind:value={channels}
        min={CHANNELS.min}
        max={CHANNELS.max}
        step={CHANNELS.step}
        format={(v) => formatDb(v)}
        speak={speakChannels}
        disabled={locked}
        describedby={noteId}
      />
    {:else}
      <Fader
        {id}
        label={copy.CONTROLS.knob.label}
        plain
        steppers
        bind:value={knob}
        min={KNOB.min}
        max={KNOB.max}
        step={KNOB.step}
        format={copy.knobText}
        speak={speakKnob}
        disabled={locked}
        describedby={noteId}
        oninput={knobMoving}
      />
    {/if}
    {#if locked}
      <p class="lock" id={noteId}>
        <svg viewBox="0 0 12 14" width="12" height="14" aria-hidden="true">
          <path d="M3.2 6V4.2a2.8 2.8 0 0 1 5.6 0V6" fill="none" stroke="currentColor" stroke-width="1.5" />
          <rect x="1.5" y="6" width="9" height="7" rx="1.5" fill="currentColor" />
        </svg>
        {copy.NAV.locked}
      </p>
    {:else}
      <p class="hint" id={noteId}>{copy.CONTROLS[kind].hint}</p>
    {/if}
  </div>
{/snippet}

{#snippet screen(which: 'mixer' | 'recording')}
  {#if which === 'mixer'}
    <LabScope title={copy.SCOPES.mixer} ceilingLabel={copy.SCOPES.ceiling1} claim={claims.mixer} drawing={mixerDrawing} />
  {:else}
    <!-- Same scale as the mixer's screen: ceiling 2 sits lower, where the model puts it. -->
    <LabScope
      title={copy.SCOPES.recording}
      ceilingLabel={copy.SCOPES.ceiling2}
      ceiling={CEILING_2}
      claim={claims.recording}
      drawing={recordingDrawing}
    />
  {/if}
{/snippet}

<!-- Volume lives on the page-wide sound bar, which appears while anything plays. -->
{#snippet transport()}
  <div class="transport">
    <ListenKey
      {playing}
      onclick={listen}
      label={copy.SOUND.listen}
      stopLabel={copy.SOUND.stop}
      aria-describedby="{uid}-quiet {uid}-steady"
    />
    <Pad pressed={hearClean} onclick={toggleClean} aria-describedby="{uid}-matched">{copy.SOUND.clean}</Pad>
  </div>
  <p class="quiet" id="{uid}-quiet">{soundNote ?? copy.SOUND.quiet}</p>
  <p class="note">
    <span id="{uid}-steady">{copy.SOUND.steady}</span>
    <span id="{uid}-matched">{copy.SOUND.matched}</span>
  </p>
{/snippet}

<div class="two-ceilings panel">
  <ChainStrip mixer={reading.mixer} recorder={reading.recorder} />

  <div class="task">
    <div class="head">
      <!-- The step in words ("Step 2 of 3"), over its title, like a numbered card in a quick
           reference handbook. -->
      <svelte:element this={`h${headingLevel}`} class="step" tabindex="-1" bind:this={heading}>
        <span class="counter">{copy.stepCounter(step, STEP_COUNT)}</span>
        <span class="title">{copy.STEPS[step].title}</span>
      </svelte:element>
      <p class="body">{copy.STEPS[step].body}</p>
      <noscript><p class="noscript">{copy.NO_SCRIPT}</p></noscript>
    </div>

    <div class="live">{@render control(liveKind, false)}</div>

    <!-- What you see: the result strip, the step's screen and the key to it. -->
    <div class="view">
      <ResultStrip {channels} crunch={reading.crunch} howler={reading.howler} />
      {@render screen(focus)}
      <div class="scope-key">
        <ul class="legend">
          <li>
            <svg class="swatch" viewBox="0 0 24 12" width="24" height="12" aria-hidden="true">
              <path class="sw-music" d="M2 6H22" />
            </svg>
            {copy.SCOPES.legend.music}
          </li>
          <li>
            <svg class="swatch" viewBox="0 0 24 12" width="24" height="12" aria-hidden="true">
              <path class="sw-wash" d="M3 11C6 1 18 1 21 11Z" />
              <path class="sw-ghost" d="M3 11C6 1 18 1 21 11" />
              <path class="sw-flat" d="M6 7.5H18" />
            </svg>
            {copy.SCOPES.legend.cut}
          </li>
        </ul>
        <p class="zoom">{copy.SCOPES.zoom}</p>
      </div>
    </div>

    <div class="say">
      {#if feedback}
        <div class="goal" bind:this={feedbackBox}>
          <p class="goal-title">{feedback.title}</p>
          {#each feedback.lines as line (line)}
            <p>{line}</p>
          {/each}
          {#if feedback.next}
            <span class="goal-next">
              <HwButton primary onclick={next} bind:element={feedbackNext}>{feedback.next}</HwButton>
            </span>
          {/if}
        </div>
      {:else}
        <p class="sentence">{sentence}</p>
      {/if}

      <div class="nav">
        {#if step > 1}
          <HwButton onclick={back}>{copy.NAV.back}</HwButton>
        {/if}
        {#if step < STEP_COUNT}
          <HwButton primary={navLit} onclick={next}>
            {step === 1 && !revealed ? copy.NAV.reveal : copy.NAV.next}
          </HwButton>
        {/if}
      </div>
    </div>
  </div>

  <div class="after">
    <div class="locked">{@render control(lockedKind, true)}</div>
    <div class="other">{@render screen(focus === 'mixer' ? 'recording' : 'mixer')}</div>
    <div class="sound">{@render transport()}</div>
  </div>

  <p class="model">{copy.MODEL_NOTE.text} <a href={copy.MODEL_NOTE.href}>{copy.MODEL_NOTE.link}</a>.</p>

  <p class="visually-hidden" aria-live="polite">{announcement}</p>
</div>

<style>
  .two-ceilings {
    container: two-ceilings / inline-size;
    display: grid;
    gap: clamp(1rem, 0.85rem + 0.8vw, 1.4rem);
    min-width: 0;
  }

  /* Rows of the panel are divided like sections of a mixer's top plate. */
  .task,
  .after,
  .model {
    padding-top: clamp(1rem, 0.85rem + 0.8vw, 1.4rem);
    border-top: 1px solid var(--hw-edge);
  }

  /* -------------------------------------------------------------------------------------- */
  /* The step: head, live control, what you see, what it means                              */

  .task {
    display: grid;
    gap: 1.1rem;
    align-items: start;
  }

  .head,
  .live,
  .view,
  .say {
    display: grid;
    align-content: start;
    min-width: 0;
  }

  .head {
    gap: 0.6rem;
    justify-items: start;
  }

  .live {
    gap: 0.9rem;
  }

  .view {
    gap: 0.75rem;
  }

  .say {
    gap: 0.9rem;
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

  .body {
    max-width: 40rem;
    margin: 0;
    line-height: 1.55;
    color: var(--hw-label);
  }

  .noscript {
    margin: 0;
    font-weight: 700;
    color: var(--hw-bright);
  }

  /* -------------------------------------------------------------------------------------- */
  /* Controls                                                                               */

  .control {
    display: grid;
    gap: 0.4rem;
    min-width: 0;
  }

  /* The control this step is about: its name printed in the action colour, the thing to move. */
  .control.lit :global(.plain-label) {
    color: var(--hw-action);
  }

  /* Step 1, before the knob has moved: the knob is the only thing to do, so an arrow in the
     action colour points at its name. Drawn, so screen readers don't read it out. */
  .control.cue :global(.plain-label)::before {
    content: '';
    display: inline-block;
    width: 0.6em;
    height: 0.7em;
    margin-right: 0.45em;
    background: var(--hw-action);
    clip-path: polygon(0 0, 100% 50%, 0 100%);
  }

  .hint,
  .lock {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.45;
    color: var(--hw-label);
  }

  .lock {
    display: flex;
    align-items: center;
    gap: 0.45rem;
    font-weight: 700;
  }

  .lock svg {
    flex: none;
    display: inline;
  }

  .locked {
    display: grid;
    gap: 1rem;
    align-content: start;
    min-width: 0;
  }

  /* -------------------------------------------------------------------------------------- */
  /* The key to the screens                                                                 */

  .scope-key {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.35rem 1.25rem;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 1.25rem;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .legend li,
  .zoom {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin: 0;
    font-size: var(--text-xs);
    line-height: 1.4;
    color: var(--hw-label-2);
  }

  .swatch {
    flex: none;
    display: inline;
    overflow: visible;
  }

  .sw-music,
  .sw-ghost,
  .sw-flat {
    fill: none;
    stroke-linecap: round;
  }

  .sw-music {
    stroke: var(--sig);
    stroke-width: 2;
  }

  .sw-wash {
    fill: var(--dmg);
    fill-opacity: 0.14;
  }

  .sw-ghost {
    stroke: var(--dmg);
    stroke-width: 1.25;
    stroke-dasharray: 2.5 2.5;
  }

  .sw-flat {
    stroke: var(--dmg);
    stroke-width: 3;
  }

  /* -------------------------------------------------------------------------------------- */
  /* What it means, and the way on                                                           */

  .sentence {
    margin: 0;
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

  .goal .goal-title {
    font-family: var(--font-display);
    font-size: var(--text-h3);
    font-weight: 700;
    line-height: 1.2;
    color: var(--hw-bright);
  }

  .goal-next {
    margin-top: 0.35rem;
  }

  .nav {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.75rem;
  }

  /* -------------------------------------------------------------------------------------- */
  /* After the step: the locked control, the other screen and sound                          */

  .after {
    display: grid;
    gap: 1.25rem;
    align-items: start;
  }

  .other {
    min-width: 0;
  }

  .sound {
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

  /* "It starts quietly. If you hear nothing…": something to act on, so it reads at full size. */
  .quiet {
    margin: 0;
    max-width: 40rem;
    font-size: var(--text-sm);
    line-height: 1.4;
    color: var(--hw-label);
  }

  .note {
    margin: 0;
    max-width: 44rem;
    font-size: var(--text-sm);
    line-height: 1.5;
    color: var(--hw-label);
  }

  /* The model's caveat, once, pointing to the guide's section on what the makers publish. Its
     rule runs the panel's width; its words keep a reading measure. */
  .model {
    padding-right: max(0px, 100% - 44rem);
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.45;
    color: var(--hw-label);
  }

  /* Links on the panel are printed in the panel's own white, whatever the page's light. */
  .model a {
    color: var(--hw-bright);
    text-decoration-color: color-mix(in oklab, var(--hw-bright) 60%, transparent);
  }

  .model a:hover {
    text-decoration-color: currentColor;
  }

  /* -------------------------------------------------------------------------------------- */
  /* Wider panels                                                                           */

  /*
   * A laptop: the step in two columns. What you do and what it means on the left (the control,
   * then the feedback and the way on), what you see on the right (the result strip and the
   * screen). The feedback's row is flexible, so it starts right under the control however tall
   * the right-hand column is.
   */
  @container two-ceilings (min-width: 46rem) {
    .task,
    .after {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1.15fr);
      column-gap: clamp(1.5rem, 1rem + 1.5vw, 2.5rem);
    }

    .task {
      grid-template-rows: auto auto 1fr;
      grid-template-areas:
        'head head'
        'live view'
        'say view';
      row-gap: 1.25rem;
    }

    .head {
      grid-area: head;
    }

    .live {
      grid-area: live;
    }

    .view {
      grid-area: view;
    }

    .say {
      grid-area: say;
    }

    .after {
      grid-template-rows: auto 1fr;
      grid-template-areas:
        'locked other'
        'sound other';
    }

    .locked {
      grid-area: locked;
    }

    .other {
      grid-area: other;
    }

    .after .sound {
      grid-area: sound;
    }
  }

  @media (forced-colors: active) {
    /* Backgrounds are dropped here, so the arrow keeps its shape in the text colour. */
    .control.cue :global(.plain-label)::before {
      forced-color-adjust: none;
      background: CanvasText;
    }

    .sw-music {
      stroke: CanvasText;
    }

    .sw-ghost,
    .sw-flat {
      stroke: Highlight;
    }
  }
</style>
