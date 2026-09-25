<script lang="ts">
  /**
   * The wires behind the SignalPath nodes, for one layout. Every connection is drawn once in the
   * base layer; the lit path is drawn again on top, so a lit wire always wins where two share a
   * run. The drawing is decorative: the nodes and the readout carry the same information as text.
   */
  import type { Layout } from '../../lib/rig';

  interface Props {
    layout: Layout;
    /** Edge ids on the highlighted path, or null when nothing is picked. */
    lit: ReadonlySet<string> | null;
  }

  let { layout, lit }: Props = $props();

  const litWires = $derived(lit ? layout.wires.filter((w) => lit.has(w.edge)) : []);
  const litDots = $derived(lit ? layout.dots.filter((d) => d.edges.some((e) => lit.has(e))) : []);
</script>

<svg
  class="wires"
  class:dim={lit !== null}
  data-layout={layout.name}
  viewBox="0 0 {layout.width} {layout.height}"
  aria-hidden="true"
  focusable="false"
>
  <rect
    class="chassis"
    x={layout.chassis.x}
    y={layout.chassis.y}
    width={layout.chassis.w}
    height={layout.chassis.h}
    rx="6"
  />
  <text class="chassis-name" x="10" y="17">XDJ-RX2</text>

  <g class="base">
    {#each layout.wires as wire (wire.edge)}
      <path class="wire" d={wire.d} />
      <path class="arrow" d={wire.arrow} />
    {/each}
    {#each layout.dots as dot (`${dot.x},${dot.y}`)}
      <circle class="dot" cx={dot.x} cy={dot.y} r="2.7" />
    {/each}
  </g>

  <g class="lit">
    {#each litWires as wire (wire.edge)}
      <path class="wire" d={wire.d} />
      <path class="arrow" d={wire.arrow} />
    {/each}
    {#each litDots as dot (`${dot.x},${dot.y}`)}
      <circle class="dot" cx={dot.x} cy={dot.y} r="3" />
    {/each}
  </g>

  {#each layout.labels as label (label.edge)}
    <text class="lead" class:on={lit?.has(label.edge)} x={label.x} y={label.y} text-anchor={label.anchor}>
      {#each label.lines as line, i (i)}
        <tspan x={label.x} dy={i === 0 ? 0 : '1.2em'}>{line}</tspan>
      {/each}
    </text>
  {/each}
</svg>

<style>
  .wires {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    overflow: visible;
    pointer-events: none;
  }

  /* The XDJ-RX2's outline, drawn as a line like the rest of the gear: no fill of its own. */
  .chassis {
    fill: none;
    stroke: color-mix(in oklab, var(--hw-label-2) 55%, var(--hw));
    stroke-width: 1.25;
  }

  /* The model name printed on the mixer, lettered like the other hardware labels (.hw-label). */
  .chassis-name {
    font-family: var(--font-label);
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0.14em;
    fill: var(--hw-label-2);
  }

  .wire {
    fill: none;
    stroke-width: 1.6;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  /* At rest the wires read clearly; once something is picked they step back to 3:1. */
  .base {
    --wire: color-mix(in oklab, var(--hw-label-2) 88%, var(--hw));
  }

  .dim .base {
    --wire: color-mix(in oklab, var(--hw-label-2) 62%, var(--hw));
  }

  .base .wire {
    stroke: var(--wire);
  }

  .base .arrow,
  .base .dot {
    fill: var(--wire);
  }

  .lit .wire {
    stroke: var(--sig);
    stroke-width: 2.8;
  }

  .lit .arrow,
  .lit .dot {
    fill: var(--sig);
  }

  .lead {
    font-family: var(--font-body);
    font-size: 10.5px;
    font-weight: 400;
    fill: var(--hw-label-2);
  }

  .lead.on {
    fill: var(--hw-label);
  }

  @media print {
    .chassis {
      fill: none;
      stroke: black;
    }

    .chassis-name,
    .lead,
    .lead.on {
      fill: black;
    }

    .base,
    .dim .base {
      --wire: darkgray;
    }

    .lit .wire {
      stroke: black;
    }

    .lit .arrow,
    .lit .dot {
      fill: black;
    }
  }

  @media (forced-colors: active) {
    .chassis {
      fill: none;
      stroke: CanvasText;
    }

    .chassis-name,
    .lead,
    .lead.on {
      fill: CanvasText;
    }

    .base,
    .dim .base {
      --wire: GrayText;
    }

    .lit .wire {
      stroke: Highlight;
    }

    .lit .arrow,
    .lit .dot {
      fill: Highlight;
    }
  }
</style>
