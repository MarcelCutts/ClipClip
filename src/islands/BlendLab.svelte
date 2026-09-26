<script lang="ts">
  /**
   * W3 "Blends add up". Two decks, each trimmed to the second orange on its own channel meter.
   * Bring deck 2 in and the MASTER meters climb to the top orange, which the DJ box keeps dark,
   * because two tracks peaking together can add up to 6 dB. The channel meters never move with a
   * fader: they read before it. Fix the blend by pulling a fader down or trimming both decks to
   * the first orange. LOW turns up only, to show what a boost adds (model.ts, LOW).
   *
   * The MASTER meters are the centre of the lab: the biggest thing on the panel, with the two
   * faders either side and the verdict (Mix +9 dB, on the top orange) by them. Each deck's TRIM and LOW
   * sit straight under its fader, deck 1 on the left and deck 2 on the right, so on a phone the
   * meters and every control that moves them share one screen. Before deck 2 comes up the reader
   * can guess where MASTER will peak by tapping it; the prompt sits above the meters, and the
   * guess meets the real peak there. The pads come in two sets: blends that light the top orange,
   * and fixes, which wait until the reader has lit it (each one solves the challenge in one
   * press). A pad tapped on a phone scrolls the meters back into view. On a touch screen the
   * sliders move only by their caps, so scrolling past the lab never changes it.
   *
   * Server-rendered complete: meters lit, verdict and sentence written before hydration.
   *
   * Nothing above a control changes height while it's in use, so a slider never moves under the
   * reader's finger: the status line under the prompt keeps two lines' room (one on a wide panel),
   * the guess line above the meters keeps its two lines whatever it says, the verdict keeps two
   * lines, and the words that change (the hint, the sentence) sit below the controls.
   *
   * One surface: the panel. Its parts are set apart by printed lines and legends, and the only
   * boxes inside it are the meters' well and the waveform's screen.
   */
  import { tick, untrack } from 'svelte';
  import { audio } from '../lib/audio/engine.svelte';
  import { LoopPlayer } from '../lib/audio/loopPlayer';
  import {
    BARELY_OVER_NOTE,
    blendSentence,
    CHALLENGE_PROMPT,
    explainBlend,
    GUESS_LEGEND,
    GUESS_PROMPT,
    guessNote,
    guessReveal,
    guessSpot,
    HINT,
    LISTEN_NOTE,
    MODEL_NOTES,
    MODEL_NOTES_TITLE,
    mixReadout,
    NO_SOUND,
    PLAYER_LABEL,
    PRESET_GROUPS,
    presetLine,
    READOUT_LABEL,
    statusLine,
    verdictLine,
    WAVEFORM_TOGGLE,
    WAYS_OUT_SHOW,
    WAYS_OUT_WAIT,
  } from '../lib/blend/copy';
  import {
    analyseBlend,
    type BlendSettings,
    barelyOver,
    type ChallengeStatus,
    challengeStatus,
    cloneSettings,
    displayDb,
    FADER,
    listenBuffer,
    type Preset,
    type PresetId,
    preset,
    presetsIn,
    START,
    sameSettings,
  } from '../lib/blend/model';
  import { showMeters } from '../lib/blend/scroll';
  import ChannelFader from './blend/ChannelFader.svelte';
  import Knobs from './blend/Knobs.svelte';
  import MeterBridge from './blend/MeterBridge.svelte';
  import Readout from './blend/Readout.svelte';
  import Scope from './blend/Scope.svelte';
  import HwButton from './ui/HwButton.svelte';
  import ListenKey from './ui/ListenKey.svelte';
  import Pad from './ui/Pad.svelte';

  interface Props {
    /** Where the lab starts: deck 2 cued with its fader down (default), or one of the presets. */
    start?: 'incoming' | PresetId;
  }

  let { start = 'incoming' }: Props = $props();

  const uid = $props.id();
  /** Once the reader has lit the top orange, show the hint after this long without a change or a solve. */
  const HINT_AFTER_MS = 20_000;
  /**
   * The live region waits this long after the last change. Longer than the 400 ms the fader's
   * −/+ buttons take to say their value, so the value comes first and the verdict after it.
   */
  const LIVE_DEBOUNCE_MS = 700;

  const initial = untrack(() => (start === 'incoming' ? START : preset(start).settings));
  let settings = $state<BlendSettings>(cloneSettings(initial));

  const analysis = $derived(analyseBlend(settings));
  const segments = $derived(blendSentence(settings, analysis));
  const explanation = $derived(explainBlend(settings, analysis));
  const status = $derived(challengeStatus(settings, analysis));
  const line = $derived(statusLine(status));
  const readout = $derived(mixReadout(analysis));
  const meters = $derived({
    ch1: displayDb(analysis.channel[0]),
    ch2: displayDb(analysis.channel[1]),
    master: displayDb(analysis.mix),
  });
  /** In the red, but only just: it still sounds clean, and the lab says why by Listen. */
  const shaved = $derived(barelyOver(analysis));

  const push = presetsIn('push');
  const out = presetsIn('out');

  // Presets ---------------------------------------------------------------------------------------

  let challengeEl = $state<HTMLElement>();
  let metersEl = $state<HTMLElement>();
  let waysEl = $state<HTMLElement>();
  /** The pad press came from a finger or a mouse, not a key (a key press has no click count). */
  let tapped = false;

  function apply(p: Preset) {
    // A pad sets up a different blend, so a guess about this one no longer applies.
    endGuess();
    settings = cloneSettings(p.settings);
    // A pad jumps the whole mixer in one press, so it always says where it landed, numbers and
    // all, even when the verdict is the same as before (every way out solves the challenge).
    heard = verdict;
    say(presetLine(settings, analysis, status));
    // On a phone the meters are a screen above the pads. A key press leaves the page (and the
    // focus) where it is: the live region has just said what happened.
    if (tapped) {
      const pad = Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || 0;
      showMeters(challengeEl, metersEl, pad);
    }
    tapped = false;
  }

  // The guess ------------------------------------------------------------------------------------
  // Before deck 2 first moves, the reader can tap the MASTER LED where they think the blend will
  // peak. The mark stays by the meter; once deck 2 is all the way up, the line above the meters
  // puts the guess beside the real peak until a fader moves or a pad is pressed. Only from the
  // lab's usual start. The line keeps its two lines' height from the start, even once it's empty,
  // so its words coming and going never move the faders, meters or knobs below it.

  /** The guessed LED's dB mark. */
  let guess = $state<number | null>(null);
  let guessOpen = $state(untrack(() => start === 'incoming'));
  /** The guess beside the real peak, from deck 2 reaching the top until a fader moves. */
  let reveal = $state<string | null>(null);
  /** Where the faders were at the reveal. */
  let revealedOn = '';
  let guessDone = false;
  const faders = (s: BlendSettings) => `${s.deck1.fader},${s.deck2.fader}`;

  function endGuess() {
    guessOpen = false;
    guess = null;
    reveal = null;
    guessDone = true;
  }

  // Deck 2 moving closes the guess: from here on the meters give the answer away.
  $effect(() => {
    if (guessOpen && settings.deck2.fader > FADER.min) guessOpen = false;
  });

  $effect(() => {
    if (guessDone || guess === null || status === 'waiting') return;
    guessDone = true;
    reveal = guessReveal(guess, displayDb(analysis.mix));
    revealedOn = faders(settings);
  });

  $effect(() => {
    if (reveal !== null && faders(settings) !== revealedOn) {
      reveal = null;
      guess = null;
    }
  });

  const guessLine = $derived(
    reveal ?? (guess !== null ? guessNote(guess, guessOpen) : guessOpen ? GUESS_PROMPT : null),
  );
  /** The lab starts with the guess open, so the line above the meters keeps its room throughout. */
  const guessRow = untrack(() => guessOpen);

  // Challenge and hint --------------------------------------------------------------------------

  let solved = $state(false);
  /** The top orange, CLIP or the red seen on the MASTER meters with deck 2 fully up: the hint now makes sense. */
  const failed = (s: ChallengeStatus) => s === 'top' || s === 'clip' || s === 'red';
  let tried = $state(untrack(() => failed(status)));
  let hint = $state(false);
  const showHint = $derived(hint && !solved);
  /** The fixes wait for the first top orange, unless the reader asks for them. */
  let asked = $state(false);
  const waysShown = $derived(tried || asked);

  async function showWays() {
    asked = true;
    // The button goes, so its focus moves to the first way out.
    await tick();
    waysEl?.querySelector('button')?.focus();
  }

  $effect(() => {
    if (status === 'done') solved = true;
    if (failed(status)) tried = true;
  });

  $effect(() => {
    // Any change to the mixer restarts the wait.
    $state.snapshot(settings);
    if (solved || !tried) return;
    const timer = window.setTimeout(() => (hint = true), HINT_AFTER_MS);
    return () => window.clearTimeout(timer);
  });

  // One polite live region. Once the reader pauses it says the verdict in words, and only when the
  // verdict has changed: the sliders already speak their values, so a step that leaves the meters
  // where they were stays quiet. A pad, or the hint appearing, always speaks. Nothing is said on
  // load, and the full sentence with its numbers stays readable on the page.

  const verdict = $derived(verdictLine(analysis, status));
  let spoken = $state('');
  /** The verdict the reader last heard (or saw on load). */
  let heard = untrack(() => verdict);
  let sayTimer: ReturnType<typeof setTimeout> | undefined;

  /** Speak now, even if it's what the region said last: clear it, then set it. */
  function say(text: string) {
    clearTimeout(sayTimer);
    spoken = '';
    sayTimer = setTimeout(() => (spoken = text), 60);
  }

  /** The reveal is said once, ahead of the verdict it arrives with. */
  let revealSaid = false;

  $effect(() => {
    const text = verdict;
    const lead = reveal !== null && !revealSaid ? reveal : null;
    const timer = window.setTimeout(() => {
      if (text === heard && lead === null) return;
      heard = text;
      if (lead !== null) revealSaid = true;
      clearTimeout(sayTimer);
      spoken = lead === null ? text : `${lead} ${text}`;
    }, LIVE_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  });

  $effect(() => {
    if (showHint) say(HINT);
  });

  $effect(() => () => clearTimeout(sayTimer));

  // Sound -------------------------------------------------------------------------------------------

  let playing = $state(false);
  let soundProblem = $state<string | null>(null);
  let lastHeard = '';
  // The label names this demo on the page-wide Stop bar.
  const player = new LoopPlayer(
    `blend-lab-${uid}`,
    () => {
      playing = false;
    },
    PLAYER_LABEL,
  );

  async function listen() {
    if (playing) {
      player.stop();
      return;
    }
    soundProblem = null;
    const snapshot = $state.snapshot(settings);
    lastHeard = JSON.stringify(snapshot);
    playing = true;
    const ok = await player.start((sampleRate) => listenBuffer(snapshot, sampleRate));
    if (!ok) {
      // No sound at all, or another demo took over while this one started.
      playing = false;
      if (audio.unavailable) soundProblem = NO_SOUND;
    }
  }

  $effect(() => {
    const snapshot = $state.snapshot(settings);
    if (!playing) return;
    const key = JSON.stringify(snapshot);
    if (key === lastHeard) return;
    lastHeard = key;
    untrack(() => player.update((sampleRate) => listenBuffer(snapshot, sampleRate)));
  });

  $effect(() => () => player.stop());

  // The waveform --------------------------------------------------------------------------------------

  /** Behind a toggle until the panel is wide enough to show it beside the pads. */
  let waveOpen = $state(false);
</script>

{#snippet pads(list: Preset[])}
  {#each list as p (p.id)}
    <Pad pressed={sameSettings(settings, p.settings)} onclick={() => apply(p)}>{p.label}</Pad>
  {/each}
{/snippet}

<section class="panel blend" aria-label="Blend lab" data-playing={playing}>
  <div class="layout">
    <div class="challenge" bind:this={challengeEl}>
      <p class="prompt">{CHALLENGE_PROMPT}</p>
      <!-- How it's going: the state in bold, then what it means. The live region says the same
           thing in longer words, so this is read in place and never announced. -->
      <p class="status" data-tone={line.tone}>
        <span class="visually-hidden">Status: </span><strong>{line.state}</strong>
        {line.detail}
      </p>
    </div>

    <div class="main">
      <div class="mixer">
        <!-- Above the meters, where the reader looks first. The radios' legend asks the question
             and the live region says the reveal, so this stays out of the accessibility tree. -->
        {#if guessRow}
          <p class="guess-line" data-guessed={guess !== null} data-open={guessOpen} aria-hidden="true">
            {#if guessLine}<span class="mark-key"></span>{guessLine}{/if}
          </p>
        {/if}
        <ChannelFader n={1} bind:value={settings.deck1.fader} {uid} hinted={showHint} />
        <div class="centre" bind:this={metersEl}>
          <MeterBridge
            ch1={meters.ch1}
            master={meters.master}
            ch2={meters.ch2}
            clip={analysis.clip}
            {guess}
            guessing={guessOpen}
            guessName="{uid}-guess"
            guessLegend={GUESS_LEGEND}
            {guessSpot}
            onguess={(db) => (guess = db)}
          />
          <Readout label={READOUT_LABEL} {...readout} />
        </div>
        <ChannelFader n={2} bind:value={settings.deck2.fader} {uid} />
      </div>

      <!-- Each deck's TRIM and LOW under its fader, so the meters stay in view while they turn. -->
      <div class="tray">
        <Knobs n={1} bind:trim={settings.deck1.trim} bind:low={settings.deck1.low} peak={meters.ch1} {uid} />
        <Knobs n={2} bind:trim={settings.deck2.trim} bind:low={settings.deck2.low} peak={meters.ch2} {uid} />
      </div>

      <div class="listen">
        <ListenKey
          {playing}
          onclick={listen}
          aria-describedby={shaved ? `${uid}-listen-note ${uid}-shaved` : `${uid}-listen-note`}
        />
        <p class="listen-note" id="{uid}-listen-note">{soundProblem ?? LISTEN_NOTE}</p>
      </div>
    </div>

    <div class="side">
      <!-- What to try next. The status line above says how it's going. -->
      {#if showHint || shaved}
        <div class="coach">
          <!-- Read out through the live region when it appears. -->
          {#if showHint}<p class="hint" aria-hidden="true">{HINT}</p>{/if}
          <!-- Red on the meters, yet it sounds clean: say why, so the red never passes for fine. -->
          {#if shaved}<p class="shaved" id="{uid}-shaved">{BARELY_OVER_NOTE}</p>{/if}
        </div>
      {/if}

      <!-- A pad pressed with a finger or a mouse has a click count; one pressed with a key has none. -->
      <div class="pads" onclickcapture={(e) => (tapped = e.detail > 0)}>
        <!-- biome-ignore lint/a11y/useSemanticElements: preset buttons, not form fields; role="group" names them without a fieldset's legend -->
        <div class="set" role="group" aria-labelledby="{uid}-push">
          <p class="set-name" id="{uid}-push">{PRESET_GROUPS.push}</p>
          <div class="set-pads">{@render pads(push)}</div>
        </div>
        <!-- biome-ignore lint/a11y/useSemanticElements: preset buttons, not form fields; role="group" names them without a fieldset's legend -->
        <div class="set" role="group" aria-labelledby="{uid}-out">
          <p class="set-name" id="{uid}-out">{PRESET_GROUPS.out}</p>
          {#if waysShown}
            <div class="set-pads" bind:this={waysEl}>{@render pads(out)}</div>
          {:else}
            <div class="wait">
              <p>{WAYS_OUT_WAIT}</p>
              <HwButton onclick={showWays}>{WAYS_OUT_SHOW}</HwButton>
            </div>
          {/if}
        </div>
      </div>

      <!-- The sentence stays readable to screen readers; the live region only says what changed. -->
      <div class="result">
        <p class="sentence">{#each segments as seg, i (i)}{#if seg.kind === 'value'}<strong class="num">{seg.text}</strong>{:else if seg.kind === 'num'}<span class="num">{seg.text}</span>{:else if seg.kind === 'zone'}<strong class="zone">{seg.text}</strong>{:else}{seg.text}{/if}{/each}</p>
        <p class="visually-hidden" role="status">{spoken}</p>
        <p class="explain">{explanation}</p>
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
</section>

<style>
  /* Named, so the mixer can be a container too without stealing these queries. */
  .blend {
    container: blend / inline-size;
  }

  /*
   * Phones first: one column. The meters and faders come straight after the challenge, with each
   * deck's TRIM and LOW under its fader, then Listen, so nothing above a control changes height.
   * What the mixer did follows: the feedback, the pads, the sentence and the waveform.
   */
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 1.1rem;
  }

  .main,
  .side {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-content: start;
    gap: 1.1rem;
    min-width: 0;
  }

  /*
   * Wide: the mixer on the left, the pads and what the mixer does on the right. The pads lead the
   * right-hand column, so words changing under them never move a control under the pointer.
   */
  @container blend (min-width: 50rem) {
    .layout {
      grid-template-columns: minmax(0, 31rem) minmax(0, 1fr);
      column-gap: 2rem;
    }

    .challenge,
    .foot {
      grid-column: 1 / -1;
    }

    .pads {
      order: -1;
    }
  }

  /* Challenge ---------------------------------------------------------------------------------- */

  /* The panel's title strip, over a printed line: the task, then how it's going. */
  .challenge {
    display: grid;
    gap: 0.4rem;
    padding-bottom: 1rem;
    border-bottom: 1px solid var(--hw-edge);
  }

  .prompt {
    margin: 0;
    font-size: var(--text-base);
    font-weight: 700;
    line-height: 1.4;
    color: var(--hw-bright);
    text-wrap: pretty;
  }

  /* Two lines' room whatever it says (statusLine keeps to two on the narrowest phone), so the
     words changing never move the faders under it. The state leads in bold. */
  .status {
    min-height: calc(2 * 1.45em);
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.45;
    color: var(--hw-label);
  }

  .status strong {
    font-weight: 700;
    color: var(--hw-bright);
  }

  .status[data-tone='todo'] strong {
    color: var(--hw-label);
  }

  /* Wide panels fit every line on one. */
  @container blend (min-width: 36rem) {
    .status {
      min-height: 1.45em;
    }
  }

  /* Mixer: faders either side of the meters -------------------------------------------------- */

  /* Each fader runs about the height of the meters beside it. */
  .mixer {
    container: mixer / inline-size;
    display: grid;
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
      grid-template-columns: 5.5rem auto 5.5rem;
      justify-content: center;
      column-gap: 1.25rem;
      --fader-length: 15.5rem;
    }
  }

  /* The verdict sits right under the meters on a phone, and over them once there's room. */
  .centre {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 0.75rem;
    min-width: 0;
  }

  @container mixer (min-width: 28rem) {
    .centre :global(.readout) {
      order: -1;
    }
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

  /* Listen, next to the mixer ------------------------------------------------------------------ */

  .listen {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.5rem 0.9rem;
  }

  .listen-note {
    flex: 1 1 12rem;
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.45;
    color: var(--hw-label);
  }

  /* TRIM and LOW: one column per deck, under that deck's fader, at every width -------------- */

  .tray {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1.25rem 1rem;
  }

  @container blend (min-width: 28rem) {
    .tray {
      column-gap: 1.5rem;
    }
  }

  /* Feedback --------------------------------------------------------------------------------- */

  .coach {
    display: grid;
    gap: 0.6rem;
  }

  /* The hint is what to do next, so it's printed in the action colour. */
  .hint {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: 700;
    line-height: 1.45;
    color: var(--hw-action);
  }

  .shaved {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.5;
    color: var(--hw-label);
    text-wrap: pretty;
  }

  /* Presets: two labelled sets --------------------------------------------------------------- */

  .pads {
    display: grid;
    gap: 1rem;
  }

  .set {
    display: grid;
    gap: 0.5rem;
  }

  .set-name {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: 700;
    line-height: 1.3;
    color: var(--hw-bright);
  }

  .set-pads {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 9rem), 1fr));
    gap: 0.5rem;
  }

  .set-pads :global(.pad) {
    width: 100%;
  }

  /* The note and its key share a row, like a pad row, so the set keeps about one pad's height.
     The key opens the set; it isn't a preset, so it's a plain key rather than a pad. */
  .wait {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .wait p {
    flex: 1 1 0;
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.4;
    color: var(--hw-label);
  }

  .wait :global(.key) {
    flex: none;
  }

  /* Result ------------------------------------------------------------------------------------- */

  .result {
    display: grid;
    align-content: start;
    gap: 0.4rem;
  }

  /* What the meters say, in words: the numbers and the colour in bold, the rest regular. */
  .sentence {
    margin: 0;
    font-size: var(--text-rule);
    line-height: 1.45;
    color: var(--hw-label);
    text-wrap: pretty;
  }

  .num {
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }

  strong.num,
  .zone {
    font-weight: 700;
    color: var(--hw-bright);
  }

  .zone {
    white-space: nowrap;
  }

  /* What to try next: an instruction, so never in the dimmer grey. */
  .explain {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.5;
    color: var(--hw-label);
  }

  /* The waveform: behind a toggle on phones, smaller and last, beside the pads on wide panels. */
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
