<script lang="ts">
  /**
   * W2 · Two ceilings: where clipping happens between the mixer and the recorder, and which knob
   * can fix it. A guided flow in five in-place steps (predict, a challenge that can't be won,
   * the real fix, the knob-only fix, then a sandbox), on one hardware panel.
   *
   * Each step leads with what it needs, in this order: the task, its one live control, a compact
   * result strip (CH1, the crunch, the Howler light), the one screen that matters, then the
   * feedback and the way on. The locked control, the other screen, sound and the numbers follow.
   * A wide panel sets the step in two columns, what you do and what it means on the left and what
   * you see on the right, so the task, control, result and screen fit on a laptop screen at once.
   *
   * One surface: the panel. Its sections are divided by printed lines, the control to move has its
   * name printed in the action colour, and the only boxes inside are the screens and the CH1 meter.
   *
   * Everything on screen comes from src/lib/lab/ceilings.ts, so the server render is complete:
   * the prediction, the channel in the red and the mixer's screen drawn, with the outcome waiting
   * for a guess. Deep links (?lab=sandbox&preset=channels-red) are read once, on mount. The page
   * provides the heading and anchor around the island, and the "About the demos" section (#model)
   * its caveat points to.
   */
  import { onMount, tick, untrack } from 'svelte';
  import { audio } from '../lib/audio/engine.svelte';
  import { LoopPlayer } from '../lib/audio/loopPlayer';
  import { formatDb, speakDb } from '../lib/dsp/db';
  import {
    CEILING_2,
    type Ceiling,
    CHANNELS,
    type Confidence,
    drawScope,
    type Fixer,
    goalMet,
    isStep,
    KNOB,
    labSignal,
    MOVE_SETTLE_MS,
    matchingPreset,
    PRESETS,
    type Prediction,
    type PresetId,
    parseDeepLink,
    playbackLoop,
    presetById,
    REVEAL_AFTER_MOVES,
    REVEAL_AFTER_MS,
    readLab,
    SANDBOX,
    STEP_COUNT,
    STEP_SCOPE,
    STEP_SETUP,
    type Step,
    scopeTraces,
  } from '../lib/lab/ceilings';
  import * as copy from '../lib/lab/copy';
  import { describeLevel } from '../lib/xdj';
  import ChainStrip from './two-ceilings/ChainStrip.svelte';
  import KnobCheck from './two-ceilings/KnobCheck.svelte';
  import LabScope from './two-ceilings/LabScope.svelte';
  import Predict from './two-ceilings/Predict.svelte';
  import ResultStrip from './two-ceilings/ResultStrip.svelte';
  import Fader from './ui/Fader.svelte';
  import HwButton from './ui/HwButton.svelte';
  import ListenKey from './ui/ListenKey.svelte';
  import Pad from './ui/Pad.svelte';

  interface Props {
    /** The step to open on: 1 (predict) to 5 (the sandbox). */
    initialStep?: Step;
    /** A leaner panel for tight spots: no chain strip and no engineer view. */
    compact?: boolean;
    /** The step titles' level: one below the heading the page puts over the lab (an h3 in the guide). */
    headingLevel?: 3 | 4 | 5;
  }

  let { initialStep = 1, compact = false, headingLevel = 4 }: Props = $props();

  const uid = $props.id();
  const opening: Step = untrack(() => (isStep(initialStep) ? initialStep : 1));
  const openingState = STEP_SETUP[opening].start ?? presetById('channels-red');

  /* ---------------------------------------------------------------------------------------- */
  /* State                                                                                    */

  let step = $state<Step>(opening);
  let channels = $state(openingState.channels);
  let knob = $state(openingState.knob);
  let prediction = $state<Prediction | null>(null);
  let confidence = $state<Confidence | null>(null);
  /** Set when the reader tried to move past step 1 without a guess. */
  let nudge = $state(false);
  /** Challenge 1 has played out. Latches: going back doesn't hide the lesson again. */
  let revealed = $state(false);
  /** The knob has moved in challenge 1: its clock is running, and the reveal key lights. */
  let tried = $state(false);
  let knobMoves = 0;
  /** The quick check after step 4: what the reader picked for each place, and whether it's in. */
  let checkPicks = $state<Record<Ceiling, Fixer[]>>({ mixer: [], recorder: [] });
  let checked = $state(false);
  let engineer = $state(false);
  let hearClean = $state(false);
  let soundNote = $state<string | null>(null);
  let heading: HTMLElement | undefined = $state();
  /** The feedback box, and the key in it that moves on. */
  let feedbackBox: HTMLElement | undefined = $state();
  let feedbackNext: HTMLButtonElement | undefined = $state();

  const setup = $derived(STEP_SETUP[step]);
  /** Steps 2 to 4 have one live control and one locked (ceilings.ts): which is which. */
  const liveKind = $derived(setup.lockChannels ? 'knob' : 'channels');
  const lockedKind = $derived(setup.lockChannels ? 'channels' : 'knob');
  /** The screen this step is about. The other one, once it has come in, follows the step. */
  const focus = $derived(STEP_SCOPE[step]);
  const signal = $derived(labSignal(engineer ? 'tones' : 'track'));
  const reading = $derived(readLab(signal, channels, knob));
  const traces = $derived(scopeTraces(signal, channels, knob));
  const mixerDrawing = $derived(drawScope(traces.mixer));
  const recordingDrawing = $derived(drawScope(traces.recording));
  /** Until challenge 1 is over, the words mustn't give the answer away. */
  const teach = $derived(revealed || step >= 3);
  const claims = $derived(copy.scopeClaims(reading, teach));
  const sentence = $derived(copy.stateSentence(reading, teach));
  const feedback = $derived.by(() => {
    if (step === 2 && revealed) return copy.revealFeedback(reading, prediction, confidence);
    return goalMet(step, reading) ? copy.successFeedback(step, reading) : null;
  });
  const preset = $derived(matchingPreset(channels, knob));
  /**
   * While the reader is still guessing, the outcome waits: the crunch, the Howler light and the
   * recorder's ceiling. The channel's red is the question, so it stays lit.
   */
  const waiting = $derived(step === 1);
  const waitingText = $derived(prediction ? copy.WAITING.after : copy.WAITING.before);
  /**
   * One lit key per step, only when pressing it is the thing to do: Next once there's a guess to
   * test, and the reveal once the knob has been tried. Otherwise the live control is the action,
   * and when the feedback box offers its own Next, that one is lit.
   */
  const navLit = $derived((step === 1 && prediction !== null) || (step === 2 && !revealed && tried));

  /* ---------------------------------------------------------------------------------------- */
  /* Steps                                                                                    */

  /**
   * Scroll the page so `el` shows: its top at the top of the screen ('start'), just enough to see
   * all of it ('nearest'), or not at all when it's already in the top third of the screen
   * ('settle'). A jump, like turning a page, since the whole step changes at once. Always a
   * window.scrollTo, even to where the page already is: that also stops a glide the browser
   * started towards the key just pressed, which would otherwise carry the page on past the step.
   */
  function scrollToShow(el: HTMLElement, align: 'start' | 'nearest' | 'settle') {
    const box = el.getBoundingClientRect();
    const padding = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
    let by = 0;
    if (align === 'start' || box.top < 0) by = box.top - padding;
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

  async function goTo(next: Step, focusHead = true) {
    step = next;
    nudge = false;
    const start = STEP_SETUP[next].start;
    if (start) {
      channels = start.channels;
      knob = start.knob;
    }
    if (next === 2) {
      knobMoves = 0;
      tried = false;
    }
    if (focusHead) {
      await tick();
      showHead();
    }
  }

  async function next() {
    if (step === 1 && !prediction) {
      nudge = true;
      document.querySelector<HTMLInputElement>(`[name="${uid}-prediction"]`)?.focus();
      return;
    }
    if (step === 2 && !revealed) {
      // Challenge 1 always ends in its lesson: moving on shows the reveal first.
      revealed = true;
      await tick();
      // The live region reads the reveal out, so focus goes to the reveal's own Next rather than
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

  /** A fresh start: the guess, the reveal and the check go too, so each step means something again. */
  function restart() {
    prediction = null;
    confidence = null;
    revealed = false;
    checkPicks = { mixer: [], recorder: [] };
    checked = false;
    void goTo(1);
  }

  function pickFix(ceiling: Ceiling, fixer: Fixer) {
    const picked = checkPicks[ceiling];
    checkPicks[ceiling] = picked.includes(fixer) ? picked.filter((f) => f !== fixer) : [...picked, fixer];
  }

  function predict(value: Prediction) {
    prediction = value;
    nudge = false;
    if (value === 'not-sure') confidence = null;
  }

  /**
   * Challenge 1 ends after a few knob moves, or a little while after the first one, whichever
   * comes first. A move is one try: a drag, or a run of key presses or − / + taps, counted once
   * the knob settles. Nothing runs until the knob moves, so reading the step takes as long as it
   * takes.
   */
  let settling: number | undefined;

  function knobMoving() {
    if (step !== 2 || revealed) return;
    tried = true;
    window.clearTimeout(settling);
    settling = window.setTimeout(() => {
      if (step !== 2 || revealed) return;
      knobMoves += 1;
      if (knobMoves >= REVEAL_AFTER_MOVES) revealed = true;
    }, MOVE_SETTLE_MS);
  }

  $effect(() => {
    if (step !== 2 || revealed || !tried) return;
    const timer = window.setTimeout(() => {
      revealed = true;
    }, REVEAL_AFTER_MS);
    return () => window.clearTimeout(timer);
  });

  $effect(() => () => window.clearTimeout(settling));

  function applyPreset(id: PresetId) {
    const p = presetById(id);
    channels = p.channels;
    knob = p.knob;
  }

  onMount(() => {
    const link = parseDeepLink(window.location.search);
    if (!link.sandbox) return;
    step = SANDBOX;
    if (link.preset) applyPreset(link.preset);
  });

  /* ---------------------------------------------------------------------------------------- */
  /* Sound                                                                                    */

  const playerId = `two-ceilings-${uid}`;
  const playing = $derived(audio.owner === playerId);
  let player: LoopPlayer | null = null;

  /** A renderer for the current settings, read now so the effect below tracks them. */
  function renderer() {
    const kind = engineer ? 'tones' : 'track';
    const c = channels;
    const k = knob;
    // The prediction step only offers the recording, so a clean version left on stays out of it.
    const clean = hearClean && step > 1;
    return (sampleRate: number) => playbackLoop(labSignal(kind, sampleRate), c, k, clean);
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
{#snippet control(kind: 'channels' | 'knob', locked: boolean)}
  {@const id = `${uid}-${kind}`}
  {@const noteId = `${id}-${locked ? 'lock' : 'hint'}`}
  <div class="control" class:lit={!locked} class:cue={kind === 'knob' && step === 2 && !tried && !revealed}>
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

{#snippet result()}
  <ResultStrip
    {channels}
    crunch={waiting ? null : reading.crunch}
    howler={waiting ? null : reading.howler}
    waiting={waitingText}
  />
{/snippet}

<!-- The step's screen (both, in the sandbox) and the key to them. The two conditionals touch:
     whitespace between them can turn into an empty grid row. -->
{#snippet screensAndKey()}
  <div class="screens">
    {#if focus !== 'recording'}{@render screen('mixer')}{/if}{#if focus !== 'mixer'}{@render screen('recording')}{/if}
  </div>
  <div class="scope-key">
    <ul class="legend">
      <li>
        <svg class="swatch" viewBox="0 0 24 12" width="24" height="12" aria-hidden="true">
          <path class="sw-music" d="M2 6H22" />
        </svg>
        {engineer ? copy.SCOPES.legend.tones : copy.SCOPES.legend.music}
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
{/snippet}

<!-- Volume lives on the page-wide sound bar, which appears while anything plays. -->
{#snippet transport(full: boolean)}
  <div class="transport">
    <ListenKey
      {playing}
      onclick={listen}
      label={copy.SOUND.listen}
      stopLabel={copy.SOUND.stop}
      aria-describedby={full ? `${uid}-quiet ${uid}-steady` : `${uid}-quiet`}
    />
    {#if full}
      <Pad pressed={hearClean} onclick={toggleClean} aria-describedby="{uid}-matched">{copy.SOUND.clean}</Pad>
    {/if}
  </div>
  <p class="quiet" id="{uid}-quiet">{soundNote ?? copy.SOUND.quiet}</p>
  {#if full}
    <p class="note">
      <span id="{uid}-steady">{copy.SOUND.steady}</span>
      <span id="{uid}-matched">{copy.SOUND.matched}</span>
    </p>
  {/if}
{/snippet}

<div class="two-ceilings panel" class:compact data-step={step}>
  {#if !compact}
    <ChainStrip mixer={reading.mixer} recorder={waiting ? null : reading.recorder} waiting={waitingText} />
  {/if}

  <div class="task">
    <div class="head">
      <!-- The step in words ("Step 2 of 5"), over its title, like a numbered card in a quick
           reference handbook. -->
      <svelte:element this={`h${headingLevel}`} class="step" tabindex="-1" bind:this={heading}>
        <span class="counter">{copy.stepCounter(step, STEP_COUNT)}</span>
        <span class="title">{copy.STEPS[step].title}</span>
      </svelte:element>
      <p class="body">{copy.STEPS[step].body}</p>
      <noscript><p class="noscript">{copy.NO_SCRIPT}</p></noscript>
      <!-- The prediction asks you to listen, so its Listen key sits right here. -->
      {#if step === 1}
        <div class="sound sound-here">{@render transport(false)}</div>
      {/if}
    </div>

    <div class="live">
      {#if step === 1}
        <Predict
          id={uid}
          {prediction}
          {confidence}
          {nudge}
          onpredict={predict}
          onconfidence={(value) => (confidence = value)}
        />
      {:else if step === SANDBOX}
        <fieldset class="presets">
          <legend class="visually-hidden">{copy.PRESETS_LABEL}</legend>
          {#each PRESETS as p (p.id)}
            <Pad pressed={preset === p.id} tone={p.tone} onclick={() => applyPreset(p.id)}>{p.label}</Pad>
          {/each}
        </fieldset>
        {@render control('channels', false)}
        {@render control('knob', false)}
      {:else}
        {@render control(liveKind, false)}
      {/if}
    </div>

    <!-- What you see. In the sandbox the strip sits beside the controls and both screens run
         across the panel under them, so there the two are separate. -->
    {#if step === SANDBOX}
      <div class="strip-slot">{@render result()}</div>
      <div class="view view-wide">{@render screensAndKey()}</div>
    {:else}
      <div class="view">{@render result()}{@render screensAndKey()}</div>
    {/if}

    <div class="say">
      {#if feedback}
        <div class="goal" bind:this={feedbackBox}>
          <p class="goal-title">{feedback.title}</p>
          {#each feedback.lines as line (line)}
            <p>{line}</p>
          {/each}
          <!-- After the last fix, one question that puts the two ceilings side by side. Its Check is
               the lit key until it's answered; then the way on lights. -->
          {#if step === 4}
            <KnobCheck
              id={uid}
              picks={checkPicks}
              {checked}
              onpick={pickFix}
              oncheck={() => (checked = true)}
            />
          {/if}
          {#if feedback.next}
            <span class="goal-next">
              <HwButton primary={step !== 4 || checked} onclick={next} bind:element={feedbackNext}>
                {feedback.next}
              </HwButton>
            </span>
          {/if}
        </div>
      {:else if step > 1}
        <p class="sentence">{sentence}</p>
      {/if}

      <div class="nav">
        {#if step > 1}
          <HwButton onclick={back}>{copy.NAV.back}</HwButton>
        {/if}
        {#if step < STEP_COUNT}
          <HwButton primary={navLit} onclick={next}>
            {step === 2 && !revealed ? copy.NAV.reveal : copy.NAV.next}
          </HwButton>
          <button type="button" class="text-button" onclick={() => goTo(SANDBOX)}>{copy.NAV.skip}</button>
        {:else}
          <button type="button" class="text-button" onclick={restart}>{copy.NAV.restart}</button>
        {/if}
      </div>
    </div>
  </div>

  {#if step > 1}
    <div class="after">
      {#if step < SANDBOX}
        <div class="locked">{@render control(lockedKind, true)}</div>
        <div class="other">{@render screen(focus === 'mixer' ? 'recording' : 'mixer')}</div>
      {/if}

      <div class="sound">{@render transport(true)}</div>

      <details class="numbers">
        <summary>{copy.DETAILS.summary}</summary>
        <dl>
          <div>
            <dt>{copy.DETAILS.distortion}</dt>
            <dd>
              <strong>{copy.percentText(reading.distortion)}</strong>
              <span class="def">{copy.DETAILS.distortionNote}</span>
            </dd>
          </div>
          <div>
            <dt>{copy.DETAILS.peak}</dt>
            <dd>
              <strong>{copy.dbfsText(reading.recordingPeakDbfs)}, {copy.peakWords(reading.recordingPeakDbfs).toLowerCase()}</strong>
              <span class="def">{copy.DETAILS.peakNote}</span>
            </dd>
          </div>
          <div>
            <dt>{copy.DETAILS.mixer}</dt>
            <dd><strong>{copy.mixerPeakText(reading)}</strong> <span class="def">{copy.DETAILS.mixerNote}</span></dd>
          </div>
        </dl>
        {#if !compact}
          <div class="engineer">
            <Pad pressed={engineer} onclick={() => (engineer = !engineer)}>{copy.DETAILS.engineer}</Pad>
            <p class="note">{copy.DETAILS.engineerNote}</p>
          </div>
        {/if}
      </details>
    </div>
  {/if}

  <p class="model">{copy.MODEL_NOTE.text} <a href={copy.MODEL_NOTE.href}>{copy.MODEL_NOTE.link}</a></p>

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

  /* With no chain strip above it, the step is the top of the panel: no divider. */
  .compact .task {
    padding-top: 0;
    border-top: 0;
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

  /* Its own container: the prediction's pads fit this column, not the whole panel. */
  .live {
    container: lab-live / inline-size;
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

  .presets {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
    min-width: 0;
    margin: 0;
    padding: 0;
    border: 0;
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

  /* Challenge 1, before the knob has moved: the knob is the only thing to do, so an arrow in the
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
  /* Screens and their key                                                                  */

  .screens {
    display: grid;
    gap: 1rem;
    min-width: 0;
  }

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

  .text-button {
    min-height: 2.75rem;
    padding: 0.4rem 0.2rem;
    border: 0;
    background: none;
    color: var(--hw-label);
    font-size: var(--text-sm);
    font-weight: 700;
    text-decoration: underline;
    text-decoration-thickness: 0.08em;
    text-underline-offset: 0.2em;
    cursor: pointer;
  }

  .text-button:hover {
    color: var(--hw-bright);
    text-decoration-thickness: 0.14em;
  }

  .text-button:focus-visible,
  summary:focus-visible {
    outline: 3px solid var(--hw-focus);
    outline-offset: 2px;
  }

  /* -------------------------------------------------------------------------------------- */
  /* After the step: the locked control, the other screen, sound and the numbers            */

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

  /* In the prediction's head: the key and what to expect, close to the words that ask for it. */
  .sound-here {
    margin-top: 0.15rem;
  }

  .transport {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem 0.5rem;
  }

  /* "Starts quietly. No sound? Check your volume": something to act on, so it reads at full size. */
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

  .numbers {
    display: grid;
    gap: 0.75rem;
  }

  summary {
    min-height: 2.75rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    width: fit-content;
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--hw-label);
    cursor: pointer;
    list-style: none;
  }

  summary::-webkit-details-marker {
    display: none;
  }

  summary::before {
    content: '';
    width: 0.45rem;
    height: 0.45rem;
    border-right: 2px solid currentColor;
    border-bottom: 2px solid currentColor;
    rotate: -45deg;
    translate: 0 -0.05rem;
  }

  details[open] summary::before {
    rotate: 45deg;
    translate: 0 -0.2rem;
  }

  .numbers dl {
    display: grid;
    gap: 0.6rem;
    margin: 0;
  }

  .numbers dl > div {
    display: grid;
    gap: 0.1rem;
  }

  .numbers dt {
    font-size: var(--text-xs);
    line-height: 1.3;
    color: var(--hw-label-2);
  }

  .numbers dd {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.45;
    color: var(--hw-label);
  }

  .numbers strong {
    display: block;
    font-size: var(--text-base);
    color: var(--hw-bright);
    font-variant-numeric: tabular-nums;
  }

  .def {
    display: block;
    font-size: var(--text-xs);
    color: var(--hw-label-2);
  }

  .engineer {
    display: grid;
    gap: 0.4rem;
    justify-items: start;
    margin-top: 0.3rem;
  }

  /* The model's caveat, once, pointing to the page's "About the demos". Its rule runs the
     panel's width; its words keep a reading measure. */
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

  @container two-ceilings (min-width: 34rem) {
    /* The sandbox's two screens, side by side. */
    [data-step='5'] .screens {
      grid-template-columns: 1fr 1fr;
    }
  }

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
      grid-template-rows: auto 1fr auto;
      grid-template-areas:
        'locked other'
        'sound other'
        'numbers numbers';
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

    .numbers {
      grid-area: numbers;
    }

    /* The sandbox: controls beside the result and the words, then both screens across. */
    [data-step='5'] .task {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      grid-template-rows: auto auto 1fr auto;
      grid-template-areas:
        'head head'
        'live strip'
        'live say'
        'wide wide';
    }

    [data-step='5'] .strip-slot {
      grid-area: strip;
    }

    [data-step='5'] .view-wide {
      grid-area: wide;
    }

    [data-step='5'] .after {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: auto;
      grid-template-areas:
        'sound'
        'numbers';
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
