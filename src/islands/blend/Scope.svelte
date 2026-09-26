<script lang="ts">
  /**
   * The blend lab's screen: two beats of the blend, drawn like DJ software draws a waveform.
   * Each deck (after its fader) is a thin outline in its own colour, the mix is the filled
   * shape, and whatever the mix pushes past the red is filled in the damage colour, because the
   * ceiling cuts it off. The vertical scale is fixed, so louder always looks bigger.
   *
   * Hidden from screen readers: the reactive sentence just above it says the same thing. The lab
   * keeps it behind "Show the waveform" on a phone and shows it, smaller, beside the pads on a
   * wide panel: the meters are what the reader watches.
   */
  import type { BlendView } from '../../lib/blend/model';
  import { ANALYSIS_RATE, VIEW } from '../../lib/blend/model';
  import { envelope } from '../../lib/blend/view';
  import { formatDb } from '../../lib/dsp/db';
  import { type ScopeGeometry, scopeY } from '../../lib/viz/scope';
  import { CEILING_DB } from '../../lib/xdj';

  interface Props {
    view: BlendView;
    /** Unique prefix for the clip-path ids. */
    uid: string;
  }

  let { view, uid }: Props = $props();

  /**
   * Each deck is cut at the red (±1) before its fader, and a fader never adds level, so the mix
   * peaks at ±2 at most. The scale runs a little past that, so no setting flattens a peak on the
   * frame and louder always looks bigger.
   */
  const G: ScopeGeometry = { width: 300, height: 160, range: 2.1 };
  /** ±12 ms at the analysis rate: enough to hold the peak of a 47 Hz kick cycle. */
  const HOLD = Math.round(0.012 * ANALYSIS_RATE);
  const top = scopeY(1, G);
  const bottom = scopeY(-1, G);
  const mid = scopeY(0, G);
  /** Beat lines: whole beats inside the window, as fractions of its width. */
  const beats = Array.from({ length: VIEW.beats }, (_, k) => ((Math.ceil(VIEW.startBeat) - VIEW.startBeat + k) / VIEW.beats) * G.width);

  /** Columns to soften over. The hold spans about ten columns, so peaks keep their height. */
  const SMOOTH = 2;
  const deck1 = $derived(envelope(view.deck1, G, HOLD, SMOOTH));
  const deck2 = $derived(envelope(view.deck2, G, HOLD, SMOOTH));
  const mix = $derived(envelope(view.mix, G, HOLD, SMOOTH));
</script>

<div class="screen scope" aria-hidden="true">
  <div class="plot">
    <svg viewBox="0 0 {G.width} {G.height}" preserveAspectRatio="none" focusable="false" aria-hidden="true">
      <defs>
        <clipPath id="{uid}-inside">
          <rect x="-1" y={top} width={G.width + 2} height={bottom - top} />
        </clipPath>
        <clipPath id="{uid}-outside">
          <rect x="-1" y="-1" width={G.width + 2} height={top + 1} />
          <rect x="-1" y={bottom} width={G.width + 2} height={G.height - bottom + 1} />
        </clipPath>
        <!-- Unstyled, so each <use> below paints it its own way. -->
        <path id="{uid}-mix" d={mix.area} vector-effect="non-scaling-stroke" />
      </defs>
      {#each beats as x (x)}
        <line class="beat" x1={x} x2={x} y1="0" y2={G.height} />
      {/each}
      <line class="axis" x1="0" x2={G.width} y1={mid} y2={mid} />
      <g clip-path="url(#{uid}-inside)">
        <use class="mix-fill" href="#{uid}-mix" />
        <path class="mix-edge" d={mix.upper} />
        <path class="mix-edge" d={mix.lower} />
      </g>
      <path class="deck deck1" d={deck1.upper} />
      <path class="deck deck1" d={deck1.lower} />
      <path class="deck deck2" d={deck2.upper} />
      <path class="deck deck2" d={deck2.lower} />
      <use class="over" href="#{uid}-mix" clip-path="url(#{uid}-outside)" />
      <line class="ceiling" x1="0" x2={G.width} y1={top} y2={top} />
      <line class="ceiling" x1="0" x2={G.width} y1={bottom} y2={bottom} />
    </svg>
    <span class="ceiling-label" style:top="{(top / G.height) * 100}%">Red, {formatDb(CEILING_DB)}</span>
  </div>
  <ul class="legend">
    <li><span class="key line deck1"></span>Deck 1</li>
    <li><span class="key line deck2"></span>Deck 2</li>
    <li><span class="key fill mix"></span>Mix</li>
    <li><span class="key fill over"></span>Cut off at the red</li>
  </ul>
</div>

<style>
  .scope {
    display: grid;
    gap: 0.4rem;
    padding: 0.5rem 0.5rem 0.55rem;
  }

  .plot {
    position: relative;
  }

  svg {
    width: 100%;
    height: clamp(8rem, 6rem + 10cqi, 11rem);
    overflow: visible;
  }

  path,
  line {
    vector-effect: non-scaling-stroke;
  }

  .beat {
    stroke: var(--screen-grid);
    stroke-width: 1;
  }

  .axis {
    stroke: var(--screen-axis);
    stroke-width: 1;
  }

  /* The mix: the shape that matters, in the screen's neutral light. */
  .mix-fill {
    fill: color-mix(in oklab, var(--hw-label) 22%, transparent);
  }

  .mix-edge {
    fill: none;
    stroke: var(--hw-label);
    stroke-width: 1.5;
    stroke-linejoin: round;
  }

  /* 2px, so each deck's line holds its own against the filled mix. */
  .deck {
    fill: none;
    stroke-width: 2;
    stroke-linejoin: round;
  }

  .deck1 {
    stroke: var(--sig);
  }

  /* Dashed as well as a different colour, so the two decks never differ by hue alone: the dash
     is long enough to read at 2px, and its gaps long enough to see. */
  .deck2 {
    stroke: var(--sig-b);
    stroke-dasharray: 4 3;
  }

  /* What the ceiling cuts off. */
  .over {
    fill: var(--dmg);
    stroke: var(--dmg);
    stroke-width: 1;
  }

  .ceiling {
    stroke: var(--screen-text);
    stroke-width: 1.25;
    stroke-dasharray: 5 4;
  }

  /* Centred between the two kicks, where the waveform never reaches the line. */
  .ceiling-label {
    position: absolute;
    left: 50%;
    translate: -50% -120%;
    padding: 0 0.25rem;
    background: var(--screen);
    font-size: var(--text-xs);
    font-weight: 700;
    line-height: 1.2;
    color: var(--screen-text);
    white-space: nowrap;
  }

  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 0.2rem 1rem;
    margin: 0;
    padding: 0 0.15rem;
    list-style: none;
    font-size: var(--text-xs);
    line-height: 1.35;
    color: var(--screen-text);
  }

  .legend li {
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .key {
    flex: none;
    display: inline-block;
  }

  /* Line keys are borders, so deck 2's can be dashed like its line. */
  .key.line {
    width: 0.9rem;
    height: 0;
    border-top: 2px solid;
  }

  .key.fill {
    width: 0.7rem;
    height: 0.7rem;
  }

  .key.deck1 {
    border-color: var(--sig);
  }

  .key.deck2 {
    border-color: var(--sig-b);
    border-top-style: dashed;
  }

  .key.mix {
    border: 1.5px solid var(--hw-label);
    background: color-mix(in oklab, var(--hw-label) 22%, transparent);
  }

  .key.over {
    background: var(--dmg);
  }

  @media (forced-colors: active) {
    .mix-fill {
      fill: none;
    }

    .mix-edge,
    .deck,
    .ceiling,
    .axis {
      stroke: CanvasText;
    }

    .over {
      fill: Highlight;
      stroke: Highlight;
    }

    .key.line {
      border-color: CanvasText;
    }

    .key.mix {
      background: CanvasText;
    }

    .key.over {
      background: Highlight;
    }
  }
</style>
