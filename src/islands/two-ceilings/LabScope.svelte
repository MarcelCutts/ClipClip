<script lang="ts">
  /**
   * One oscilloscope screen of the lab. Every screen shares one fixed scale in mixer units (see
   * LAB_SCOPE), and draws its own ceiling where it really sits on that scale, so a quieter signal
   * draws smaller and a hotter one runs past its ceiling: the screen never rescales to flatter it.
   * Signal in --sig; where a ceiling cut the peaks off, the flat tops are stroked in --dmg and the
   * missing part hangs beyond them as a dashed ghost over a faint wash. The ceiling's name sits in
   * the caption row, where it can't collide with the wave and keeps its size on a phone.
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
  }

  let { title, ceilingLabel, ceiling = CEILING_1, claim, drawing }: Props = $props();

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
    <span class="key"><span class="dash" aria-hidden="true"></span>{ceilingLabel}</span>
  </figcaption>
  <svg class="screen" viewBox="0 0 {g.width} {g.height}" aria-hidden="true">
    <path class="grid" d={grid} />
    <line class="axis" x1="0" x2={g.width} y1={mid} y2={mid} />
    <path class="cut" d={drawing.cut} />
    <line class="ceiling" x1="0" x2={g.width} y1={top} y2={top} />
    <line class="ceiling" x1="0" x2={g.width} y1={bottom} y2={bottom} />
    <path class="ghost" d={drawing.ghost} />
    <path class="trace" d={drawing.trace} />
    <path class="flat" d={drawing.flats} />
  </svg>
  <p class="claim">{claim}</p>
</figure>

<style>
  .scope {
    display: grid;
    gap: 0.4rem;
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

  /* What to notice: the screen's point, brighter than its labels. */
  .claim {
    margin: 0.1rem 0 0;
    font-size: var(--text-sm);
    line-height: 1.5;
    color: var(--hw-bright);
  }

  svg {
    width: 100%;
    height: auto;
    overflow: hidden;
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
  .flat {
    fill: none;
    stroke-linejoin: round;
    stroke-linecap: round;
    vector-effect: non-scaling-stroke;
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

    .dash {
      border-top-color: GrayText;
    }
  }
</style>
