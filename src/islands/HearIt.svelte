<script lang="ts">
  /**
   * W5 "Can you hear it?": a blind listening test. Three rounds of the same loop, clean against
   * clipped (pushed 12, 6, then 3 dB past the mixer's ceiling), with the clipped copy turned
   * down to the same loudness so volume can't give it away. Pick the clipped one, say how sure
   * you are, then see both waveforms. A device switch changes the explanation, never the sound.
   *
   * One surface: the panel, divided by printed lines. The only boxes in it are the two screens.
   * What you listen on is a slide switch (a setting); the answers are pads.
   *
   * Usage: <HearIt client:visible />
   */
  import { onMount, tick } from 'svelte';
  import { audio } from '../lib/audio/engine.svelte';
  import { LoopPlayer } from '../lib/audio/loopPlayer';
  import * as copy from '../lib/hear/copy';
  import {
    type Answer,
    assignRounds,
    bufferFor,
    CONFIDENCES,
    type Confidence,
    DEVICES,
    type Device,
    EMPTY_ANSWER,
    FIXED_ROUNDS,
    isSpotted,
    REVEAL_SCOPE,
    ROUND_COUNT,
    type Round,
    revealView,
    SIDES,
    type Side,
    summarise,
    versionsFor,
  } from '../lib/hear/model';
  import Choice from './hear-it/Choice.svelte';
  import Scope from './hear-it/Scope.svelte';
  import HwButton from './ui/HwButton.svelte';
  import ListenKey from './ui/ListenKey.svelte';
  import Pad from './ui/Pad.svelte';

  interface Props {
    /** Prefix for element ids and the audio owner. Change it if a page shows this widget twice. */
    id?: string;
    /** Heading level for the round title, to fit the page outline: one under the page's own. */
    headingLevel?: 2 | 3 | 4 | 5;
  }

  let { id = 'hear-it', headingLevel = 4 }: Props = $props();

  const freshAnswers = (): Answer[] => Array.from({ length: ROUND_COUNT }, () => ({ ...EMPTY_ANSWER }));

  let rounds = $state<Round[]>(FIXED_ROUNDS.map((r) => ({ ...r })));
  let answers = $state<Answer[]>(freshAnswers());
  let revealed = $state<boolean[]>(Array.from({ length: ROUND_COUNT }, () => false));
  /** The round on screen; ROUND_COUNT once the result shows. */
  let current = $state(0);
  let device = $state<Device>('phone');
  let unmatched = $state(false);
  let playing = $state<Side | null>(null);
  /** The headphone volume warning shows until the first play on headphones. */
  let warned = $state(false);
  let problem = $state<string | null>(null);
  let message = $state('');
  /** The one polite live region, for the nudges. The verdict is read out by moving focus to it. */
  let live = $state('');

  let root = $state<HTMLElement>();
  let title = $state<HTMLElement>();
  let screens = $state<HTMLElement>();
  let verdict = $state<HTMLElement>();
  let unmatchedBox = $state<HTMLElement>();

  const done = $derived(current >= ROUND_COUNT);
  const index = $derived(Math.min(current, ROUND_COUNT - 1));
  const round = $derived(rounds[index]!);
  const answer = $derived(answers[index]!);
  const isRevealed = $derived(!done && revealed[index] === true);
  const summary = $derived(summarise(rounds, answers));
  const hyper = $derived(copy.hypercorrectionLine(summary));
  const showWarning = $derived(device === 'headphones' && !warned && !done);
  /** What the Play keys say beyond their name: the volume note, and the headphone warning first. */
  const playHelp = $derived(showWarning ? `${id}-warn ${id}-note` : `${id}-note`);

  /** The rate the reveal is drawn at: the device's, if sound has played, so the buffers are shared. */
  const drawRate = (): number => audio.context?.sampleRate ?? 48_000;
  const view = $derived(isRevealed ? revealView(versionsFor(drawRate()), index, unmatched) : null);
  const matchDb = $derived(isRevealed ? (versionsFor(drawRate()).matchDb[index] ?? 0) : 0);

  const pickOptions = SIDES.map((side) => ({ value: side, label: copy.letter(side) }));
  const sureOptions = CONFIDENCES.map((c) => ({ value: c, label: copy.CONFIDENCE_LABELS[c] }));
  const deviceOptions = DEVICES.map((d) => ({ value: d, label: copy.DEVICE_LABELS[d] }));

  /* Sound ------------------------------------------------------------------------------------ */

  let player: LoopPlayer | null = null;
  let starting = false;

  /** Whatever should be sounding right now. Called by the player at start and on every change. */
  function render(sampleRate: number): Float32Array {
    return bufferFor(versionsFor(sampleRate), index, round, playing ?? 'a', unmatched && isRevealed);
  }

  /** A Play key: start that side, switch to it, or stop it if it is already the one playing. */
  function play(side: Side): void {
    if (playing === side) stop();
    else void listen(side);
  }

  /** Make `side` the one sounding: start playback, or crossfade to it in time with the beat. */
  async function listen(side: Side): Promise<void> {
    problem = null;
    playing = side;
    if (device === 'headphones') warned = true;
    // The Stop bar only ever says "Listening test": naming A or B there could give the answer away.
    player ??= new LoopPlayer(id, () => (playing = null), copy.PLAYER_LABEL);
    if (player.playing) {
      player.update(render);
      return;
    }
    // A start already in flight renders whichever side is chosen by the time it lands.
    if (starting) return;
    starting = true;
    const started = await player.start(render);
    starting = false;
    if (!started) {
      // No sound at all, or another demo took over while we started.
      playing = null;
      if (audio.unavailable) problem = copy.NO_AUDIO;
      return;
    }
    if (playing === null) player.stop();
  }

  function stop(): void {
    playing = null;
    // Stopping mid-start is picked up when the start lands (see listen).
    if (!starting) player?.stop();
  }

  /** The toggle is there to be heard: switching it on plays the clipped one at the mixer's level. */
  async function toggleUnmatched(): Promise<void> {
    unmatched = !unmatched;
    if (unmatched) await listen(round.clipped);
    else if (player?.playing && playing === round.clipped) player.update(render);
    keepClearOfBar(unmatchedBox);
  }

  /**
   * The toggle sits at the foot of the reveal, and starting sound opens the page-wide Stop bar
   * over the bottom of the screen: right where its note just changed. The bar reserves its space
   * by setting the page's scroll-padding-bottom, in a step or two as it measures itself. Once
   * that has held steady for a couple of frames, scroll the toggle and its note clear of the bar.
   */
  function keepClearOfBar(el: HTMLElement | undefined): void {
    if (!el) return;
    let last = '';
    let steady = 0;
    let frames = 0;
    const step = () => {
      const reserved = getComputedStyle(document.documentElement).scrollPaddingBottom;
      steady = reserved === last ? steady + 1 : 0;
      last = reserved;
      if ((steady >= 2 && reserved !== 'auto') || ++frames > 30) el.scrollIntoView({ block: 'nearest' });
      else requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* Rounds ----------------------------------------------------------------------------------- */

  function focusGroup(name: string): void {
    root?.querySelector<HTMLInputElement>(`input[name="${name}"]`)?.focus();
  }

  function setPick(side: Side): void {
    answers[index]!.pick = side;
    message = '';
  }

  function setSure(sure: Confidence): void {
    answers[index]!.sure = sure;
    message = '';
  }

  async function check(): Promise<void> {
    if (!answer.pick) {
      message = copy.MISSING_PICK;
      live = message;
      focusGroup(`${id}-pick`);
      return;
    }
    if (!answer.sure) {
      message = copy.MISSING_SURE;
      live = message;
      focusGroup(`${id}-sure`);
      return;
    }
    message = '';
    live = '';
    revealed[index] = true;
    await tick();
    // On a phone the reveal lands below the button. Bring the verdict and both waveforms into
    // view (smoothly unless motion is reduced: the page sets scroll-behavior), then move focus to
    // the verdict so it is read out and Tab carries on to the Play keys, the toggle and Next.
    screens?.scrollIntoView({ block: 'nearest' });
    verdict?.focus({ preventScroll: true });
  }

  /**
   * A new round, or the result: show the panel from the top and focus its title. Next and Try
   * again sit at the foot of a tall panel, and the panel shrinks as the round changes, so on a
   * phone the title can land above the screen. Focus alone doesn't reliably scroll it back.
   */
  async function showTop(): Promise<void> {
    await tick();
    if (root && root.getBoundingClientRect().top < 0) root.scrollIntoView({ block: 'start' });
    title?.focus({ preventScroll: true });
  }

  function next(): Promise<void> {
    stop();
    unmatched = false;
    live = '';
    current += 1;
    return showTop();
  }

  function restart(): Promise<void> {
    stop();
    rounds = assignRounds();
    answers = freshAnswers();
    revealed = revealed.map(() => false);
    unmatched = false;
    message = '';
    live = '';
    current = 0;
    return showTop();
  }

  onMount(() => {
    // The server drew round 1 with a fixed assignment; nothing about it showed. Now make it blind.
    rounds = assignRounds();
    // Render every buffer while the page is idle. Otherwise the first "Check answer" does it
    // inside the click (the reveal draws from them) and the page stalls on a slow phone. The rate
    // is read when the work runs, so a sound that started first decides it.
    const warm = () => {
      versionsFor(drawRate());
    };
    const idle = typeof requestIdleCallback === 'function' ? requestIdleCallback(warm, { timeout: 2000 }) : null;
    const timer = idle === null ? setTimeout(warm, 500) : null;
    return () => {
      if (idle !== null) cancelIdleCallback(idle);
      if (timer !== null) clearTimeout(timer);
      player?.stop();
    };
  });
</script>

{#snippet deviceChoice()}
  <Choice
    name="{id}-device"
    legend={copy.LEGENDS.device}
    options={deviceOptions}
    value={device}
    onchange={(d) => (device = d)}
  />
{/snippet}

<div class="hear panel" bind:this={root} data-phase={done ? 'result' : isRevealed ? 'revealed' : 'listening'}>
  <div class="layout">
    <!-- The round in words ("Round 1 of 3"), and what to do. The result swaps the counter for the
         score, in the display face. -->
    <header class="head">
      <svelte:element this={`h${headingLevel}`} class="title" class:score={done} tabindex="-1" bind:this={title}>
        {done ? copy.scoreLine(summary) : copy.roundHeading(index, ROUND_COUNT)}
      </svelte:element>
      {#if !done}
        <p class="intro">{copy.ROUND_INTROS[index]}</p>
      {/if}
    </header>

    {#if !done}
      <div class="controls">
        <div class="device">
          {@render deviceChoice()}
          <p class="tip">{copy.DEVICE_TIPS[device]}</p>
          {#if showWarning}
            <p class="warning" id="{id}-warn">{copy.HEADPHONE_WARNING}</p>
          {/if}
        </div>

        <div class="listen">
          <!-- The key that's playing turns into its Stop, so the transport needs no Stop key of its own. -->
          <div class="transport">
            {#each SIDES as side (side)}
              <ListenKey
                playing={playing === side}
                onclick={() => play(side)}
                label="Play"
                aria-describedby={playHelp}
              >
                <span class="big">{copy.letter(side)}</span>
              </ListenKey>
            {/each}
          </div>
          <p class="note" id="{id}-note">{problem ?? copy.TRANSPORT_NOTE}</p>
        </div>

        <div class="answer">
          <Choice
            name="{id}-pick"
            legend={copy.LEGENDS.pick}
            options={pickOptions}
            value={answer.pick}
            pads
            letters
            disabled={isRevealed}
            onchange={setPick}
          />
          <Choice
            name="{id}-sure"
            legend={copy.LEGENDS.sure}
            options={sureOptions}
            value={answer.sure}
            pads
            disabled={isRevealed}
            onchange={setSure}
          />
        </div>
      </div>

      <div class="screens" data-revealed={isRevealed} bind:this={screens}>
        {#if isRevealed && view}
          <p class="verdict" tabindex="-1" bind:this={verdict}>
            <strong>{copy.verdictLine(isSpotted(round, answer))}</strong>
            {copy.revealLine(round)}
          </p>
        {/if}
        <div class="scopes">
          {#each SIDES as side (side)}
            {@const clipped = side === round.clipped}
            {#if isRevealed && view}
              <Scope
                id="{id}-scope-{side}"
                letter={copy.letter(side)}
                title={copy.scopeTitle(clipped, unmatched)}
                label={copy.scopeLabel(side, clipped, unmatched)}
                view={clipped ? view.clipped : view.clean}
                geometry={REVEAL_SCOPE}
                playing={playing === side}
                onplay={() => play(side)}
              />
            {:else}
              <Scope
                id="{id}-scope-{side}"
                letter={copy.letter(side)}
                waiting={copy.SCOPE_WAITING}
                geometry={REVEAL_SCOPE}
              />
            {/if}
          {/each}
        </div>
        {#if isRevealed && view}
          <div class="scope-notes">
            <div class="keys">
              <p class="key"><span class="swatch" aria-hidden="true"></span>{copy.FLAT_KEY}</p>
              <p class="key"><span class="dash" aria-hidden="true"></span>{copy.CEILING_KEY}</p>
            </div>
            <p class="caption">{copy.scopeCaption(unmatched)}</p>
          </div>
          <div class="unmatched" bind:this={unmatchedBox}>
            <Pad pressed={unmatched} onclick={toggleUnmatched} aria-describedby="{id}-unmatched-hint">
              {copy.UNMATCHED_LABEL}
            </Pad>
            <p class="hint" id="{id}-unmatched-hint">
              {unmatched ? copy.unmatchedNote(round, matchDb) : copy.unmatchedHint(matchDb)}
            </p>
          </div>
        {/if}
      </div>

      <div class="actions">
        <HwButton primary onclick={isRevealed ? next : check}>
          {isRevealed ? copy.nextLabel(index, ROUND_COUNT) : copy.CHECK}
        </HwButton>
        {#if message}<p class="message">{message}</p>{/if}
      </div>
    {:else}
      <div class="result">
        <table class="answers">
          <caption class="visually-hidden">Your answers, round by round</caption>
          <thead>
            <tr>
              <th scope="col">Round</th>
              <th scope="col">Pushed by</th>
              <th scope="col">Result</th>
              <th scope="col">How sure</th>
            </tr>
          </thead>
          <tbody>
            {#each rounds as r, i (i)}
              {@const a = answers[i] ?? EMPTY_ANSWER}
              <tr data-spotted={isSpotted(r, a)}>
                <th scope="row">{i + 1}</th>
                <td>{copy.dbText(r.pushDb)}</td>
                <td>{copy.resultWord(isSpotted(r, a))}</td>
                <td>{a.sure ? copy.CONFIDENCE_LABELS[a.sure] : '–'}</td>
              </tr>
            {/each}
          </tbody>
        </table>
        {#if hyper}<p class="hyper">{hyper}</p>{/if}
        <!-- The device switch sits right above the words it changes. -->
        <div class="device">
          {@render deviceChoice()}
          <p class="explain">{copy.DEVICE_EXPLANATIONS[device]}</p>
        </div>
        <p class="final">{copy.FINAL_LINE}</p>
        <div class="actions">
          <HwButton onclick={restart}>{copy.TRY_AGAIN}</HwButton>
        </div>
      </div>
    {/if}

    <p class="model">{copy.MODEL_NOTE}</p>
  </div>
  <p class="visually-hidden" aria-live="polite">{live}</p>
</div>

<style>
  .hear {
    --rule-gap: 1.1rem;
    container: hear / inline-size;
    min-width: 0;
    /*
     * Each round replaces most of the panel. Left to itself, the browser's scroll anchoring locks
     * onto a node in there and moves the page unpredictably; showTop() places the page instead.
     */
    overflow-anchor: none;
  }

  .layout {
    display: grid;
    gap: 1.25rem;
    min-width: 0;
  }

  /* Round title ------------------------------------------------------------------------------- */

  .head {
    display: grid;
    gap: 0.45rem;
  }

  /* While the rounds run, the heading is the counter, in words. */
  .title {
    justify-self: start;
    margin: 0;
    font-family: var(--font-body);
    font-size: var(--text-sm);
    font-weight: 700;
    line-height: 1.4;
    font-variant-numeric: tabular-nums;
    color: var(--hw-label);
  }

  /* The result: the score in the display face, lit, the biggest words on the panel. */
  .title.score {
    font-family: var(--font-display);
    font-size: var(--text-h2);
    font-weight: 700;
    line-height: 1.1;
    color: var(--hw-bright);
  }

  /* Focus lands on the title and the verdict when the round changes. Show it for keyboard users. */
  .title:focus,
  .verdict:focus {
    outline: none;
  }

  .title:focus-visible,
  .verdict:focus-visible {
    outline: 3px solid var(--hw-focus);
    outline-offset: 4px;
  }

  .intro {
    max-width: 44rem;
    margin: 0;
    font-size: var(--text-base);
    line-height: 1.45;
    color: var(--hw-label);
  }

  /* Controls ---------------------------------------------------------------------------------- */

  .controls {
    display: grid;
    gap: 1.25rem;
    min-width: 0;
  }

  .device,
  .listen {
    display: grid;
    gap: 0.6rem;
  }

  .listen,
  .answer {
    padding-top: var(--rule-gap);
    border-top: 1px solid var(--hw-edge);
  }

  .tip,
  .note,
  .hint,
  .caption,
  .model {
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.5;
    color: var(--hw-label);
  }

  .warning {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: 700;
    line-height: 1.45;
    color: var(--hw-bright);
  }

  .transport {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 0.5rem;
  }

  .transport :global(.listen-key) {
    justify-content: center;
    width: 100%;
    min-height: 3.5rem;
    padding-inline: 0.8rem 1rem;
  }

  /* A phone-width panel: keep "Play A" on one line down to a 320 px screen. */
  @container hear (max-width: 21rem) {
    .hear .transport :global(.listen-key) {
      gap: 0.45rem;
      padding-inline: 0.6rem 0.75rem;
    }
  }

  .big {
    margin-left: 0.15rem;
    font-family: var(--font-display);
    font-size: 1.75rem;
    font-weight: 700;
    line-height: 0.8;
    vertical-align: -0.12em;
  }

  .answer {
    display: flex;
    flex-wrap: wrap;
    gap: 1.1rem 2rem;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem 1rem;
  }

  /* What's missing before Check answer can go ahead: what to do, so in the action colour. */
  .message {
    margin: 0;
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--hw-action);
  }

  /* The screens: blank until the answer is in, then both waveforms ---------------------------- */

  .screens {
    display: grid;
    align-content: start;
    gap: 1rem;
    min-width: 0;
    padding-top: var(--rule-gap);
    border-top: 1px solid var(--hw-edge);
  }

  /* A narrow panel only shows the screens once there's something on them. */
  .screens[data-revealed='false'] {
    display: none;
  }

  /* The verdict on a line of its own, like a readout, then what was done to the clipped one. One
     paragraph, so it's read out whole when focus lands on it. */
  .verdict {
    margin: 0;
    font-size: var(--text-base);
    line-height: 1.5;
    color: var(--hw-label);
  }

  .verdict strong {
    display: block;
    margin-bottom: 0.15rem;
    font-family: var(--font-display);
    font-size: var(--text-h3);
    line-height: 1.2;
    color: var(--hw-bright);
  }

  .scopes {
    display: grid;
    gap: 0.9rem;
  }

  .scope-notes {
    display: grid;
    gap: 0.35rem;
  }

  /* The two keys share a row when there's room, and stack on a phone. */
  .keys {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem 1.4rem;
  }

  .key {
    display: flex;
    align-items: center;
    gap: 0.55rem;
    margin: 0;
    font-size: var(--text-sm);
    color: var(--hw-label);
  }

  .swatch {
    flex: none;
    width: 1.1rem;
    height: 4px;
    background: var(--dmg);
  }

  /* The ceiling line, drawn the way the two-ceilings lab keys its own. */
  .dash {
    flex: none;
    width: 1.1rem;
    border-top: 1.5px dashed var(--screen-text);
  }

  .unmatched {
    display: grid;
    justify-items: start;
    gap: 0.5rem;
  }

  /* The result -------------------------------------------------------------------------------- */

  .result {
    display: grid;
    align-content: start;
    gap: 1rem;
    min-width: 0;
    max-width: 40rem;
    padding-top: var(--rule-gap);
    border-top: 1px solid var(--hw-edge);
  }

  .answers {
    width: 100%;
    max-width: 30rem;
    border-collapse: collapse;
    font-size: var(--text-sm);
    font-variant-numeric: tabular-nums;
    color: var(--hw-label);
  }

  .answers th,
  .answers td {
    padding: 0.5rem 0.75rem 0.5rem 0;
    border-bottom: 1px solid var(--hw-edge);
    text-align: left;
    font-weight: 400;
  }

  .answers thead th {
    padding-top: 0;
    font-weight: 700;
    color: var(--hw-label);
  }

  .answers tbody th {
    font-weight: 700;
    color: var(--hw-bright);
  }

  .answers [data-spotted='true'] td:nth-child(3) {
    font-weight: 700;
    color: var(--hw-bright);
  }

  .hyper,
  .explain {
    margin: 0;
    font-size: var(--text-base);
    line-height: 1.5;
    color: var(--hw-label);
  }

  /* Being sure and wrong is the line to remember: brighter than the rest, with no bar beside it. */
  .hyper {
    color: var(--hw-bright);
  }

  .final {
    margin: 0;
    font-size: var(--text-lede);
    font-weight: 700;
    line-height: 1.35;
    color: var(--hw-bright);
    text-wrap: pretty;
  }

  /* The rule runs the panel's width; the words keep a reading measure. */
  .model {
    padding-top: 0.9rem;
    border-top: 1px solid var(--hw-edge);
  }

  .layout > .model {
    padding-right: max(0px, 100% - 44rem);
  }

  /* A mid-width panel: the two screens side by side. ------------------------------------------ */

  @container hear (min-width: 34rem) {
    .transport {
      grid-template-columns: 9rem 9rem;
      justify-content: start;
    }

    .scopes {
      grid-template-columns: 1fr 1fr;
      /* If one caption wraps, the two screens still line up. */
      align-items: end;
    }
  }

  /*
   * A wide panel is laid out like a piece of kit: the controls on the left, the screens on the
   * right. The screens sit there from the start, blank, so nothing jumps when the answer lands.
   * A over B, so the two kicks line up in time.
   */
  @container hear (min-width: 54rem) {
    .layout {
      grid-template-columns: minmax(0, 26rem) minmax(0, 1fr);
      /* The last row soaks up the screens' extra height, so Next sits right under the questions. */
      grid-template-rows: auto auto auto 1fr auto;
      grid-template-areas:
        'head head'
        'controls screens'
        'actions screens'
        '. screens'
        'model model';
      align-items: start;
      column-gap: 2.5rem;
    }

    .layout > .head {
      grid-area: head;
    }

    .layout > .controls {
      grid-area: controls;
    }

    .layout > .actions {
      grid-area: actions;
    }

    .layout > .screens {
      grid-area: screens;
      padding-top: 0;
      padding-left: 2.5rem;
      border-top: 0;
      border-left: 1px solid var(--hw-edge);
      margin-left: -1.25rem;
    }

    .screens[data-revealed='false'] {
      display: grid;
    }

    .scopes {
      grid-template-columns: 1fr;
    }

    .layout > .model {
      grid-area: model;
    }

    /* The result is reading, not operating: one column at a comfortable measure. */
    [data-phase='result'] .layout {
      grid-template-columns: minmax(0, 1fr);
      grid-template-rows: none;
      grid-template-areas: none;
    }

    [data-phase='result'] .layout > * {
      grid-area: auto;
    }
  }

  @media (forced-colors: active) {
    .swatch {
      background: Highlight;
    }

    .dash {
      border-top-color: GrayText;
    }
  }
</style>
