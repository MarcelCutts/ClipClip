<script lang="ts">
  /**
   * The little drawing on each SignalPath node: a knob, a jog wheel, an LED ladder, a socket,
   * a speaker, the recorder. Decorative (the node's text carries the meaning), so it is hidden from
   * screen readers. Meters light up to the first orange LED, where the loudest bits should peak.
   *
   * Knobs are drawn the way Pioneer's own figure draws the XDJ-RX2's: the printed scale of dots
   * round the knob, a ribbed skirt, a flat cap and a white pointer line from the centre out.
   */
  import type { Glyph } from '../../lib/rig';
  import { METER_SEGMENTS } from '../../lib/xdj';

  interface Props {
    glyph: Glyph;
    /** Knob pointer, in degrees from 12 o'clock. */
    angle?: number;
    /** TRIM caps are grey on the real unit; everything else is black. */
    lightCap?: boolean;
  }

  let { glyph, angle = 0, lightCap = false }: Props = $props();

  /** The printed scale: eleven dots from 7 o'clock round to 5 o'clock, as on the panel. */
  const SCALE = Array.from({ length: 11 }, (_, i) => -150 + i * 30);
  const rad = (deg: number) => (deg * Math.PI) / 180;
  /** How many LEDs the drawing lights: up to and including 0 dB, the first orange. */
  const LIT = METER_SEGMENTS.findIndex((s) => s.db === 0) + 1;
  const leds = METER_SEGMENTS.map((s, i) => ({ zone: s.zone, on: i < LIT, row: METER_SEGMENTS.length - 1 - i }));
</script>

{#if glyph === 'knob'}
  <svg class="glyph" viewBox="0 0 24 24" aria-hidden="true">
    {#each SCALE as t (t)}
      <circle class="tick" cx={12 + 11.3 * Math.sin(rad(t))} cy={12 - 11.3 * Math.cos(rad(t))} r={Math.abs(t) === 150 ? 0.95 : 0.7} />
    {/each}
    <circle class="skirt" cx="12" cy="12" r="8.6" />
    <circle class="ribs" cx="12" cy="12" r="7.6" />
    <circle class="cap" class:light={lightCap} cx="12" cy="12" r="5.9" />
    <line
      class="pointer"
      class:light={lightCap}
      x1="12"
      y1="11"
      x2="12"
      y2="3.9"
      transform="rotate({angle} 12 12)"
    />
  </svg>
{:else if glyph === 'deck'}
  <svg class="glyph" viewBox="0 0 24 24" aria-hidden="true">
    <circle class="rim" cx="12" cy="12" r="10.6" />
    <circle class="platter" cx="12" cy="12" r="6.8" />
    <circle class="spindle" cx="12" cy="12" r="1.5" />
    <rect class="index" x="11.2" y="2.2" width="1.6" height="3" rx="0.6" />
  </svg>
{:else if glyph === 'fader'}
  <svg class="glyph" viewBox="0 0 24 24" aria-hidden="true">
    <rect class="slot" x="10.8" y="1.5" width="2.4" height="21" rx="1.2" />
    <rect class="fcap" x="6" y="6" width="12" height="7" rx="1.4" />
    <line class="findex" x1="6.8" y1="9.5" x2="17.2" y2="9.5" />
  </svg>
{:else if glyph === 'meter' || glyph === 'meter-stereo'}
  {@const stereo = glyph === 'meter-stereo'}
  <svg class="glyph ladder" class:stereo viewBox="0 0 {stereo ? 20 : 9} {stereo ? 41 : 36}" aria-hidden="true">
    {#if stereo}<rect class="clip" x="4.5" y="0" width="11" height="2.6" rx="0.8" />{/if}
    {#each leds as led, i (i)}
      {@const y = (stereo ? 5 : 0) + led.row * 3}
      <rect class="led" data-zone={led.zone} data-on={led.on} x={stereo ? 1 : 0.5} {y} width={stereo ? 7.5 : 8} height="2.1" rx="0.5" />
      {#if stereo}
        <rect class="led" data-zone={led.zone} data-on={led.on} x="11.5" {y} width="7.5" height="2.1" rx="0.5" />
      {/if}
    {/each}
  </svg>
{:else if glyph === 'sum'}
  <svg class="glyph" viewBox="0 0 24 24" aria-hidden="true">
    <circle class="ring" cx="12" cy="12" r="9" />
    <path class="plus" d="M12 7v10M7 12h10" />
  </svg>
{:else if glyph === 'xlr'}
  <svg class="glyph" viewBox="0 0 24 24" aria-hidden="true">
    <circle class="socket" cx="12" cy="12" r="9.4" />
    <circle class="hole" cx="8.6" cy="10" r="1.5" />
    <circle class="hole" cx="15.4" cy="10" r="1.5" />
    <circle class="hole" cx="12" cy="15.6" r="1.5" />
    <rect class="latch" x="10.6" y="1.6" width="2.8" height="2.4" rx="0.6" />
  </svg>
{:else if glyph === 'rca' || glyph === 'trs'}
  <svg class="glyph" viewBox="0 0 24 24" aria-hidden="true">
    {#each [6.2, 17.8] as x (x)}
      <circle class="socket" cx={x} cy="12" r="5.2" />
      {#if glyph === 'rca'}
        <circle class="hole" cx={x} cy="12" r="2.6" />
        <circle class="pin" cx={x} cy="12" r="0.9" />
      {:else}
        <circle class="hole" cx={x} cy="12" r="2.9" />
      {/if}
    {/each}
  </svg>
{:else if glyph === 'rack'}
  <svg class="glyph" viewBox="0 0 24 24" aria-hidden="true">
    <rect class="box" x="1.2" y="6.5" width="21.6" height="11" rx="1.4" />
    <rect class="display" x="3.6" y="9" width="7.4" height="6" rx="0.8" />
    <circle class="knoblet" cx="15" cy="12" r="1.9" />
    <circle class="knoblet" cx="19.6" cy="12" r="1.9" />
  </svg>
{:else if glyph === 'limiter'}
  <svg class="glyph" viewBox="0 0 24 24" aria-hidden="true">
    <rect class="box" x="2" y="3" width="20" height="18" rx="2.4" />
    <path class="curve" d="M5.5 17.5 10.5 11.5Q12 9.5 14 9.5H18.5" />
  </svg>
{:else if glyph === 'amp'}
  <!-- A power amp's front: two gain knobs, turned well up. -->
  <svg class="glyph" viewBox="0 0 24 24" aria-hidden="true">
    <rect class="box" x="1.2" y="4.8" width="21.6" height="14.4" rx="1.6" />
    {#each [7.4, 16.6] as x (x)}
      <circle class="knoblet" cx={x} cy="12" r="3.6" />
      <line class="gain" x1={x} y1="12" x2={x + 2.4} y2="9.6" />
    {/each}
  </svg>
{:else if glyph === 'pa'}
  <svg class="glyph" viewBox="0 0 24 24" aria-hidden="true">
    <rect class="box" x="5" y="1.2" width="14" height="21.6" rx="2" />
    <circle class="cone" cx="12" cy="15.2" r="4.6" />
    <circle class="dust" cx="12" cy="15.2" r="1.5" />
    <circle class="cone" cx="12" cy="6.4" r="2" />
  </svg>
{:else if glyph === 'monitor'}
  <svg class="glyph" viewBox="0 0 24 24" aria-hidden="true">
    <path class="box" d="M2.5 19.5H21.5L19.5 6.5 4.5 10.5Z" />
    <circle class="cone" cx="10" cy="14.6" r="3.4" />
    <circle class="cone" cx="16.4" cy="12.8" r="1.5" />
  </svg>
{:else if glyph === 'howler'}
  <!-- The Howler from above, as ui/HowlerTop draws it: finned case, RCA sockets at both ends,
       the big RECORD button and the two lights over it. -->
  <svg class="glyph" viewBox="0 0 24 24" aria-hidden="true">
    <rect class="stub" x="0.4" y="9.6" width="1.6" height="2" />
    <rect class="stub" x="0.4" y="13.4" width="1.6" height="2" />
    <rect class="stub" x="22" y="8.6" width="1.6" height="2" />
    <rect class="stub" x="22" y="12.4" width="1.6" height="2" />
    <rect class="box" x="2" y="5" width="20" height="14.3" rx="1" />
    <path class="fin" d="M3.6 6.9h16.8M3.6 8.3h16.8M3.6 15.9h16.8M3.6 17.3h16.8" />
    <circle class="knoblet" cx="15" cy="12.4" r="2.6" />
    <circle class="spot" cx="14.1" cy="9.8" r="0.55" />
    <circle class="spot" cx="15.9" cy="9.8" r="0.55" />
  </svg>
{/if}

<style>
  .glyph {
    display: block;
    flex: none;
    width: var(--glyph, 1.85em);
    height: var(--glyph, 1.85em);
    overflow: visible;
  }

  .ladder {
    width: auto;
    height: var(--ladder, 2.9em);
  }

  .tick {
    fill: var(--hw-label-2);
  }

  /* The skirt, its ribs as a dashed ring, and the flat cap on top. */
  .skirt {
    fill: var(--hw-sunk);
    stroke: var(--hw-label-2);
    stroke-width: 0.9;
  }

  .ribs {
    fill: none;
    stroke: color-mix(in oklab, var(--hw-label-2) 45%, var(--hw-sunk));
    stroke-width: 1.3;
    stroke-dasharray: 0.7 1.2;
  }

  .cap {
    fill: var(--hw-2);
    stroke: color-mix(in oklab, var(--hw-label-2) 55%, var(--hw-2));
    stroke-width: 0.7;
  }

  /* TRIM's cap is grey on the real unit. */
  .cap.light {
    fill: var(--hw-label-2);
    stroke: var(--hw-label);
  }

  .pointer {
    stroke: var(--hw-bright);
    stroke-width: 1.6;
    stroke-linecap: round;
  }

  .pointer.light {
    stroke: var(--hw-sunk);
  }

  .rim {
    fill: var(--hw-sunk);
    stroke: var(--hw-label-2);
    stroke-width: 1;
  }

  .platter {
    fill: var(--hw-3);
    stroke: var(--hw-edge);
  }

  .spindle,
  .index {
    fill: var(--hw-label);
  }

  .slot {
    fill: var(--hw-sunk);
  }

  .fcap {
    fill: var(--hw-label-2);
    stroke: var(--hw-sunk);
    stroke-width: 0.8;
  }

  .findex {
    stroke: var(--hw-label);
    stroke-width: 1.2;
  }

  .led {
    fill: var(--led-off);
  }

  .led[data-on='true'][data-zone='green'] {
    fill: var(--led-g);
  }

  .led[data-on='true'][data-zone='orange'] {
    fill: var(--led-a);
  }

  .led[data-on='false'][data-zone='orange'] {
    fill: color-mix(in oklab, var(--led-a) 18%, var(--led-off));
  }

  .led[data-on='false'][data-zone='red'] {
    fill: color-mix(in oklab, var(--led-r) 22%, var(--led-off));
  }

  .clip {
    fill: color-mix(in oklab, var(--led-r) 22%, var(--led-off));
  }

  .ring {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.4;
  }

  .plus {
    stroke: currentColor;
    stroke-width: 1.8;
    stroke-linecap: round;
  }

  .socket {
    fill: var(--hw-3);
    stroke: var(--hw-label-2);
    stroke-width: 1;
  }

  .hole {
    fill: var(--hw-sunk);
  }

  .pin,
  .latch {
    fill: var(--hw-label-2);
  }

  .box {
    fill: var(--hw-3);
    stroke: var(--hw-label-2);
    stroke-width: 1;
    stroke-linejoin: round;
  }

  .display {
    fill: var(--screen);
    stroke: var(--hw-edge);
    stroke-width: 0.6;
  }

  .knoblet,
  .cone {
    fill: var(--hw-sunk);
    stroke: var(--hw-label-2);
    stroke-width: 0.9;
  }

  .dust {
    fill: var(--hw-3);
  }

  .stub {
    fill: var(--hw-3);
    stroke: var(--hw-label-2);
    stroke-width: 0.5;
  }

  .fin {
    fill: none;
    stroke: color-mix(in oklab, var(--hw-label-2) 50%, var(--hw-3));
    stroke-width: 0.5;
  }

  .spot {
    fill: var(--hw-label-2);
  }

  .curve {
    fill: none;
    stroke: var(--hw-label);
    stroke-width: 1.7;
    stroke-linecap: round;
    stroke-linejoin: round;
  }

  .gain {
    stroke: var(--hw-label);
    stroke-width: 1.4;
    stroke-linecap: round;
  }

  @media (forced-colors: active) {
    .glyph * {
      fill: Canvas;
      stroke: CanvasText;
    }

    .ribs,
    .fin {
      fill: none;
    }

    .led[data-on='true'],
    .pointer,
    .gain,
    .plus,
    .curve,
    .spindle,
    .index,
    .spot {
      fill: CanvasText;
      stroke: CanvasText;
    }
  }
</style>
