<script lang="ts">
  /**
   * The BOOTH MONITOR knob as a DJ finds it, with the knob tag from the print kit (/print/) beside
   * it, so the card shows what they'll really see in the booth. It's the DJ's own knob for the
   * booth monitors, so it has no crew mark. Drawn as Pioneer's own figure draws the XDJ-RX2's knobs:
   * a ribbed skirt, a flat cap with a white pointer line across it, and the printed scale of dots
   * around it, from −∞ to 0.
   */
  import { MONITOR_TAG } from '../../lib/tags';

  interface Props {
    /** Where the pointer sits, in degrees clockwise from 12 o'clock (−150 is −∞, +150 is 0). */
    angle?: number;
    /** The tag's big word, as the print kit's short tag has it. */
    tape?: string;
    /** Whose knob it is, printed small after the word. */
    owner?: string;
  }

  let { angle = 30, tape = MONITOR_TAG.name, owner = MONITOR_TAG.owner }: Props = $props();

  const CX = 60;
  const CY = 58;
  const at = (deg: number, r: number) => {
    const a = (deg * Math.PI) / 180;
    return { x: CX + r * Math.sin(a), y: CY - r * Math.cos(a) };
  };
  const dots = Array.from({ length: 11 }, (_, i) => ({ ...at(-150 + i * 30, 49), end: i === 0 || i === 10 }));
  /** The skirt's ribs: short radial lines all the way round. */
  const ribs = Array.from({ length: 40 }, (_, i) => ({ from: at(i * 9, 32), to: at(i * 9, 37) }));
  const tipIn = $derived(at(angle, 5));
  const tipOut = $derived(at(angle, 35));
  const minLabel = at(-150, 57);
  const maxLabel = at(150, 57);
</script>

<div class="booth" role="img" aria-label="The BOOTH MONITOR knob. The tag beside it says {tape}, {owner}.">
  <span class="hw-label name" aria-hidden="true">Booth monitor</span>
  <svg viewBox="0 0 120 120" aria-hidden="true">
    {#each dots as dot, i (i)}
      <circle class="dot" cx={dot.x} cy={dot.y} r={dot.end ? 2.1 : 1.5} />
    {/each}
    <!-- −∞ drawn, not typed: the self-hosted Latin subsets have no ∞ glyph. -->
    <g class="infinity" transform="translate({minLabel.x - 12} {minLabel.y})">
      <path d="M0 0.2h4.6M7 0.2c0-2.3 3.2-2.3 4.6 0s4.6 2.3 4.6 0-3.2-2.3-4.6 0-4.6 2.3-4.6 0z" />
    </g>
    <text class="scale" x={maxLabel.x + 3} y={maxLabel.y + 4} text-anchor="middle">0</text>
    <circle class="skirt" cx={CX} cy={CY} r="37" />
    {#each ribs as rib, i (i)}
      <line class="rib" x1={rib.from.x} y1={rib.from.y} x2={rib.to.x} y2={rib.to.y} />
    {/each}
    <circle class="cap" cx={CX} cy={CY} r="27" />
    <line class="pointer" x1={tipIn.x} y1={tipIn.y} x2={tipOut.x} y2={tipOut.y} />
  </svg>
  <span class="tape-strip" aria-hidden="true">
    <span class="tape-name">{tape}</span>
    <span class="tape-owner">· {owner}</span>
  </span>
</div>

<style>
  .booth {
    display: grid;
    justify-items: center;
    gap: 0.2rem;
    width: 11rem;
  }

  .name {
    font-size: 0.72rem;
  }

  svg {
    width: 8.5rem;
    height: auto;
    overflow: visible;
  }

  .dot {
    fill: var(--hw-label-2);
  }

  /* The scale is printed on the panel, so it's lettered like the other legends. */
  .scale {
    font-family: var(--font-label);
    font-weight: 700;
    font-size: 12px;
    fill: var(--hw-label-2);
  }

  .infinity path {
    fill: none;
    stroke: var(--hw-label-2);
    stroke-width: 1.5;
    stroke-linecap: round;
  }

  /* One grey for the knob, a light line for its outline, a dimmer one for the ribs. */
  .skirt {
    fill: var(--hw-sunk);
    stroke: var(--hw-label-2);
    stroke-width: 1.25;
  }

  .rib {
    stroke: color-mix(in oklab, var(--hw-label-2) 45%, var(--hw-sunk));
    stroke-width: 1.25;
  }

  .cap {
    fill: var(--hw-2);
    stroke: color-mix(in oklab, var(--hw-label-2) 60%, var(--hw-2));
    stroke-width: 1;
  }

  .pointer {
    stroke: var(--hw-bright);
    stroke-width: 3.2;
    stroke-linecap: round;
  }

  .tape-strip {
    display: flex;
    align-items: baseline;
    gap: 0.4em;
    margin-top: 0.1rem;
    padding: 0.35em 0.8em 0.3em;
    background: var(--tape);
    color: var(--tape-ink);
    font-family: var(--font-stencil);
    font-optical-sizing: auto;
    font-weight: 800;
    line-height: 1;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    white-space: nowrap;
    rotate: -1.5deg;
    clip-path: polygon(0 6%, 3% 0, 6% 6%, 100% 0, 98.5% 30%, 100% 62%, 98% 100%, 4% 100%, 1.5% 92%, 0 100%, 1.5% 60%, 0 30%);
  }

  .tape-name {
    font-size: 1.25rem;
  }

  /* As on the printed tag: the owner in small lower-case print after the big word. */
  .tape-owner {
    font-size: 0.85rem;
    font-weight: 700;
    text-transform: none;
    letter-spacing: 0.02em;
  }

  @media (forced-colors: active) {
    .skirt,
    .cap {
      fill: Canvas;
      stroke: CanvasText;
    }

    .rib,
    .pointer {
      stroke: CanvasText;
    }

    .tape-strip {
      border: 1px solid CanvasText;
    }
  }
</style>
