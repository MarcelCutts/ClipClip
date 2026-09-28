<script lang="ts">
  /**
   * W2 · Two ceilings: the two places the sound can clip between the mixer and the recorder, which
   * control fixes each, and which light shows each.
   *
   * The panel is laid out in the order the sound travels: the mixer, the Howler, the file. Each of
   * the first two is a stage with the same three things in the same order: the control that comes
   * before its ceiling, the light that watches its ceiling, and a screen of the wave at that
   * point. So a reading always sits with the thing it measures, and the lab's hardest fact can be
   * seen: the Howler's light sits in the Howler's stage and goes by the Howler's ceiling alone.
   *
   * Four steps. The first asks what colour the Howler's light is, with the channel in the red and
   * the recording level turned down, and only then shows it: green, over a crunchy file. Asked
   * first, it is the lesson. Shown unasked, it read as a fault (the owner, 28 September 2026). The
   * second asks whether the recording level can remove the crunch, then hands it over to try (it
   * cannot). Then the channel (it can), and the recording level with the Howler's input overloaded
   * (it can, and its light shows it). Each question takes the place of what would answer it.
   *
   * One control is live a step. The other shows as a reading: a control drawn and dead reads as a
   * fault. What a step means is said inside the stage it is about, under the screen that shows it.
   *
   * One surface: the panel. Its stages are divided by printed lines, the control to move has its
   * name printed in the action colour, and the only boxes inside are the screens and the CH1 meter.
   *
   * Everything on screen comes from src/lib/lab/ceilings.ts, so the server render is complete:
   * step 1, with the channel in the red and its question. The page provides the heading and anchor
   * around the island.
   */
  import { onMount, tick } from 'svelte';
  import { audio } from '../lib/audio/engine.svelte';
  import { LoopPlayer } from '../lib/audio/loopPlayer';
  import { formatDb, speakDb } from '../lib/dsp/db';
  import {
    CEILING_2,
    CHANNELS,
    CONTROL_STAGE,
    type Control,
    drawScope,
    type Expect,
    type Guess,
    goalMet,
    KNOB,
    labSignal,
    MOVE_SETTLE_MS,
    playbackLoop,
    REVEAL_AFTER_MOVES,
    REVEAL_AFTER_MS,
    readLab,
    STEP_COUNT,
    STEP_SETUP,
    type StageId,
    type Step,
    scopeTraces,
  } from '../lib/lab/ceilings';
  import * as copy from '../lib/lab/copy';
  import { describeLevel } from '../lib/xdj';
  import ChannelLights from './two-ceilings/ChannelLights.svelte';
  import CrunchGlyph from './two-ceilings/CrunchGlyph.svelte';
  import HowlerLight from './two-ceilings/HowlerLight.svelte';
  import LabScope from './two-ceilings/LabScope.svelte';
  import StageHead from './two-ceilings/StageHead.svelte';
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
  /** The stages' names sit one level under the step's title. */
  const stageLevel = $derived((headingLevel + 1) as 4 | 5 | 6);

  /* ---------------------------------------------------------------------------------------- */
  /* State                                                                                    */

  /** The island has woken up: until then its keys cannot answer, and say so by being disabled. */
  let ready = $state(false);
  onMount(() => {
    ready = true;
  });

  let step = $state<Step>(1);
  let channels = $state(STEP_SETUP[1].start.channels);
  let knob = $state(STEP_SETUP[1].start.knob);
  /** Step 1's question has been answered, or passed. Latches: going back shows the light. */
  let answered = $state(false);
  /** What the reader said the light would show. Null if they asked for the answer. */
  let guess = $state<Guess | null>(null);
  /** Step 2's question has been answered, or passed. Latches, as step 1's does. */
  let expectAnswered = $state(false);
  /** What the reader said the recording level could do. Null if they asked for the answer. */
  let expected = $state<Expect | null>(null);
  /** Step 2 has played out. Latches: going back doesn't hide its result again. */
  let revealed = $state(false);
  /** The step's live control has moved since the step opened. In step 2 its clock is then running. */
  let moved = $state(false);
  let knobMoves = 0;
  /** Where the knob last came to rest in step 2, and how far the last try moved it from there. */
  let restedAt = STEP_SETUP[2].start.knob;
  let lastMove = $state<number | null>(null);
  let hearClean = $state(false);
  let soundNote = $state<string | null>(null);
  let heading: HTMLElement | undefined = $state();
  /** The feedback box, and the key in it that moves on. */
  let feedbackBox: HTMLElement | undefined = $state();
  let feedbackNext: HTMLButtonElement | undefined = $state();

  /** The one control the step lets you move. Step 1 asks its question with both as readings. */
  const liveKind = $derived(STEP_SETUP[step].live);
  /** The stage the step is about: where its control is, or where its question is. */
  const focus = $derived<StageId>(liveKind ? CONTROL_STAGE[liveKind] : 'howler');
  /** Step 1, before its answer: the question takes the light's place, and the Howler's screen waits. */
  const asking = $derived(step === 1 && !answered);
  /** Step 2, before its answer: the question sits with the recording level, which waits. */
  const askingKnob = $derived(step === 2 && !expectAnswered);
  const reading = $derived(readLab(signal, channels, knob));
  const traces = $derived(scopeTraces(signal, channels, knob));
  const mixerDrawing = $derived(drawScope(traces.mixer));
  const howlerDrawing = $derived(drawScope(traces.recording));
  const claims = $derived(copy.scopeClaims(reading));
  /** In step 2, what to do, then what the last try did. Otherwise, where the sound clipped. */
  const sentence = $derived.by(() => {
    if (step !== 2) return copy.stateSentence(reading);
    return lastMove === null ? copy.TRY : copy.moveSentence(lastMove, reading);
  });
  const feedback = $derived.by(() => {
    if (step === 1) return answered ? copy.answerFeedback(guess, reading) : null;
    if (step === 2) return revealed ? copy.revealFeedback(expected) : null;
    return goalMet(step, reading) ? copy.successFeedback(step, reading) : null;
  });
  /**
   * One lit key per step, only when pressing it is the thing to do: the answer, once the recording
   * level has been tried. Otherwise the question or the live control is the action, and when the
   * feedback box offers its own Next, that one is lit.
   */
  const navLit = $derived(step === 2 && expectAnswered && !revealed && moved);
  /** Step 2 always ends in its answer, as step 1 does: until then the way on shows it. */
  const skipping = $derived((step === 1 && !answered) || (step === 2 && !revealed));

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

  /** A new step's head goes to the top of the screen, so its stages follow it. */
  function showHead() {
    if (!heading) return;
    heading.focus({ preventScroll: true });
    scrollToShow(heading, 'settle');
  }

  /**
   * A result has just been asked for. The live region reads it out, so focus goes to the result's
   * own Next rather than its text, which would then be read twice.
   */
  async function showResult() {
    await tick();
    if (feedbackBox) scrollToShow(feedbackBox, 'nearest');
    feedbackNext?.focus({ preventScroll: true });
  }

  async function goTo(next: Step) {
    step = next;
    channels = STEP_SETUP[next].start.channels;
    knob = STEP_SETUP[next].start.knob;
    moved = false;
    if (next === 2) {
      knobMoves = 0;
      restedAt = STEP_SETUP[2].start.knob;
      lastMove = null;
    }
    await tick();
    showHead();
  }

  /** Step 1: the reader says what colour the light is, or asks to be shown. Either way, it is shown. */
  function answerLight(said: Guess | null) {
    guess = said;
    answered = true;
    void showResult();
  }

  /**
   * Step 2: the reader says whether the recording level can remove the crunch, and it is theirs to
   * try: focus goes to it, since the question that had focus has gone. Asked to be shown, the
   * answer comes at once.
   */
  async function answerKnob(said: Expect | null) {
    expected = said;
    expectAnswered = true;
    if (said === null) {
      revealed = true;
      void showResult();
      return;
    }
    await tick();
    const slider = document.getElementById(`${uid}-knob`);
    const box = slider?.closest<HTMLElement>('.control');
    if (box) scrollToShow(box, 'nearest');
    slider?.focus({ preventScroll: true });
  }

  function next() {
    if (step === 1 && !answered) return answerLight(null);
    if (step === 2 && !expectAnswered) return void answerKnob(null);
    if (step === 2 && !revealed) {
      revealed = true;
      void showResult();
      return;
    }
    if (step < STEP_COUNT) void goTo((step + 1) as Step);
  }

  function back() {
    if (step > 1) void goTo((step - 1) as Step);
  }

  /**
   * Step 2 ends after a few knob moves, or a little while after the first one, whichever comes
   * first. A move is one try: a drag, or a run of key presses or − / + taps, counted once the knob
   * settles. Nothing runs until the knob moves, so reading the step takes as long as it takes.
   */
  let settling: number | undefined;

  function knobMoving() {
    moved = true;
    if (step !== 2) return;
    window.clearTimeout(settling);
    settling = window.setTimeout(() => {
      if (step !== 2) return;
      // A try that ends where it began did nothing, and says nothing.
      if (knob !== restedAt) {
        lastMove = knob - restedAt;
        restedAt = knob;
      }
      if (revealed) return;
      knobMoves += 1;
      if (knobMoves >= REVEAL_AFTER_MOVES) revealed = true;
    }, MOVE_SETTLE_MS);
  }

  $effect(() => {
    if (step !== 2 || revealed || !moved) return;
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

  const liveText = $derived.by(() => {
    if (feedback) return `${feedback.title}. ${feedback.lines.join(' ')}`;
    if (asking) return copy.QUESTIONS.light.legend;
    if (askingKnob) return copy.QUESTIONS.knob.legend;
    return sentence;
  });
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

  /** Each question's answers. The light's show the light as it would be: round, and lit in its colour. */
  const LIGHT_CHOICES = (['green', 'red'] as const).map((c) => ({
    value: c,
    label: copy.QUESTIONS.light.choices[c],
    lamp: c,
  }));
  const KNOB_CHOICES = (['yes', 'no'] as const).map((v) => ({ value: v, label: copy.QUESTIONS.knob.choices[v] }));
</script>

<!--
  One control, in the stage it belongs to. The live one is a fader, with its name printed in the
  action colour and its hint under it. Any other shows as a reading: its name and where it is set.
-->
{#snippet control(kind: Control)}
  {@const id = `${uid}-${kind}`}
  {#if kind === liveKind && !(kind === 'knob' && askingKnob)}
    <div class="control lit" class:cue={!moved}>
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
          hint={copy.CONTROLS.channels.hint}
          oninput={() => (moved = true)}
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
          hint={copy.CONTROLS.knob.hint}
          oninput={knobMoving}
        />
      {/if}
    </div>
  {:else}
    <div class="control">
      <p class="reading">
        <span class="reading-name">{copy.CONTROLS[kind].label}</span>
        <span class="reading-value">{kind === 'channels' ? formatDb(channels) : copy.knobText(knob)}</span>
      </p>
      {#if kind === 'knob' && askingKnob}
        {@render ask(copy.QUESTIONS.knob.legend, KNOB_CHOICES, (v) => void answerKnob(v as Expect))}
      {/if}
    </div>
  {/if}
{/snippet}

<!-- A question for the reader, in place of what would answer it. -->
{#snippet ask(
  legend: string,
  choices: ReadonlyArray<{ value: string; label: string; lamp?: 'green' | 'red' }>,
  pick: (value: string) => void,
)}
  <fieldset class="question">
    <legend>{legend}</legend>
    <div class="choices">
      {#each choices as choice (choice.value)}
        <button type="button" class="choice" disabled={!ready} onclick={() => pick(choice.value)}>
          {#if choice.lamp}<span class="lamp" data-light={choice.lamp} aria-hidden="true"></span>{/if}
          {choice.label}
        </button>
      {/each}
    </div>
  </fieldset>
{/snippet}

<!-- What the step means, and the way on: inside the stage the step is about, under its screen. -->
{#snippet say()}
  <div class="say">
    <!-- In step 2 each try is answered at once, and the step's result follows it. -->
    {#if !asking && !askingKnob && (!feedback || (step === 2 && lastMove !== null))}
      <p class="sentence">{sentence}</p>
    {/if}
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
        {:else if step === STEP_COUNT}
          <div class="summary">
            <p class="summary-title">{copy.SUMMARY.title}</p>
            {#each copy.SUMMARY.lines as line (line)}
              <p>{line}</p>
            {/each}
          </div>
        {/if}
      </div>
    {/if}

    <div class="nav">
      {#if step > 1}
        <HwButton onclick={back}>{copy.NAV.back}</HwButton>
      {/if}
      {#if step < STEP_COUNT && !feedback?.next}
        <HwButton primary={navLit} onclick={next}>{skipping ? copy.QUESTIONS.skip : copy.NAV.next}</HwButton>
      {/if}
    </div>
  </div>
{/snippet}

<!-- Volume lives on the page-wide sound bar, which appears while anything plays. -->
{#snippet transport()}
  <div class="sound">
    <div class="transport">
      <ListenKey
        {playing}
        onclick={listen}
        label={copy.SOUND.listen}
        stopLabel={copy.SOUND.stop}
        aria-describedby="{uid}-quiet"
      />
      <Pad pressed={hearClean} onclick={toggleClean}>{copy.SOUND.clean}</Pad>
    </div>
    <p class="quiet" id="{uid}-quiet">{soundNote ?? copy.SOUND.quiet}</p>
    <!-- What you are hearing, while you hear it. -->
    {#if playing}<p class="note">{hearClean ? copy.SOUND.matched : copy.SOUND.steady}</p>{/if}
  </div>
{/snippet}

<div class="two-ceilings panel">
  <div class="head">
    <!-- The step in words ("Step 2 of 4"), over its title, like a numbered card in a quick
         reference handbook. -->
    <svelte:element this={`h${headingLevel}`} class="step" tabindex="-1" bind:this={heading}>
      <span class="counter">{copy.stepCounter(step, STEP_COUNT)}</span>
      <span class="title">{copy.STEPS[step].title}</span>
    </svelte:element>
    <p class="body">{copy.STEPS[step].body}</p>
    <noscript><p class="noscript">{copy.NO_SCRIPT}</p></noscript>
  </div>

  <!-- The chain, in the order the sound travels. Each stage with a ceiling holds the same things in
       the same order: its control, its light, its screen. -->
  <ol class="stages" aria-label={copy.STAGES.label}>
    <li class="stage" data-stage="mixer" class:focus={focus === 'mixer'}>
      <StageHead no={1} name={copy.STAGES.mixer.name} level={stageLevel} />
      {@render control('channels')}
      <div class="light"><ChannelLights {channels} /></div>
      <LabScope
        title={copy.SCOPES.mixer}
        ceilingLabel={copy.STAGES.mixer.ceiling}
        claim={claims.mixer}
        drawing={mixerDrawing}
      />
      {#if focus === 'mixer'}{@render say()}{/if}
    </li>

    <li class="stage" data-stage="howler" class:focus={focus === 'howler'}>
      <StageHead no={2} name={copy.STAGES.howler.name} level={stageLevel} />
      {@render control('knob')}
      <div class="light">
        <!-- Until the question is answered, it takes the place of the light it asks about. -->
        {#if asking}
          {@render ask(copy.QUESTIONS.light.legend, LIGHT_CHOICES, (v) => answerLight(v as Guess))}
        {:else}
          <div class="level">
            <p class="level-name">{copy.READOUTS.howler}</p>
            <HowlerLight
              light={reading.howler}
              state={copy.HOWLER_WORDS[reading.howler].state}
              meaning={copy.howlerMeaning(reading)}
            />
            <!-- What it leaves out, said while it is leaving something out. -->
            {#if reading.mixer === 'over'}<p class="level-note">{copy.LIGHT_NOTE}</p>{/if}
          </div>
        {/if}
      </div>
      <!-- Same scale as the mixer's screen: the Howler's ceiling sits lower, where the model puts it. -->
      <LabScope
        title={copy.SCOPES.howler}
        ceilingLabel={copy.STAGES.howler.ceiling}
        ceiling={CEILING_2}
        claim={claims.howler}
        drawing={howlerDrawing}
        before={mixerDrawing.trace}
        beforeLabel={copy.SCOPES.before}
        covered={asking ? copy.QUESTIONS.covered : undefined}
      />
      {#if focus === 'howler'}{@render say()}{/if}
    </li>

    <li class="stage" data-stage="file">
      <StageHead no={3} name={copy.STAGES.file.name} level={stageLevel} />
      <div class="crunch">
        <p class="level-name">{copy.READOUTS.crunch}</p>
        <p class="value" data-crunch={reading.crunch}>
          <CrunchGlyph crunch={reading.crunch} />
          <span>{copy.CRUNCH_WORDS[reading.crunch]}</span>
        </p>
        <!-- Where it was made: the light and the crunch are measured in different places. -->
        <p class="origin">{copy.fileOrigin(reading)}</p>
        <p class="level-note">{copy.STAGES.file.note}</p>
      </div>
      {@render transport()}
    </li>
  </ol>

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
          <path class="sw-flat" d="M5 6H19" />
        </svg>
        {copy.SCOPES.legend.flat}
      </li>
      <li>
        <svg class="swatch" viewBox="0 0 24 12" width="24" height="12" aria-hidden="true">
          <path class="sw-wash" d="M3 11C6 1 18 1 21 11Z" />
          <path class="sw-ghost" d="M3 11C6 1 18 1 21 11" />
        </svg>
        {copy.SCOPES.legend.cut}
      </li>
    </ul>
    <p class="zoom">{copy.SCOPES.zoom}. {copy.SCOPES.scale}</p>
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

  /* -------------------------------------------------------------------------------------- */
  /* The step's head                                                                         */

  .head {
    display: grid;
    gap: 0.6rem;
    justify-items: start;
    align-content: start;
    min-width: 0;
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
    max-width: 40rem;
    margin: 0;
    font-weight: 700;
    line-height: 1.5;
    color: var(--hw-bright);
  }

  /* -------------------------------------------------------------------------------------- */
  /* The stages, in the order the sound travels                                              */

  .stages {
    display: grid;
    gap: clamp(1.25rem, 1rem + 1vw, 1.75rem);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  /* Rows of the panel are divided like sections of a mixer's top plate. */
  .stage {
    display: grid;
    gap: 0.9rem;
    align-content: start;
    min-width: 0;
    padding-top: clamp(1rem, 0.85rem + 0.8vw, 1.4rem);
    border-top: 1px solid var(--hw-edge);
  }

  /* The stage the step is about: a heavier line over it, as a card's title strip is. */
  .stage.focus {
    border-top: 2px solid var(--hw-label);
  }

  .light {
    display: grid;
    align-content: start;
    min-width: 0;
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

  /* Step 2, before the knob has moved: the knob is the only thing to do, so an arrow in the
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

  /* A control this step leaves alone: its name and setting, as the fader's own head prints them. */
  .reading {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.75rem;
    margin: 0;
  }

  .reading-name {
    font-size: var(--text-sm);
    font-weight: 700;
    line-height: 1.25;
    color: var(--hw-label);
  }

  .reading-value {
    font-size: 1.05rem;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    color: var(--hw-bright);
  }

  /* -------------------------------------------------------------------------------------- */
  /* The question, and the readouts                                                          */

  .question {
    display: grid;
    gap: 0.6rem;
    min-width: 0;
    margin: 0.4rem 0 0;
    padding: 0;
    border: 0;
  }

  .light > .question {
    margin-top: 0;
  }

  .question legend {
    padding: 0;
    font-family: var(--font-display);
    font-size: var(--text-rule);
    font-weight: 700;
    line-height: 1.3;
    color: var(--hw-action);
  }

  .choices {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  /* A square key, as the panel's pads are, with the light it stands for beside its word. */
  .choice {
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    min-width: 7.5rem;
    min-height: 2.75rem;
    padding: 0.55rem 1rem;
    border: 1px solid var(--pad-edge);
    border-radius: var(--radius-control);
    background: var(--pad-top);
    color: var(--hw-bright);
    font-size: var(--text-base);
    font-weight: 700;
    cursor: pointer;
  }

  .choice:hover:not(:disabled) {
    background: var(--pad-hover-top);
  }

  .choice:disabled {
    cursor: default;
  }

  .choice:focus-visible {
    outline: 3px solid var(--hw-focus);
    outline-offset: 2px;
  }

  /* Round, like the light on the recorder itself. */
  .lamp {
    flex: none;
    width: 0.8rem;
    height: 0.8rem;
    border-radius: 50%;
  }

  .lamp[data-light='green'] {
    background: var(--led-g);
    box-shadow: 0 0 0.5rem var(--led-g);
  }

  .lamp[data-light='red'] {
    background: var(--led-r);
    box-shadow: 0 0 0.5rem var(--led-r);
  }

  .level,
  .crunch {
    display: grid;
    gap: 0.3rem;
    align-content: start;
    min-width: 0;
  }

  .level-name {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.25;
    color: var(--hw-label);
  }

  .level-note {
    max-width: 32rem;
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.45;
    color: var(--hw-label);
  }

  /* Where the crunch was made, and how much was cut: the reading's own words, at full brightness. */
  .origin {
    max-width: 32rem;
    margin: 0;
    font-size: var(--text-sm);
    font-weight: 700;
    line-height: 1.45;
    color: var(--hw-bright);
  }

  .level :global(.howler),
  .value {
    font-size: var(--text-base);
  }

  .value {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.3rem 0.45rem;
    margin: 0;
    font-weight: 700;
    line-height: 1.25;
    color: var(--hw-bright);
  }

  .value :global(svg) {
    width: 1.9rem;
    height: auto;
  }

  /* -------------------------------------------------------------------------------------- */
  /* The key to the screens                                                                 */

  .scope-key {
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    gap: 0.35rem 1.25rem;
    padding-top: clamp(1rem, 0.85rem + 0.8vw, 1.4rem);
    border-top: 1px solid var(--hw-edge);
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

  .say {
    display: grid;
    gap: 0.9rem;
    align-content: start;
    min-width: 0;
  }

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

  .goal .goal-title,
  .summary .summary-title {
    font-family: var(--font-display);
    font-size: var(--text-h3);
    font-weight: 700;
    line-height: 1.2;
    color: var(--hw-bright);
  }

  .goal-next {
    margin-top: 0.35rem;
  }

  /* After the last step: the two ceilings, a sentence each. */
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

  /* -------------------------------------------------------------------------------------- */
  /* Sound                                                                                   */

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
    padding-top: clamp(1rem, 0.85rem + 0.8vw, 1.4rem);
    padding-right: max(0px, 100% - 44rem);
    border-top: 1px solid var(--hw-edge);
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
   * A laptop: the mixer and the Howler side by side, left to right as the sound goes. Their rows
   * line up (a subgrid), so control sits beside control, light beside light and screen beside
   * screen, and the two waves can be compared at a glance. Each screen's caption, glass and line
   * are rows of their own, so a caption that wraps moves both screens alike. The file runs under
   * both.
   */
  @container two-ceilings (min-width: 46rem) {
    .stages {
      grid-template-columns: repeat(2, minmax(0, 1fr));
      grid-template-rows: repeat(7, auto);
      column-gap: clamp(1.5rem, 1rem + 1.5vw, 2.5rem);
      row-gap: 0;
    }

    .stage[data-stage='mixer'],
    .stage[data-stage='howler'] {
      grid-row: 1 / span 7;
      grid-template-rows: subgrid;
      row-gap: 0.9rem;
    }

    .stage > :global(.scope) {
      grid-row: span 3;
      grid-template-rows: subgrid;
      row-gap: 0.4rem;
    }

    .stage[data-stage='file'] {
      grid-column: 1 / -1;
      grid-template-columns: minmax(0, 1fr) minmax(0, 2fr);
      column-gap: clamp(1.5rem, 1rem + 1.5vw, 2.5rem);
      margin-top: clamp(1.25rem, 1rem + 1vw, 1.75rem);
    }

    .stage[data-stage='file'] :global(.stage-head) {
      grid-column: 1 / -1;
    }
  }

  @media (forced-colors: active) {
    /* Backgrounds are dropped here, so the arrow keeps its shape in the text colour. */
    .control.cue :global(.plain-label)::before {
      forced-color-adjust: none;
      background: CanvasText;
    }

    .stage.focus {
      border-top-color: CanvasText;
    }

    .choice {
      border-color: ButtonText;
    }

    .lamp[data-light] {
      forced-color-adjust: none;
      background: CanvasText;
      box-shadow: none;
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
