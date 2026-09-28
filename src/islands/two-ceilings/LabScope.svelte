<script lang="ts">
  /**
   * One oscilloscope screen of the lab. Every screen shares one fixed scale in mixer units (see
   * LAB_SCOPE), and draws its own ceiling where it really sits on that scale, so a quieter signal
   * draws smaller and a hotter one runs past its ceiling: the screen never rescales to flatter it.
   * Signal in --sig; flat tops are stroked in --dmg, whichever ceiling made them, and what this
   * screen's own ceiling cut off hangs beyond them as a dashed ghost over a faint wash. The key to
   * the screen sits in the caption row, where it can't collide with the wave and keeps its size on
   * a phone.
   *
   * Under the screen, one line says what to notice. It is the picture's text equivalent too, so
   * the drawing itself is hidden from screen readers rather than described twice.
   */
  import { CEILING_1, LAB_SCOPE, type ScopeDrawing } from '../../lib/lab/ceilings';
  import { scopeY } from '../../lib/viz/scope';

  interface Props {
    title: string;
    ceilingLabel: string;
    /** Where this screen's ceiling sits, in mixer units: CEILING_1 (±1) or CEILING_2. */
    ceiling?: number;
    /** What to notice on this screen, in a sentence. */
    claim: string;
    drawing: ScopeDrawing;
    /** Shown in place of the wave, until the step lets it be seen. */
    covered?: string | undefined;
    /**
     * The wave as it left the stage before, drawn faint behind this one on the same scale: the two
     * differ in size and in nothing else, which is all a level control can do.
     */
    before?: string | undefined;
    /** The key's name for `before`. */
    beforeLabel?: string | undefined;
  }

  let { title, ceilingLabel, ceiling = CEILING_1, claim, drawing, covered, before, beforeLabel }: Props = $props();

  const g = LAB_SCOPE;
  const mid = g.height / 2;
  const top = $derived(scopeY(ceiling, g));
  const bottom = $derived(scopeY(-ceiling, g));
  // Ten time divisions of about 3 ms each, like a scope's graticule.
  const grid = Array.from({ length: 9 }, (_, i) => `M${((i + 1) * g.width) / 10} 0V${g.height}`).join('');
</script>

<figure class="scope">
  <figcaption>
    <span class="title">{title}</span>
    <span class="keys">
      <span class="key"><span class="dash" aria-hidden="true"></span>{ceilingLabel}</span>
      {#if before && beforeLabel && !covered}
        <span class="key"><span class="faint" aria-hidden="true"></span>{beforeLabel}</span>
      {/if}
    </span>
  </figcaption>
  <div class="glass">
    <svg class="screen" viewBox="0 0 {g.width} {g.height}" aria-hidden="true">
      <path class="grid" d={grid} />
      <line class="axis" x1="0" x2={g.width} y1={mid} y2={mid} />
      <line class="ceiling" x1="0" x2={g.width} y1={top} y2={top} />
      <line class="ceiling" x1="0" x2={g.width} y1={bottom} y2={bottom} />
      {#if !covered}
        {#if before}<path class="before" d={before} />{/if}
        <path class="cut" d={drawing.cut} />
        <path class="ghost" d={drawing.ghost} />
        <path class="trace" d={drawing.trace} />
        <path class="flat" d={drawing.flats} />
      {/if}
    </svg>
    {#if covered}<p class="covered"><span>{covered}</span></p>{/if}
  </div>
  {#if !covered}<p class="claim">{claim}</p>{/if}
</figure>

<style>
  .scope {
    display: grid;
    gap: 0.4rem;
    align-content: start;
    min-width: 0;
    margin: 0;
  }

  figcaption {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 0.25rem 1rem;
    line-height: 1.25;
  }

  .title {
    font-size: var(--text-sm);
    font-weight: 700;
    color: var(--hw-label);
  }

  .keys {
    display: flex;
    flex-wrap: wrap;
    gap: 0.25rem 1rem;
  }

  .key {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    font-size: var(--text-xs);
    color: var(--hw-label);
  }

  .dash {
    width: 1.4rem;
    border-top: 1.5px dashed var(--screen-text);
  }

  /* The key for the wave that left the stage before: the signal's own colour, faint. */
  .faint {
    width: 1.4rem;
    border-top: 1.5px solid color-mix(in oklab, var(--sig) 50%, transparent);
  }

  /* What to notice: the screen's point, brighter than its labels. */
  .claim {
    margin: 0.1rem 0 0;
    font-size: var(--text-sm);
    line-height: 1.5;
    color: var(--hw-bright);
  }

  /* The screen, and anything laid over it. */
  .glass {
    position: relative;
    display: grid;
  }

  svg {
    width: 100%;
    height: auto;
    overflow: hidden;
  }

  /* Until the question is answered, the screen shows its ceiling and says what it is waiting for.
     The words sit on the screen's own colour, so no line runs through them. */
  .covered {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    margin: 0;
    padding: 1rem 1.25rem;
    font-size: var(--text-sm);
    line-height: 1.45;
    text-align: center;
    text-wrap: balance;
    color: var(--screen-text);
  }

  .covered span {
    max-width: 16rem;
    padding: 0.4rem 0.6rem;
    background: var(--screen);
  }

  .grid {
    fill: none;
    stroke: var(--screen-grid);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }

  .axis {
    stroke: var(--screen-axis);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }

  .ceiling {
    stroke: var(--screen-text);
    stroke-width: 1.25;
    stroke-dasharray: 6 4;
    vector-effect: non-scaling-stroke;
  }

  .cut {
    fill: var(--dmg);
    fill-opacity: 0.14;
    stroke: none;
  }

  .ghost,
  .trace,
  .flat,
  .before {
    fill: none;
    stroke-linejoin: round;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
  }

  /* What left the stage before: the same music in the signal's colour, faint and thin, behind. */
  .before {
    stroke: var(--sig);
    stroke-width: 1.5;
    stroke-opacity: 0.4;
  }

  .ghost {
    stroke: var(--dmg);
    stroke-width: 1.25;
    stroke-dasharray: 3 3;
  }

  .trace {
    stroke: var(--sig);
    stroke-width: 2;
  }

  .flat {
    stroke: var(--dmg);
    stroke-width: 3;
  }

  /* SVG keeps its own colours in forced-colours mode, so pick system colours for every mark. */
  @media (forced-colors: active) {
    svg {
      forced-color-adjust: none;
      background: Canvas;
      outline: 1px solid CanvasText;
    }

    .grid,
    .axis {
      stroke: GrayText;
      stroke-opacity: 0.4;
    }

    .trace {
      stroke: CanvasText;
    }

    .before {
      stroke: GrayText;
      stroke-opacity: 1;
    }

    .ghost,
    .flat {
      stroke: Highlight;
    }

    .cut {
      fill: none;
    }

    .ceiling {
      stroke: GrayText;
    }

    .dash,
    .faint {
      border-top-color: GrayText;
    }
  }
</style>
