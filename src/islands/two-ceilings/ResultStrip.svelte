<script lang="ts">
  import { formatDb } from '../../lib/dsp/db';
  /**
   * A step's result at a glance, in one row right under its control: the CH1 lights, the crunch
   * in a word and the Howler's LEVEL light. The channel meter is the XDJ-RX2's twelve lights laid
   * on their side, with the zone in words beside them, so colour is never the only cue.
   *
   * Until the reader has committed a guess, the two outcomes wait in words ("Guess first"), the
   * way the listening test's screens say "Shows after you answer". The channel's red stays lit:
   * it's the question, not the answer.
   *
   * With room, one row of three. On a phone, two rows: the channel across the top, then the crunch
   * beside the Howler light, so every value keeps to one line.
   *
   * Ruled on the panel like a table: printed lines above, below and between the cells, and no box
   * of its own. The CH1 lights sit in a small well, the one box here, like the meter's window.
   */
  import type { Crunch } from '../../lib/lab/ceilings';
  import { CRUNCH_WORDS, HOWLER_WORDS, levelWords, READOUTS } from '../../lib/lab/copy';
  import { describeLevel, litCount, METER_SEGMENTS } from '../../lib/xdj';
  import CrunchGlyph from './CrunchGlyph.svelte';
  import HowlerLight from './HowlerLight.svelte';

  interface Props {
    /** The channel's loudest peak, on the meter's own dB scale. */
    channels: number;
    /** Null while the outcome waits for a guess. */
    crunch: Crunch | null;
    howler: 'green' | 'red' | null;
    /** What a waiting outcome says. */
    waiting: string;
  }

  let { channels, crunch, howler, waiting }: Props = $props();

  const lit = $derived(litCount(channels));
  // The same reading LedMeter gives, so the strip and the rest of the site speak alike.
  const valueNow = $derived(Math.max(-30, Math.min(15, channels)));
  const valueText = $derived(`${READOUTS.ch1}: peaks at ${formatDb(channels)}, ${describeLevel(channels)}`);
</script>

<div class="result">
  <dl class="strip">
    <div class="cell ch1-cell">
      <dt class="hw-label">{READOUTS.ch1}</dt>
      <dd class="ch1">
        <!-- biome-ignore lint/a11y/useSemanticElements: a native <meter> cannot draw the LED row; role="meter" carries the same semantics -->
        <span
          class="lights"
          role="meter"
          aria-label="{READOUTS.ch1} level"
          aria-valuemin={-30}
          aria-valuemax={15}
          aria-valuenow={valueNow}
          aria-valuetext={valueText}
        >
          {#each METER_SEGMENTS as seg, i (seg.db)}
            <span class="led" data-zone={seg.zone} data-on={i < lit}></span>
          {/each}
        </span>
        <span class="zone" aria-hidden="true">{levelWords(channels)}</span>
      </dd>
    </div>
    <div class="cell">
      <dt>{READOUTS.crunch}</dt>
      {#if crunch}
        <dd class="value" data-crunch={crunch}>
          <CrunchGlyph {crunch} />
          <span>{CRUNCH_WORDS[crunch]}</span>
        </dd>
      {:else}
        <dd class="wait">{waiting}</dd>
      {/if}
    </div>
    <div class="cell">
      <dt>{READOUTS.howler}</dt>
      {#if howler}
        <dd><HowlerLight light={howler} state={HOWLER_WORDS[howler].state} meaning={HOWLER_WORDS[howler].meaning} /></dd>
      {:else}
        <dd class="wait">{waiting}</dd>
      {/if}
    </div>
  </dl>
</div>

<style>
  .result {
    container: result / inline-size;
  }

  /* Three cells, labels over values, ruled like a table printed on the panel. */
  .strip {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) minmax(0, 1.15fr);
    margin: 0;
    border-block: 1px solid var(--hw-edge);
  }

  .cell {
    display: grid;
    grid-template-rows: auto 1fr;
    align-content: start;
    gap: 0.4rem;
    min-width: 0;
    padding: 0.65rem 0.8rem 0.7rem;
  }

  .cell:first-child {
    padding-left: 0;
  }

  .cell:last-child {
    padding-right: 0;
  }

  .cell + .cell {
    border-left: 1px solid var(--hw-edge);
  }

  dt {
    font-size: var(--text-xs);
    line-height: 1.25;
    color: var(--hw-label);
  }

  dt.hw-label {
    font-size: 0.72rem;
    line-height: 1.35;
  }

  dd {
    min-width: 0;
    margin: 0;
    font-size: var(--text-sm);
  }

  /* The readout: the biggest words in the strip once it has the room. */
  @container result (min-width: 25.01rem) {
    dd {
      font-size: var(--text-base);
    }
  }

  .ch1 {
    display: grid;
    gap: 0.35rem;
  }

  /* The channel meter on its side, in its own small well: green, orange, then the red light at
     the right-hand end. */
  .lights {
    display: flex;
    gap: 2px;
    width: fit-content;
    padding: 3px;
    border: 1px solid var(--hw-edge);
    border-radius: var(--radius-control);
    background: var(--hw-sunk);
  }

  /* Square-cornered, like the unit's own segments. */
  .led {
    width: 0.45rem;
    height: 0.85rem;
    background: var(--led-off);
  }

  .led[data-on='true'][data-zone='green'] {
    background: var(--led-g);
    box-shadow: 0 0 0.35rem color-mix(in oklab, var(--led-g) 60%, transparent);
  }

  .led[data-on='true'][data-zone='orange'] {
    background: var(--led-a);
    box-shadow: 0 0 0.35rem color-mix(in oklab, var(--led-a) 60%, transparent);
  }

  .led[data-on='true'][data-zone='red'] {
    background: var(--led-r);
    box-shadow: 0 0 0.5rem var(--led-r);
  }

  /* Unlit, each keeps a hint of its colour through the lens, like the real panel. */
  .led[data-on='false'][data-zone='green'] {
    background: var(--led-g-off);
  }

  .led[data-on='false'][data-zone='orange'] {
    background: var(--led-a-off);
  }

  .led[data-on='false'][data-zone='red'] {
    background: var(--led-r-off);
    outline: 1px solid var(--led-r-rim);
    outline-offset: -1px;
  }

  .zone,
  .value {
    font-weight: 700;
    line-height: 1.25;
    color: var(--hw-bright);
  }

  .value {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 0.3rem 0.45rem;
  }

  .value :global(svg) {
    width: 1.9rem;
    height: auto;
  }

  /* Waiting for a guess: quiet, but still words someone acts on, so full size and readable. */
  .wait {
    font-size: var(--text-sm);
    line-height: 1.3;
    color: var(--hw-label);
  }

  /* A phone: the channel across the top, its lights and zone on one line, then two cells. */
  @container result (max-width: 25rem) {
    .strip {
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    }

    .ch1-cell {
      grid-column: 1 / -1;
      grid-template-rows: none;
      grid-template-columns: auto auto;
      align-items: center;
      justify-content: start;
      column-gap: 0.75rem;
      padding-right: 0;
      border-bottom: 1px solid var(--hw-edge);
    }

    .ch1 {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.3rem 0.75rem;
    }

    /* The crunch starts the second row, at the panel's edge. */
    .cell + .cell {
      padding-left: 0;
      border-left: 0;
    }

    .cell + .cell + .cell {
      padding-left: 0.8rem;
      border-left: 1px solid var(--hw-edge);
    }
  }

  @media (forced-colors: active) {
    .led[data-on][data-zone] {
      forced-color-adjust: none;
      box-shadow: none;
    }

    .led[data-on='true'][data-zone] {
      background: CanvasText;
    }

    .led[data-on='false'][data-zone] {
      background: Canvas;
      outline: 1px solid CanvasText;
    }
  }
</style>
