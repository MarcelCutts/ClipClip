<script lang="ts">
  /**
   * W4 · Set the record level. The steps as a read-then-do list, then the same job to practise on
   * a model of the rig: a worked example with every instruction, then "Your turn" without them.
   *
   * The Howler records from MASTER 2 and has no input knob, just one light, so MASTER LEVEL is the
   * record level. It stays fully up and taped; MASTER ATT, in UTILITY, trims the feed; and MASTER
   * LEVEL only comes down if the light is still red at MASTER ATT's lowest step. All the judging
   * lives in lib/record, so this file only wires state to parts.
   *
   * One DOM order reads right on a phone: the step, the controls, what the Howler and the file
   * show, then the key and what it said. On a wide panel a grid lifts the rig into a column beside
   * the steps, so the step you're on keeps its instruction, its key and its result together between
   * two rules.
   */
  import { tick } from 'svelte';
  import { formatDb } from '../lib/dsp/db';
  import { HOWLER_BELOW_RED_DB } from '../lib/model';
  import {
    type Action,
    CHECKS,
    type CheckId,
    type Control,
    doneAnnouncement,
    type Flow,
    type Mode,
    offMark,
    practiceStart,
    reduce,
    STEP_IDS,
    STEPS,
    stepResponse,
    workedStart,
  } from '../lib/record/flow';
  import {
    ATT_VALUES,
    DONE_MESSAGE,
    LEVEL,
    levelWords,
    lightFor,
    MATERIALS_NOTE,
    material,
    newsSince,
    peaksFor,
    type Rig,
    type RigNews,
    rigNews,
    settingsMessage,
    spokenLevel,
  } from '../lib/record/model';
  import FileLadder from './record-level/FileLadder.svelte';
  import Howler from './record-level/Howler.svelte';
  import LevelFader from './record-level/LevelFader.svelte';
  import Procedure from './record-level/Procedure.svelte';
  import RadioPads from './record-level/RadioPads.svelte';
  import StepRow from './record-level/StepRow.svelte';
  import HwButton from './ui/HwButton.svelte';
  import Pad from './ui/Pad.svelte';

  const uid = $props.id();

  let flow = $state.raw<Flow>(workedStart());
  let panel: HTMLElement;
  /** The key that moves the job on. Only one shows at a time. */
  let goKey = $state<HTMLButtonElement>();
  /** The one polite live region's text. */
  let announce = $state('');

  const index = $derived(STEP_IDS.indexOf(flow.step));
  const current = $derived(STEPS[index]!);
  const before = $derived(flow.complete ? STEPS : STEPS.slice(0, index));
  const after = $derived(flow.complete ? [] : STEPS.slice(index + 1));
  const light = $derived(lightFor(flow.rig, flow.limit));
  const peaks = $derived(peaksFor(flow.rig, ['blend', 'loud', 'quiet'], flow.limit));
  const off = $derived(offMark(flow));
  const listening = $derived(flow.step === 'test' && flow.recorded);
  const playOptions = $derived(flow.order.map((id) => ({ value: id, label: material(id).pad })));
  const attOptions = ATT_VALUES.map((v) => ({ value: v, label: formatDb(v) }));
  const db = (v: number) => formatDb(v, { signed: false });
  const tapeWords = (tape: number) => (tape === LEVEL.max ? 'fully up' : db(tape));
  /** Something has happened since the start, so starting again means something. */
  const dirty = $derived(
    flow.rig.material !== null ||
      flow.step !== 'up' ||
      flow.note !== null ||
      flow.rig.level !== flow.found.level ||
      flow.rig.att !== flow.found.att,
  );
  /**
   * Once a control is taped or set, a slip gets a standing note. A fresh fix already says what the
   * note would, and a stale one is covered by it, so only one of them shows at a time.
   */
  const freshFix = $derived(flow.note?.tone === 'fix' && flow.note.rig === flow.rig);
  const showNote = $derived(flow.note !== null && !flow.complete && (off === null || flow.note.tone === 'good' || freshFix));
  const offNote = $derived.by(() => {
    if (off === null || freshFix) return null;
    const { tape, att } = flow.kept;
    if (off === 'level' && tape !== null) return `MASTER LEVEL is off its REC tape. The tape says ${tapeWords(tape)}.`;
    if (off === 'att' && att !== null) return `MASTER ATT has changed since you set it. It was ${db(att)}.`;
    return null;
  });

  function dispatch(action: Action) {
    flow = reduce(flow, action);
  }

  /** Pending news about the rig, once the reader pauses. */
  let statusTimer: ReturnType<typeof setTimeout> | undefined;
  /** What the live region last said about the rig: what's playing, the light and MASTER ATT. */
  let told: RigNews | null = null;

  /**
   * Announce a sentence, even if it's the same as last time. A key's result wins over pending
   * news, and it speaks for the rig as it stands, so that news isn't repeated afterwards.
   */
  function say(text: string) {
    clearTimeout(statusTimer);
    told = rigNews(flow.rig, flow.limit);
    announce = '';
    setTimeout(() => (announce = text), 60);
  }

  /**
   * After a step is done, keyboard focus goes to what the next one works: its control, the
   * headphone checks, or its key. A fix leaves focus on the key, ready to try again.
   */
  async function focusOn(target: Control | 'key' | 'checks') {
    await tick();
    const radios = (name: string) => {
      const sel = `input[name="${CSS.escape(`${uid}-${name}`)}"]`;
      return panel.querySelector<HTMLElement>(`${sel}:checked`) ?? panel.querySelector<HTMLElement>(sel);
    };
    const el =
      target === 'play' || target === 'att'
        ? radios(target)
        : target === 'level'
          ? panel.querySelector<HTMLElement>(`#${CSS.escape(`${uid}-level`)}`)
          : target === 'checks'
            ? panel.querySelector<HTMLElement>('.checks input')
            : goKey;
    el?.focus();
  }

  function commit() {
    const was = flow;
    dispatch({ type: 'commit' });
    if (flow.step !== was.step) {
      say(doneAnnouncement(flow));
      void focusOn(current.control ?? 'key');
    } else if (flow.recorded && !was.recorded) {
      if (flow.note) say(flow.note.text);
      void focusOn('checks');
    } else if (flow.note) {
      say(flow.note.text);
    }
  }

  /** The last tick finishes the job: the checks give way to what's next, and focus goes with them. */
  function hear(check: CheckId, value: boolean) {
    dispatch({ type: 'heard', check, value });
    if (!flow.complete) return;
    say(`${DONE_MESSAGE} ${aside()}`);
    void focusOn('key');
  }

  const aside = () => settingsMessage(flow.kept.tape ?? LEVEL.max, flow.kept.att ?? ATT_VALUES[0], flow.limit);

  /** Start a mode afresh. From a key that then goes away, focus moves to step 1's control. */
  function start(mode: Mode, moveFocus = false) {
    flow = mode === 'worked' ? workedStart() : practiceStart();
    seen = flow.rig;
    if (moveFocus) void focusOn('level');
    say(
      mode === 'worked'
        ? 'Worked example, from the top. Nothing is playing yet.'
        : `Your turn, without hints. MASTER LEVEL is ${levelWords(flow.rig.level)} and MASTER ATT at ${db(flow.rig.att)}.`,
    );
  }

  // After the rig changes and the reader pauses, say what's new: something else playing, the
  // Howler light changing, or MASTER ATT. MASTER LEVEL's own steps are spoken by its slider, peak
  // and all, so moving it within one light says nothing more here. Nothing is announced on load.
  let seen: Rig | null = null;
  $effect(() => {
    const rig = flow.rig;
    if (seen === null) {
      seen = rig;
      told = rigNews(rig, flow.limit);
      return;
    }
    if (rig === seen) return;
    seen = rig;
    clearTimeout(statusTimer);
    statusTimer = setTimeout(() => {
      const news = told ? newsSince(told, rig, flow.kept.att, flow.limit) : null;
      told = rigNews(rig, flow.limit);
      if (news) announce = news;
    }, 450);
  });
  $effect(() => () => clearTimeout(statusTimer));
</script>

<div class="walkthrough">
  <Procedure />

  <section class="panel record-level" aria-labelledby="{uid}-title" bind:this={panel}>
    <header class="top">
      <p class="title" id="{uid}-title">Practise it here<span class="visually-hidden">: set the record level</span></p>
      <!-- Beside the title, so it never needs a row of its own on a phone. -->
      {#if dirty}
        <button type="button" class="again" onclick={() => start(flow.mode, true)}>Start again</button>
      {/if}
      <div class="modes">
        <!-- Switching mode starts it fresh. Pressing the mode you're in does nothing: "Start again" resets. -->
        <Pad pressed={flow.mode === 'worked'} onclick={() => flow.mode !== 'worked' && start('worked')}>Worked example</Pad>
        <Pad pressed={flow.mode === 'practice'} onclick={() => flow.mode !== 'practice' && start('practice')}>Your turn</Pad>
      </div>
    </header>

    <div class="body" data-step={flow.complete ? 'complete' : flow.step}>
      {#if before.length > 0 || flow.mode === 'practice'}
        <div class="done">
          {#if flow.mode === 'practice'}
            <p class="intro">The same steps without the instructions, and the rig starts somewhere new.</p>
          {/if}
          {#each before as s, i (s.id)}
            <StepRow
              n={i + 1}
              of={STEPS.length}
              label={s.label}
              response={stepResponse(flow, s.id)}
              state="done"
              message={!flow.complete && flow.note === null && flow.last?.step === s.id ? flow.last.text : null}
            />
          {/each}
        </div>
      {/if}

      {#if !flow.complete}
        <div class="now">
          <StepRow
            n={index + 1}
            of={STEPS.length}
            label={current.label}
            response={current.target}
            state="current"
            instruction={flow.mode === 'worked' ? current.instruction : null}
          />
        </div>
      {/if}

      <div class="rig">
        <div class="play">
          <RadioPads
            name="{uid}-play"
            legend="What’s playing"
            note={MATERIALS_NOTE}
            layout="row"
            wrap
            options={playOptions}
            value={flow.rig.material}
            onchange={(m) => dispatch({ type: 'play', material: m })}
          />
        </div>
        <div class="level">
          <LevelFader
            id="{uid}-level"
            value={flow.rig.level}
            tape={flow.kept.tape}
            speak={(level) => spokenLevel({ ...flow.rig, level }, flow.kept.tape, flow.limit)}
            oninput={(v) => dispatch({ type: 'level', db: v })}
          />
        </div>
        <div class="att">
          <RadioPads
            name="{uid}-att"
            legend="MASTER ATT"
            hardware
            note="It’s in UTILITY, and it turns the speakers down too."
            layout="row"
            options={attOptions}
            value={flow.rig.att}
            onchange={(v) => dispatch({ type: 'att', db: v })}
          />
        </div>
        <!-- What the booth and a test recording show. On phones, a strip right under the controls. -->
        <div class="results">
          <div class="howler"><Howler {light} /></div>
          <div class="file"><FileLadder {peaks} playing={flow.rig.material} /></div>
        </div>
      </div>

      <div class="act" class:alone={flow.complete}>
        {#if listening && !flow.complete}
          {#if flow.note && showNote}
            {@render note(flow.note.tone, flow.note.text, false)}
          {/if}
          <fieldset class="checks">
            <legend>Listen on headphones</legend>
            {#each CHECKS as c (c.id)}
              <label class="check">
                <input type="checkbox" checked={flow.heard[c.id]} onchange={(e) => hear(c.id, e.currentTarget.checked)} />
                <span>{c.label}</span>
              </label>
            {/each}
          </fieldset>
        {:else if !flow.complete}
          <HwButton primary onclick={commit} bind:element={goKey}>{current.action}</HwButton>
          {#if flow.note && showNote}
            {@render note(flow.note.tone, flow.note.text, flow.note.rig !== flow.rig)}
          {/if}
        {/if}
        {#if offNote}
          {@render note('fix', offNote, false)}
        {/if}
        {#if flow.complete}
          {@render note('good', DONE_MESSAGE, false)}
          <p class="aside">{aside()}</p>
          <HwButton primary onclick={() => start('practice', true)} bind:element={goKey}>
            {flow.mode === 'worked' ? 'Your turn, without hints' : 'Go again'}
          </HwButton>
        {/if}
      </div>

      {#if after.length > 0}
        <div class="todo">
          {#each after as s, i (s.id)}
            <StepRow
              n={index + i + 2}
              of={STEPS.length}
              label={s.label}
              response={stepResponse(flow, s.id)}
              state="todo"
            />
          {/each}
        </div>
      {/if}
    </div>

    <p class="model">
      This is a model. It assumes MASTER ATT reaches MASTER 2, which Pioneer doesn’t say, and that the Howler overloads
      {db(HOWLER_BELOW_RED_DB)} below the mixer’s red with MASTER LEVEL fully up, which Howler doesn’t publish. On the
      night, its LEVEL light is the only way to tell.
    </p>
    <p class="visually-hidden" aria-live="polite">{announce}</p>
  </section>
</div>

{#snippet note(tone: 'good' | 'fix', text: string, stale: boolean)}
  <!-- Feedback about a rig that has since changed stays readable, but steps back. -->
  <p class="feedback" data-tone={tone} class:stale={stale}>
    <svg class="icon" viewBox="0 0 16 16" aria-hidden="true">
      {#if tone === 'good'}<path d="M3 8.5 6.5 12 13 4.5" />{:else}<path d="M8 3.5v5.5M8 12.2v.3" />{/if}
    </svg>
    <span>{text}</span>
  </p>
{/snippet}

<style>
  .walkthrough {
    display: grid;
    gap: 1.75rem;
    min-width: 0;
  }

  .record-level {
    container: record / inline-size;
    display: grid;
    gap: 1rem;
    min-width: 0;
    /* The hardware is dark in both themes, so native controls (the checkboxes) should be too. */
    color-scheme: dark;
  }

  .top {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.6rem 1rem;
  }

  /* Not a hardware name, so the display face in sentence case, like the other step-by-step panels. */
  .title {
    flex: 1 1 auto;
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(1.4rem, 1.25rem + 0.6vw, 1.625rem);
    font-weight: 700;
    line-height: 1.1;
    color: var(--hw-bright);
  }

  .modes {
    display: flex;
    flex: 1 1 100%;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .again {
    min-height: 2.75rem;
    padding: 0.5rem 0.25rem;
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

  .again:hover {
    color: var(--hw-bright);
  }

  .again:focus-visible {
    outline: 3px solid var(--hw-focus);
    outline-offset: 2px;
  }

  /* ---------------------------------------------------------------------------------------------
   * Phones first: one column, in the order the job goes.
   * ------------------------------------------------------------------------------------------- */

  .body {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    row-gap: 0.85rem;
  }

  .done,
  .todo {
    display: grid;
    gap: 0.1rem;
    align-content: start;
  }

  .intro {
    margin: 0 0 0.35rem;
    font-size: var(--text-sm);
    line-height: 1.45;
    color: var(--hw-label);
  }

  /* The step you're on: ruled off from the rest of the list, as a checklist marks its place. */
  .now {
    border-block: 1px solid var(--hw-edge);
  }

  .now :global(.row) {
    padding-block: 0.6rem 0.7rem;
  }

  .rig {
    display: grid;
    gap: 0.8rem;
    min-width: 0;
  }

  /* On a phone the step needs its controls and their result on one screen, so the choices'
     meter readings stay as the group's description only. */
  .play :global(.note) {
    display: none;
  }

  /* What the booth and the file show, right under the controls: the Howler's light, then the
     file strip. */
  .results {
    display: grid;
    gap: 0.55rem;
    padding-top: 0.85rem;
    border-top: 1px solid var(--hw-edge);
  }

  .file {
    display: flex;
    min-width: 0;
  }

  .file > :global(*) {
    flex: 1;
  }

  .act {
    display: grid;
    gap: 0.75rem;
    justify-items: start;
    align-content: start;
  }

  .feedback {
    display: flex;
    gap: 0.55rem;
    align-items: flex-start;
    max-width: 34rem;
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.45;
    color: var(--hw-label);
  }

  .icon {
    flex: none;
    width: 1.1rem;
    height: 1.1rem;
    margin-top: 0.12rem;
    fill: none;
    stroke: currentColor;
    stroke-width: 2.2;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  [data-tone='fix'] {
    font-weight: 700;
    color: var(--hw-bright);
  }

  /* Steps back, but stays above 4.5:1 on the panel. */
  .feedback.stale {
    opacity: 0.7;
  }

  .aside {
    max-width: 34rem;
    margin: 0;
    font-size: var(--text-sm);
    line-height: 1.45;
    color: var(--hw-label);
  }

  .checks {
    display: grid;
    gap: 0.25rem;
    margin: 0;
    padding: 0;
    border: 0;
    min-width: 0;
  }

  .checks legend {
    padding: 0;
    margin-bottom: 0.35rem;
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--hw-label);
  }

  .check {
    display: flex;
    align-items: center;
    gap: 0.7rem;
    min-height: 2.75rem;
    font-size: var(--text-sm);
    color: var(--hw-label);
    cursor: pointer;
  }

  .check input {
    flex: none;
    width: 1.3rem;
    height: 1.3rem;
    margin: 0;
    cursor: pointer;
  }

  /* Outside the site's Baseline, so gated: without it the ticks keep the dark scheme's default. */
  @supports (accent-color: auto) {
    .check input {
      accent-color: var(--hw-label);
    }
  }

  .check input:focus-visible {
    outline: 3px solid var(--hw-focus);
    outline-offset: 2px;
  }

  .model {
    margin: 0;
    padding-top: 0.85rem;
    border-top: 1px solid var(--hw-edge);
    font-size: var(--text-xs);
    line-height: 1.45;
    color: var(--hw-label-2);
  }

  /* ---------------------------------------------------------------------------------------------
   * A wide panel: the steps on the left, the rig beside them. The rig spans every row, ending in a
   * flexible one, so it never stretches the step rows apart: the step's instruction, key and
   * result stay together however tall the rig is.
   * ------------------------------------------------------------------------------------------- */

  @container record (min-width: 54rem) {
    .modes {
      flex: 0 0 auto;
    }

    .body {
      grid-template-columns: minmax(18rem, 22rem) minmax(0, 1fr);
      grid-template-rows: auto auto auto auto 1fr;
      column-gap: 2rem;
      row-gap: 0;
    }

    .done {
      grid-area: 1 / 1;
      margin-bottom: 0.4rem;
    }

    /* The step you're on, its key and its result read as one block between two rules. */
    .now {
      grid-area: 2 / 1;
      border-bottom: 0;
    }

    .act {
      grid-area: 3 / 1;
      padding: 0.15rem 0.6rem 0.9rem;
      border-bottom: 1px solid var(--hw-edge);
    }

    .act.alone {
      padding: 0.2rem 0 0;
      border-bottom: 0;
    }

    .todo {
      grid-area: 4 / 1;
      margin-top: 0.4rem;
    }

    /* Controls on the left, in signal order; on the right, what they do: the Howler's light
       over the file's ladder. */
    .play :global(.note) {
      display: block;
    }

    .rig {
      grid-column: 2;
      grid-row: 1 / -1;
      grid-template-columns: minmax(0, 1fr) 11rem;
      grid-template-rows: auto auto auto 1fr;
      gap: 1rem 1.25rem;
      align-content: start;
    }

    .play,
    .level,
    .att {
      grid-column: 1;
    }

    .results {
      grid-column: 2;
      grid-row: 1 / -1;
      display: flex;
      flex-direction: column;
      gap: 0.9rem;
      padding-top: 0;
      border-top: 0;
    }

    .file {
      flex: 1;
    }
  }

  /* System colours: the rules that set the current step off keep their line. */
  @media (forced-colors: active) {
    .now,
    .act {
      border-color: CanvasText;
    }
  }
</style>
